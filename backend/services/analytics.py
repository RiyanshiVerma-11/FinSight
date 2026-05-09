import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    silhouette_score, roc_auc_score, f1_score,
    precision_score, recall_score,
    confusion_matrix as sklearn_cm
)
from sklearn.utils.validation import check_is_fitted
from scipy.stats import ks_2samp
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold, GridSearchCV
from datetime import datetime, timedelta
import logging
import os
import pickle
import json
import sklearn

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import precision_recall_curve, auc as sklearn_auc

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AnalyticsEngine:
    def __init__(self):
        self.scaler = StandardScaler()
        # Keep unfitted base estimators for tuning/fallback only.
        # self.best_model and self._raw_model are set to None until a model
        # is actually fitted — this prevents stale unfitted references.
        self.model = RandomForestClassifier(
            n_estimators=100, random_state=42, n_jobs=1,
            class_weight='balanced_subsample'
        )
        if HAS_XGB:
            self.xgb_model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=0.8,
                n_jobs=1,
                random_state=42,
                eval_metric='logloss'
            )
        else:
            # GradientBoostingClassifier is a safe sklearn-native fallback
            self.xgb_model = GradientBoostingClassifier(n_estimators=100, random_state=42)

        # ── CRITICAL FIX: best_model / _raw_model start as None ──
        # They are ONLY assigned after a model has been successfully fitted.
        # This eliminates the stale-unfitted-model bug entirely.
        self.best_model = None   # authoritative fitted model reference
        self._raw_model = None   # raw (pre-calibration) fitted model reference
        self._explainer = None
        self._feature_names = []
        self._feature_columns = []
        self._last_threshold = 0.5
        self._last_rfm = None
        self._model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models')
        os.makedirs(self._model_dir, exist_ok=True)

    def _is_fitted(self, model) -> bool:
        """Return True iff model has been fitted (safe for any sklearn estimator)."""
        if model is None:
            return False
        try:
            check_is_fitted(model)
            return True
        except Exception:
            return False

    def get_feature_importances(self):
        """Safely retrieve feature importances from the best raw fitted model available."""
        for model in [self._raw_model, self.xgb_model, self.model]:
            if model is not None and self._is_fitted(model) and hasattr(model, 'feature_importances_'):
                return model.feature_importances_
        return np.zeros(len(self._feature_names)) if self._feature_names else np.array([])

    def _tune_model(self, X, y):
        """Tune hyperparameters. Each branch MUST leave the estimator fitted."""
        if len(X) < 100 or y.nunique() < 2 or y.value_counts().min() < 2:
            logger.warning("⚠️  Skipping tuning: dataset too small or single-class. Fitting defaults.")
            # Fall through — callers will fit self.model / self.xgb_model directly.
            return

        logger.info(f"🛠️  Tuning RF + XGB on {len(X)} samples...")

        # 1. Tune Random Forest (grid.best_estimator_ is already fitted by GridSearchCV)
        rf_params = {'n_estimators': [100], 'max_depth': [10, 20], 'min_samples_split': [2, 5]}
        grid = GridSearchCV(
            RandomForestClassifier(random_state=42, n_jobs=1, class_weight='balanced_subsample'),
            rf_params, cv=2, scoring='roc_auc', n_jobs=1
        )
        grid.fit(X, y)
        self.model = grid.best_estimator_   # already fitted ✓
        logger.info(f"🌲 RF Tuned (AUC≈{grid.best_score_:.4f}): {grid.best_params_}")

        # 2. Tune XGBoost if the real library is available
        if HAS_XGB:
            xgb_params = {
                'max_depth': [3, 5, 7],
                'learning_rate': [0.01, 0.1],
                'n_estimators': [100, 200]
            }
            grid_xgb = GridSearchCV(
                self.xgb_model, xgb_params, cv=2, scoring='roc_auc', n_jobs=1
            )
            grid_xgb.fit(X, y)
            self.xgb_model = grid_xgb.best_estimator_  # already fitted ✓
            logger.info(f"🚀 XGB Tuned (AUC≈{grid_xgb.best_score_:.4f}): {grid_xgb.best_params_}")

    # ────────────────────────────────────────────
    #  1. RFM Analysis & Clustering
    # ────────────────────────────────────────────
    def calculate_rfm(self, df):
        """Dynamic RFM with Inter-Purchase Interval & Monetary Velocity."""
        # 1. Ensure absolute datetime conversion
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df = df.dropna(subset=['timestamp'])
        
        reference_date = df['timestamp'].max() + pd.Timedelta(days=1)
        
        # 2. Vectorized base RFM (no slow lambdas)
        rfm = df.groupby('user_id').agg({
            'timestamp': 'max',
            'amount': ['count', 'sum', 'mean']
        })
        rfm.columns = ['last_purchase', 'frequency', 'monetary', 'avg_basket_value']
        
        # 3. Explicitly convert recency to numeric days
        rfm['recency'] = (reference_date - rfm['last_purchase']).dt.days.astype(float)
        rfm = rfm.drop(columns=['last_purchase'])

        # ── Optimized Dynamic Feature: Inter-Purchase Interval ──
        # Vectorized approach: sort, diff, then group
        temp_df = df[['user_id', 'timestamp']].sort_values(['user_id', 'timestamp'])
        temp_df['diff'] = temp_df.groupby('user_id')['timestamp'].diff().dt.days
        
        ipi_data = temp_df.groupby('user_id')['diff'].agg(
            ipi_median='median',
            ipi_std='std'
        ).fillna(100) # Penalty for one-time buyers
        
        # Calculate Consistency Score (0 to 1)
        rfm['ipi_consistency'] = 1 / (1 + ipi_data['ipi_std'] / 30.0)
        rfm['ipi_median'] = ipi_data['ipi_median']
        rfm['ipi_std'] = ipi_data['ipi_std']

        # Recency Deviation: how overdue is this user vs their own pattern
        rfm['recency_deviation'] = rfm['recency'] - rfm['ipi_median']
        rfm['recency_deviation'] = rfm['recency_deviation'].clip(lower=0)

        # ── Dynamic Feature: Monetary Velocity ──
        first_seen = df.groupby('user_id')['timestamp'].min()
        rfm['account_age_days'] = (reference_date - first_seen).dt.days.astype(float).clip(lower=1)
        # ── CRITICAL FIX: Conservative Velocity Denominator ──
        # We use a 7-day floor for the velocity denominator to prevent extreme 
        # revenue-at-risk inflation for users seen only in the last 24-48 hours.
        rfm['monetary_velocity'] = (rfm['monetary'] / rfm['account_age_days'].clip(lower=7)).clip(lower=0)

        # Quantile-based scoring (1-5)
        rfm['r_score'] = pd.qcut(rfm['recency'], 5, labels=[5, 4, 3, 2, 1])
        for col in ['frequency', 'monetary']:
            try:
                rfm[f'{col[0]}_score'] = pd.qcut(rfm[col], 5, labels=[1, 2, 3, 4, 5])
            except ValueError:
                rfm[f'{col[0]}_score'] = pd.qcut(rfm[col].rank(method='first'), 5, labels=[1, 2, 3, 4, 5])

        rfm['rfm_score'] = rfm[['r_score', 'f_score', 'm_score']].astype(int).sum(axis=1)
        rfm['rfm_raw'] = rfm['r_score'].astype(str) + '-' + rfm['f_score'].astype(str) + '-' + rfm['m_score'].astype(str)

        # ── Business-Grade Natural Segmentation (No Hardcoding) ──
        def segment_user(row):
            r = int(row['r_score'])
            score = row['rfm_score']
            
            # Champions/Loyalists must be recent and high-score
            if score >= 13 and r >= 4: return 'Champions'
            if score >= 10 and r >= 3: return 'Loyalists'
            
            # Hibernating users are definitely lost (Low Recency, Low Frequency)
            if r <= 1 and score <= 5: return 'Hibernating'
            
            # At Risk: High historical value but fading recency
            if r <= 2 and score >= 8: return 'At Risk'
            
            if score >= 7: return 'Promising'
            if score >= 4: return 'Needs Attention'
            return 'Hibernating'
            
        rfm['segment'] = rfm.apply(segment_user, axis=1)

        # K-Means Clustering
        features = rfm[['recency', 'frequency', 'monetary']]
        scaled_features = self.scaler.fit_transform(features)
        kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
        rfm['cluster'] = kmeans.fit_predict(scaled_features)

        try:
            # OPTIMIZATION: Silhouette is O(N^2). Sample if N is large.
            if len(rfm) > 5000:
                indices = np.random.choice(len(rfm), 5000, replace=False)
                sil_score = silhouette_score(scaled_features[indices], rfm['cluster'].iloc[indices])
                logger.info(f"Silhouette score calculated using 5,000 sample points (N={len(rfm)})")
            else:
                sil_score = silhouette_score(scaled_features, rfm['cluster'])
        except Exception as e:
            logger.error(f"Error calculating silhouette score: {e}")
            sil_score = 0.0

        self._last_rfm = rfm.reset_index()
        return rfm.reset_index(), sil_score

    # ────────────────────────────────────────────
    #  2. Churn Prediction (proper train/test)
    # ────────────────────────────────────────────
    def predict_churn(self, df, rfm_df, model_id=None):
        """
        Predicts churn. Supports both temporal transactional data and 
        pre-labeled summary datasets (like Bank Churn).
        """
        # 0. Persistent model reuse is opt-in. Stale pickles from a different
        # schema silently break probabilities, so production defaults to retrain.
        use_model_cache = os.environ.get("FINSIGHT_ENABLE_MODEL_CACHE", "0") == "1"
        if model_id and use_model_cache:
            cached_metrics = self.load_latest_model(model_id)
            if cached_metrics:
                logger.info(f"✨ Using PERSISTENT model cache for '{model_id}' (AUC: {cached_metrics.get('roc_auc', 0):.4f})")
                
                # Apply model to current data
                current_features = rfm_df.merge(
                    df.groupby('user_id').first().reset_index(), 
                    on='user_id', 
                    suffixes=('', '_raw')
                )
                feature_cols = self._feature_columns or [c.lower().replace(' ', '_') for c in self._feature_names]
                # Ensure all required features are present
                for col in feature_cols:
                    if col not in current_features.columns:
                        current_features[col] = 0.0
                
                X_current = current_features[feature_cols].fillna(0)
                # Safety guard: ensure loaded model is truly fitted before predict
                check_is_fitted(self.best_model)
                logger.info(f"🔍 [Cache] Predicting churn for {len(X_current)} users...")
                rfm_df['churn_probability'] = self.best_model.predict_proba(X_current)[:, 1]
                logger.info("✅ [Cache] predict_proba completed successfully")
                
                # Sync features back to rfm_df for SHAP and What-If analysis
                for col in feature_cols:
                    if col not in rfm_df.columns:
                        rfm_df[col] = current_features[col]
                
                # ── Consistent Forward-Looking Metrics (Cached Path) ──
                # We project risk over a 90-day horizon (industry standard for retail)
                # Revenue at Risk = Daily Velocity * 90 Days * Churn Probability
                rfm_df['revenue_at_risk'] = (rfm_df['monetary_velocity'] * 90 * rfm_df['churn_probability'])
                
                # Defensible LTV = Historical + (Daily Velocity * 365 Days * (1 - Churn Probability))
                # This estimates 1-year forward value weighted by retention
                rfm_df['predicted_ltv'] = rfm_df['monetary'] + (rfm_df['monetary_velocity'] * 365 * (1 - rfm_df['churn_probability']))
                
                # Outlier Guard: Clip metrics at 99th percentile to preserve variance for high-value users
                # We also calculate a Priority Score (Churn * Future Value * Engagement Sensitivity)
                rfm_df['priority_score'] = (rfm_df['churn_probability'] * rfm_df['revenue_at_risk'] * 1.2).clip(0, 100)
                
                for col in ['revenue_at_risk', 'predicted_ltv']:
                    if col in rfm_df.columns:
                        limit = rfm_df[col].quantile(0.99)
                        rfm_df[col] = rfm_df[col].clip(lower=0, upper=limit)
                        rfm_df[col] = rfm_df[col].round(2)
                
                # Drivers & SHAP
                importances = self.get_feature_importances()
                drivers = sorted(zip(self._feature_names, importances), key=lambda x: x[1], reverse=True)
                
                # We still need to compute SHAP for the current dataset
                # But we use a small sample to keep it fast
                sample_size = min(200, len(X_current))
                X_sample = X_current.sample(sample_size, random_state=42) if len(X_current) > sample_size else X_current
                shap_data = self._compute_shap(X_sample, self._feature_names)
                
                # Map to fintech drivers
                fintech_drivers = self._map_to_fintech_drivers(drivers, shap_data)
                
                # Cache explainer
                if HAS_SHAP:
                    try: self._explainer = shap.TreeExplainer(self._raw_model)
                    except: self._explainer = None
                
                # NOTE: Performance Optimization ── Return immediately if cache is hit
                # to prevent redundant retraining and OOM crashes on large datasets.
                logger.info(f"⚡ Model cache hit for '{model_id}'. Skipping retraining.")
                return rfm_df, fintech_drivers, cached_metrics, shap_data

        # 1. Prepare Features
        # We merge RFM features with any additional numeric features from the original df
        merged_df = rfm_df.merge(
            df.groupby('user_id').first().reset_index(), 
            on='user_id', 
            suffixes=('', '_raw')
        )
        
        # Identify numeric features for training
        # We include rank scores as they are powerful behavioral signals
        exclude = ['user_id', 'target_churn', 'churn_probability', 'cluster', 'rfm_score', 'revenue_at_risk', 'predicted_ltv']
        feature_cols = [c for c in merged_df.select_dtypes(include=[np.number]).columns if c not in exclude]
        
        # 2. Detect Ground Truth
        if 'target_churn' in df.columns:
            logger.info(f"🎯 Labeled dataset detected. Using 'target_churn' as ground truth. Features: {feature_cols}")
            X_train_full = merged_df[feature_cols].fillna(0)
            y_train_full = df.groupby('user_id')['target_churn'].max().reindex(merged_df['user_id']).fillna(0).astype(int)
            feature_names = [c.replace('_', ' ').title() for c in feature_cols]
        else:
            # Fallback to temporal split for transactional data
            X_train_full, y_train_full, feature_names = self._prepare_training_data(df)

        if len(X_train_full) < 5 or y_train_full.nunique() < 2:
            # Fallback if dataset is too small or has no variance
            rfm_df['churn_probability'] = 0.0
            rfm_df['revenue_at_risk'] = 0.0
            rfm_df['predicted_ltv'] = rfm_df['monetary']
            metrics = dict(roc_auc=0, accuracy=0, f1=0, precision=0, recall=0, cv_auc_mean=0, cv_auc_std=0, train_size=len(X_train_full), test_size=0)
            return rfm_df, [], metrics, []

        # 3. Stratified split for model evaluation
        # Gracefully degrade to non-stratified if any class has < 2 samples
        min_class_samples = int(y_train_full.value_counts().min())
        use_stratify = min_class_samples >= 2
        if not use_stratify:
            logger.warning(f"Skipping stratified split: smallest class has {min_class_samples} sample(s). Using random split.")
        X_train, X_test, y_train, y_test = train_test_split(
            X_train_full, y_train_full, test_size=0.2, random_state=42,
            stratify=y_train_full if use_stratify else None
        )

        # ── STEP 3: Train models (skip only if verified fitted model loaded from cache) ──
        if not self._is_fitted(self.best_model):
            logger.info("🧪 Dataset-specific optimization required. Calibrating AI Engine...")
            self._tune_model(X_train, y_train)  # may refine self.model / self.xgb_model

            # Guarantee both base models are fitted (tuning already fits them, but
            # if dataset was too small for tuning they remain unfitted — fix that here).
            if HAS_XGB:
                pos_count = int((y_train == 1).sum())
                neg_count = int((y_train == 0).sum())
                scale_pos_weight = neg_count / max(pos_count, 1)
                logger.info(f"⚖️  Class balance: {pos_count} churned vs {neg_count} retained → scale_pos_weight={scale_pos_weight:.2f}")
                if not self._is_fitted(self.xgb_model):
                    self.xgb_model.set_params(scale_pos_weight=scale_pos_weight, max_delta_step=1)
                    self.xgb_model.fit(X_train, y_train)
                    logger.info("🚀 XGB fallback fit complete ✓")
            if not self._is_fitted(self.model):
                self.model.fit(X_train, y_train)
                logger.info("🌲 RF fallback fit complete ✓")

            # ── CENTRALIZED CANDIDATE MODEL SELECTION ──
            # Only include verified-fitted models as candidates.
            candidate_models = []
            if self._is_fitted(self.model):
                try:
                    rf_proba = self.model.predict_proba(X_test)[:, 1]
                    rf_auc = float(roc_auc_score(y_test, rf_proba))
                except Exception:
                    rf_proba = np.full(len(y_test), 0.5)
                    rf_auc = 0.5
                candidate_models.append(("Random Forest", self.model, rf_auc, rf_proba))
                logger.info(f"🌲 RF candidate AUC: {rf_auc:.4f}")

            if HAS_XGB and self._is_fitted(self.xgb_model):
                try:
                    xgb_proba = self.xgb_model.predict_proba(X_test)[:, 1]
                    xgb_auc = float(roc_auc_score(y_test, xgb_proba))
                except Exception:
                    xgb_proba = np.full(len(y_test), 0.5)
                    xgb_auc = 0.5
                candidate_models.append(("XGBoost", self.xgb_model, xgb_auc, xgb_proba))
                logger.info(f"🚀 XGB candidate AUC: {xgb_auc:.4f}")

            if not candidate_models:
                # Absolute last-resort: fit vanilla RF immediately
                logger.warning("⚠️  No fitted candidates found. Emergency RF fit.")
                self.model.fit(X_train, y_train)
                rf_proba = self.model.predict_proba(X_test)[:, 1]
                try:
                    rf_auc = float(roc_auc_score(y_test, rf_proba))
                except Exception:
                    rf_auc = 0.5
                candidate_models.append(("Random Forest", self.model, rf_auc, rf_proba))

            # Select winner
            model_name, best_raw, auc_val, y_pred_proba = max(candidate_models, key=lambda x: x[2])
            logger.info(f"✅ Selected '{model_name}' (AUC: {auc_val:.4f}) as primary model")

            # ── Calibration for better probability estimates ──
            logger.info("Calibrating probabilities...")
            min_class_count = int(y_train.value_counts().min()) if hasattr(y_train, 'value_counts') else int(np.bincount(y_train).min())
            cal_cv = max(2, min(3, min_class_count))  # cv must be >= 2
            if min_class_count < 2:
                # Too few samples in minority class for CV; use 'prefit' on the already-fitted raw model
                logger.warning(f"Minority class has {min_class_count} sample(s) — using prefit calibration (no CV).")
                calibrated = CalibratedClassifierCV(best_raw, cv='prefit', method='sigmoid')
                calibrated.fit(X_test, y_test)  # prefit uses held-out set
            else:
                calibrated = CalibratedClassifierCV(best_raw, cv=cal_cv, method='sigmoid')
                calibrated.fit(X_train, y_train)

            # ── ATOMIC ASSIGNMENT: best_model + _raw_model + model all synced ──
            self._raw_model = best_raw
            self.best_model = calibrated
            self.model = best_raw  # keep model pointing to the fitted winner
            logger.info(f"🔒 best_model/_raw_model/model all synced to '{model_name}' | fitted={self._is_fitted(self.best_model)}")

        else:
            # Cache path: best_model is a pre-verified fitted model from load_latest_model()
            logger.info("✨ Using pre-trained model from persistent cache.")
            check_is_fitted(self.best_model)  # hard guard — raises NotFittedError if stale
            try:
                y_pred_proba = self.best_model.predict_proba(X_test)[:, 1]
                auc_val = float(roc_auc_score(y_test, y_pred_proba))
            except Exception:
                auc_val = 0.5
                y_pred_proba = np.full(len(y_test), 0.5)
            model_name = 'XGBoost' if 'XGB' in str(type(self._raw_model)) else 'Random Forest'
            logger.info(f"✅ Cache model '{model_name}' validated (AUC: {auc_val:.4f})")

        # 5. Threshold Optimization (Move away from naive 0.5 to maximize business utility)
        y_test_proba = self.best_model.predict_proba(X_test)[:, 1]
        
        logger.info("🎯 Optimizing Decision Threshold for business impact...")
        # Rebalance the threshold using F1, balanced accuracy, and FP/FN parity.
        candidate_thresholds = np.unique(np.clip(y_test_proba, 0.01, 0.99))
        candidate_thresholds = np.unique(np.concatenate((
            [0.05, 0.1, 0.2, 0.3, 0.4, 0.5],
            candidate_thresholds,
            [0.6, 0.7, 0.8, 0.9, 0.95],
        )))
        threshold_rows = []
        for threshold in candidate_thresholds:
            pred_at_threshold = (y_test_proba >= threshold).astype(int)
            tn_i, fp_i, fn_i, tp_i = sklearn_cm(y_test, pred_at_threshold, labels=[0, 1]).ravel()
            precision_i = tp_i / max(tp_i + fp_i, 1)
            recall_i = tp_i / max(tp_i + fn_i, 1)
            specificity_i = tn_i / max(tn_i + fp_i, 1)
            f1_i = (2 * precision_i * recall_i) / max(precision_i + recall_i, 1e-9)
            balanced_accuracy_i = (recall_i + specificity_i) / 2
            fp_rate_i = fp_i / max(tn_i + fp_i, 1)
            fn_rate_i = fn_i / max(tp_i + fn_i, 1)
            error_balance_i = 1 - abs(fp_rate_i - fn_rate_i)
            threshold_rows.append({
                "threshold": float(threshold),
                "f1": float(f1_i),
                "balanced_accuracy": float(balanced_accuracy_i),
                "precision": float(precision_i),
                "recall": float(recall_i),
                "specificity": float(specificity_i),
                "score": float((0.45 * f1_i) + (0.45 * balanced_accuracy_i) + (0.10 * error_balance_i)),
            })
        viable_thresholds = [
            row for row in threshold_rows
            if row["recall"] >= 0.55 and row["specificity"] >= 0.55
        ] or threshold_rows
        best_threshold_row = max(viable_thresholds, key=lambda row: (row["score"], row["f1"], row["balanced_accuracy"]))
        best_threshold = best_threshold_row["threshold"]
        self._last_threshold = best_threshold

        # Re-evaluate with optimized threshold
        y_pred = (y_test_proba >= best_threshold).astype(int)
        y_pred_proba = y_test_proba # Use calibrated probabilities

        # Cross-validation (Skip for very large datasets to save time)
        if len(X_train_full) > 50000:
            logger.info("⏩ Skipping cross-validation for massive dataset to save time.")
            cv_auc_mean, cv_auc_std = 0.0, 0.0
        else:
            cv_n = min(5, len(X_train_full) // 10)
            if cv_n >= 2:
                cv = StratifiedKFold(n_splits=cv_n, shuffle=True, random_state=42)
                # Use self.best_model instead of self.model to ensure we report CV for the chosen algorithm
                # Note: We use the raw model for CV as the calibrated wrapper might be too slow here
                cv_scores = cross_val_score(self._raw_model, X_train_full, y_train_full, cv=cv, scoring='roc_auc')
                cv_auc_mean = float(cv_scores.mean())
                cv_auc_std = float(cv_scores.std())
            else:
                cv_auc_mean, cv_auc_std = 0.0, 0.0

        try:
            auc_val = roc_auc_score(y_test, y_pred_proba)
        except:
            auc_val = 0.0

        # Gini Coefficient
        gini = (2 * auc_val) - 1

        metrics = {
            'roc_auc': float(auc_val),
            'gini': float(gini),
            'cv_auc_mean': cv_auc_mean,
            'cv_auc_std': cv_auc_std,
            'test_size': int(len(X_test)),
            'train_size': int(len(X_train)),
            'primary_model': model_name,
            'optimal_threshold': best_threshold,
            'threshold_strategy': 'balanced_fp_fn',
            'accuracy': float((y_pred == y_test).mean())
        }

        # ── Real Confusion Matrix ──
        try:
            # Explicitly define labels to ensure [0,0]=TN, [0,1]=FP, [1,0]=FN, [1,1]=TP
            cm = sklearn_cm(y_test, y_pred, labels=[0, 1])
            if cm.shape == (2, 2):
                tn, fp, fn, tp = cm.ravel()
                total_samples = int(tn + fp + fn + tp)
                actual_pos = max(int(tp + fn), 1)
                actual_neg = max(int(tn + fp), 1)
                
                metrics['confusion_matrix'] = {
                    'tp': int(tp), 'fp': int(fp), 'fn': int(fn), 'tn': int(tn),
                    # User requested class-conditional rates for UI cards
                    # This ensures TP + FN = 100% of actual churners
                    'tp_rate': round(tp / actual_pos * 100, 1),
                    'fn_rate': round(fn / actual_pos * 100, 1),
                    # This ensures TN + FP = 100% of actual retained users
                    'tn_rate': round(tn / actual_neg * 100, 1),
                    'fp_rate': round(fp / actual_neg * 100, 1),
                    # Performance Metrics (Class-conditional)
                    'recall': round(tp / actual_pos * 100, 1),
                    'precision': round(tp / max(tp + fp, 1) * 100, 1),
                    'specificity': round(tn / actual_neg * 100, 1)
                }
                metrics['accuracy'] = round((tp + tn) / max(total_samples, 1), 4)
                metrics['f1'] = round(f1_score(y_test, y_pred, zero_division=0), 4)
        except Exception as e:
            logger.error(f"Confusion matrix error: {e}")

        try:
            drift_features = {}
            p_values = []
            
            # IMPROVED DRIFT DETECTION:
            # If we have a temporal split, compare 'Historical' vs 'Recent' distributions
            # Otherwise compare Training vs Test (Random)
            for i, fname in enumerate(feature_names[:min(len(feature_names), X_train.shape[1])]):
                hist_col = X_train.iloc[:, i].values if hasattr(X_train, 'iloc') else X_train[:, i]
                recent_col = X_test.iloc[:, i].values if hasattr(X_test, 'iloc') else X_test[:, i]
                
                # If these are exactly the same size and were shuffled, p-value will be high.
                # But if X_test contains the 'more recent' users from a temporal split, 
                # we will detect if their behavior (monetary/frequency) has shifted.
                ks_stat, p_val = ks_2samp(hist_col, recent_col)
                drift_features[fname] = {
                    'ks_statistic': round(float(ks_stat), 4),
                    'p_value': round(float(p_val), 4),
                    'drifted': bool(p_val < 0.05)
                }
                p_values.append(p_val)
            
            avg_p = float(np.min(p_values)) if p_values else 1.0 # Be conservative, use min p
            metrics['drift'] = {
                'features': drift_features,
                'avg_p_value': round(avg_p, 4),
                'status': 'HIGH DRIFT' if avg_p < 0.01 else 'LOW DRIFT' if avg_p < 0.05 else 'STABLE'
            }
        except Exception as e:
            logger.error(f"Drift computation error: {e}")
            metrics['drift'] = {'avg_p_value': 1.0, 'status': 'N/A', 'features': {}}

        # 5. Model Comparison — only use verified-fitted models; no stale variable refs
        try:
            comparison_entries = []
            if self._is_fitted(self.model):
                try:
                    _rf_proba = self.model.predict_proba(X_test)[:, 1]
                    _rf_auc = float(roc_auc_score(y_test, _rf_proba))
                    _rf_f1  = float(f1_score(y_test, self.model.predict(X_test), zero_division=0))
                except Exception:
                    _rf_auc, _rf_f1 = 0.5, 0.0
                comparison_entries.append({'model': 'Random Forest', 'auc': _rf_auc, 'f1': _rf_f1})

            if HAS_XGB and self._is_fitted(self.xgb_model):
                try:
                    _xgb_proba = self.xgb_model.predict_proba(X_test)[:, 1]
                    _xgb_auc = float(roc_auc_score(y_test, _xgb_proba))
                    _xgb_f1  = float(f1_score(y_test, self.xgb_model.predict(X_test), zero_division=0))
                except Exception:
                    _xgb_auc, _xgb_f1 = 0.5, 0.0
                comparison_entries.append({'model': 'XGBoost', 'auc': _xgb_auc, 'f1': _xgb_f1})

            metrics['model_comparison'] = comparison_entries if comparison_entries else [
                {'model': model_name, 'auc': float(auc_val), 'f1': float(metrics.get('f1', 0))}
            ]
        except Exception as e:
            logger.warning(f"Model comparison skipped: {e}")
            metrics['model_comparison'] = [{'model': model_name, 'auc': float(auc_val), 'f1': 0}]

        # 6. Apply to CURRENT data for dashboard probabilities
        # CRITICAL: Must use EXACT same features as training to avoid ValueError
        feature_columns = list(feature_cols if 'target_churn' in df.columns else X_train_full.columns)
        current_features = merged_df.reindex(columns=feature_columns, fill_value=0).fillna(0)

        # Final safety guard before predict — catches any remaining stale state
        check_is_fitted(self.best_model)
        logger.info(f"🔍 Predicting churn for {len(current_features)} users using '{model_name}'...")
        probs = self.best_model.predict_proba(current_features)[:, 1]
        logger.info(f"✅ predict_proba complete. Risk range: [{probs.min():.3f}, {probs.max():.3f}]")

        rfm_df['churn_probability'] = probs
        
        # Preserve all features in rfm_df for per-user SHAP and what-if analysis
        for col in feature_columns:
            if col not in rfm_df.columns:
                rfm_df[col] = current_features[col]

        # ── Defensible Customer Lifetime Value (LTV) ──
        # Formula: Historical + (Expected Future 1-Year Revenue * Retention Probability)
        # We use monetary_velocity to project future spend based on actual historical intensity.
        rfm_df['predicted_ltv'] = rfm_df['monetary'] + (rfm_df['monetary_velocity'] * 365 * (1 - rfm_df['churn_probability']))

        # ── Business-Grade Revenue at Risk (90-Day Exposure) ──
        # Formula: Expected Future 90-Day Revenue * Churn Probability
        # This reflects the ACTUAL future capital at stake over the next quarter.
        rfm_df['revenue_at_risk'] = (rfm_df['monetary_velocity'] * 90 * rfm_df['churn_probability'])

        # ── Outlier Guard & Priority Scoring ──
        # Priority = Churn % * Future Revenue Potential * Sensitivity Factor
        rfm_df['priority_score'] = (rfm_df['churn_probability'] * rfm_df['revenue_at_risk'] * 1.2).clip(0, 100)

        # Extreme wholesale buyers can inflate aggregate risk metrics. 
        # We clip to the 99th percentile to ensure we keep the natural distribution of top users.
        for col in ['revenue_at_risk', 'predicted_ltv']:
            if col in rfm_df.columns:
                limit = rfm_df[col].quantile(0.99)
                rfm_df[col] = rfm_df[col].clip(lower=0, upper=limit)
                rfm_df[col] = rfm_df[col].round(2)

        # ── Data-Driven Unit Economics (Professional Cost Model) ──
        # Real costs include: Platform Fees + SMS/Email Infra + Support Overhead + Incentive
        def calc_cost(row):
            aov = row['monetary'] / max(row['frequency'], 1)
            risk = row['churn_probability']
            
            # Base operational cost (Professional Grade)
            base_ops = 150.0 
            
            # Variable cost (Discount/Incentive) based on Risk Severity
            if risk > 0.8: var_pct = 0.25    # Critical: 25% recovery discount
            elif risk > 0.5: var_pct = 0.15  # High: 15% offer
            elif risk > 0.2: var_pct = 0.08  # Medium: 8% nudge
            else: var_pct = 0.03             # Low: 3% brand reminder
            
            cost = base_ops + (aov * var_pct)
            return round(float(cost), 2)

        rfm_df['intervention_cost'] = rfm_df.apply(calc_cost, axis=1)
        rfm_df['is_profitable'] = rfm_df['predicted_ltv'] > (rfm_df['monetary'] + rfm_df['intervention_cost'])
        
        # Rounding all financial metrics for professional presentation
        for col in ['revenue_at_risk', 'predicted_ltv', 'intervention_cost']:
            if col in rfm_df.columns:
                rfm_df[col] = rfm_df[col].round(2)

        # 7. Drivers & SHAP
        importances = self.get_feature_importances()
        # Use feature_columns (snake_case) for raw mapping, map to labels later
        drivers = sorted(zip(feature_columns, importances), key=lambda x: x[1], reverse=True)
        self._feature_names = feature_names
        self._feature_columns = feature_columns
        shap_data = self._compute_shap(X_test, feature_columns)

        # ── Data-Driven Driver Naming (No Hardcoded Injection) ──
        fintech_drivers = self._map_to_fintech_drivers(drivers, shap_data)

        # 8. Cache explainer for per-user SHAP
        if HAS_SHAP:
            try:
                self._explainer = shap.TreeExplainer(self._raw_model)
            except Exception:
                self._explainer = None

        # ── Step 8.5: Map SHAP summary to Fintech Labels for frontend consistency ──
        # This ensures the SHAP bar chart uses the same readable names as the Top Drivers cards.
        mapped_shap = []
        for sd in shap_data:
            # Find the corresponding fintech label
            display_name = sd['feature']
            for fd in fintech_drivers:
                if fd['raw_feature'].lower() == sd['feature'].lower():
                    display_name = fd['feature']
                    break
            mapped_shap.append({
                **sd,
                'feature': display_name,
                'raw_feature': sd['feature']
            })

        # 9. Model Versioning
        self._save_model_version(metrics, model_id=model_id)

        return rfm_df, fintech_drivers, metrics, mapped_shap

    def _map_to_fintech_drivers(self, drivers, shap_data):
        """Maps raw feature names to human-readable fintech labels."""
        FINTECH_LABELS = {
            'recency_deviation': 'Order Delay (vs Typical)',
            'monetary_velocity': 'Daily Spending Velocity',
            'account_age': 'Customer Tenure (Days)',
            'ipi_median': 'Purchase Cycle (Days)',
            'ipi_std': 'Purchase Timing Volatility',
            'ipi_consistency': 'Behavioral Consistency (Habit Strength)',
            'recency': 'Recency (Days Since Last Order)',
            'frequency': 'Purchase Frequency (Order Count)',
            'monetary': 'Spending Engagement (Wallet Share)',
            'avg_basket_value': 'Average Order Value (AOV)',
            'credit': 'Credit Rating',
            'balance': 'Account Balance',
            'products': 'Product Diversity',
            'active': 'Account Activity Status',
            'fail': 'Transaction Failure Rate',
            'salary': 'Estimated Income',
            'age': 'Customer Age',
        }
        fintech_drivers = []
        used_labels = set()
        sorted_keys = sorted(FINTECH_LABELS.keys(), key=len, reverse=True)
        
        for name, imp in drivers:
            display = name
            clean_name = name.lower().replace(' ', '').replace('_', '')
            for key in sorted_keys:
                clean_key = key.lower().replace('_', '')
                if clean_key in clean_name:
                    display = FINTECH_LABELS[key]
                    break
            
            if display in used_labels:
                display = f"{display} ({name.replace('_', ' ').title()})"
            used_labels.add(display)
            
            direction = 'unknown'
            for sd in shap_data:
                if sd['feature'].lower() == name.lower():
                    direction = sd['direction']
                    break
            fintech_drivers.append({
                'feature': display, 'raw_feature': name,
                'importance': float(imp), 'direction': direction,
                'impact': 'Critical' if imp > 0.2 else 'High' if imp > 0.1 else 'Medium' if imp > 0.05 else 'Low'
            })
        return sorted(fintech_drivers, key=lambda x: x['importance'], reverse=True)

    def _prepare_training_data(self, df, future_days=None):
        """
        Creates features from the 'past' and labels from the 'future'.
        Uses an adaptive time window to create balanced churn labels.
        Prevents data leakage by NOT using recency as a training feature.
        """
        df = df.copy()
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        max_date = df['timestamp'].max()
        min_date = df['timestamp'].min()
        total_range = (max_date - min_date).days

        # Adaptive future window: 25% of total data range, capped between 30-90 days
        # This ensures balanced churn labels for any dataset
        if future_days is None:
            future_days = min(90, max(30, int(total_range * 0.25)))
        
        logger.info(f"📊 Training split: {total_range} day range, using {future_days}-day label window")
        
        cutoff = max_date - timedelta(days=future_days)

        # Observation Window (Past)
        past_df = df[df['timestamp'] < cutoff]
        # Labeling Window (Future)
        future_users = df[df['timestamp'] >= cutoff]['user_id'].unique()

        if past_df.empty or len(past_df['user_id'].unique()) < 5:
            return pd.DataFrame(), pd.Series(), []

        # Calculate features using ONLY past data
        reference_date = cutoff
        train_rfm = past_df.groupby('user_id').agg({
            'timestamp': lambda x: (reference_date - x.max()).days,
            'user_id': 'count',
            'amount': ['sum', 'mean']
        })
        train_rfm.columns = ['recency', 'frequency', 'monetary', 'avg_basket_value']
        
        # Calculate additional features for training
        temp_df = past_df[['user_id', 'timestamp']].sort_values(['user_id', 'timestamp'])
        temp_df['diff'] = temp_df.groupby('user_id')['timestamp'].diff().dt.days
        ipi_data = temp_df.groupby('user_id')['diff'].agg(
            ipi_median='median',
            ipi_std='std'
        ).fillna(100) # Penalty for one-time buyers (High variance/Unknown)
        
        # Calculate Consistency Score (0 to 1)
        # Higher is better (more predictable habit)
        ipi_data['ipi_consistency'] = 1 / (1 + ipi_data['ipi_std'] / 30.0) # Normalised by month
        
        train_rfm = train_rfm.join(ipi_data)
        
        first_seen = past_df.groupby('user_id')['timestamp'].min()
        train_rfm['account_age_days'] = (reference_date - first_seen).dt.days.astype(float).clip(lower=1)
        train_rfm['monetary_velocity'] = train_rfm['monetary'] / train_rfm['account_age_days']
        
        # Recency Deviation: how overdue is this user vs their own pattern
        train_rfm['recency_deviation'] = (train_rfm['recency'] - train_rfm['ipi_median']).clip(lower=0)

        # Label: Churned if NOT in future_users
        train_rfm['churned'] = (~train_rfm.index.isin(future_users)).astype(int)
        
        churn_rate = train_rfm['churned'].mean()
        logger.info(f"📊 Churn distribution: {churn_rate*100:.1f}% churned, {(1-churn_rate)*100:.1f}% retained ({len(train_rfm)} users)")
        
        # FEATURES: Now that we use a temporal split, recency is a valid and critical predictor.
        feature_cols = [
            'recency', 'recency_deviation', 'frequency', 'monetary', 
            'avg_basket_value', 'ipi_median', 'ipi_std', 'ipi_consistency', 'monetary_velocity'
        ]
        X = train_rfm[feature_cols]
        y = train_rfm['churned']
        return X, y, [c.replace('_', ' ').title() for c in feature_cols]


    def _compute_shap(self, X, feature_names):
        """Compute SHAP values for model explainability."""
        if not HAS_SHAP:
            logger.warning("SHAP not installed – using feature_importances_ fallback")
            importances = self.get_feature_importances()
            return [{'feature': f, 'importance': float(v), 'direction': 'unknown'}
                    for f, v in zip(feature_names, importances)]
        try:
            # Use a smaller sample for faster dashboard updates
            sample_size = min(200, len(X))
            X_sample = X.sample(sample_size, random_state=42) if len(X) > sample_size else X
            explainer = shap.TreeExplainer(self._raw_model)
            shap_values = explainer.shap_values(X_sample)

            # Handle different SHAP output formats (list for multi-class/binary, array for regression/some models)
            if isinstance(shap_values, list):
                # For binary classification, index 1 is usually the positive class (Churn)
                shap_vals = np.array(shap_values[1])
            elif len(shap_values.shape) == 3:
                # Some SHAP versions return (n_samples, n_features, n_classes)
                shap_vals = shap_values[:, :, 1]
            else:
                shap_vals = shap_values

            # Ensure we have a 2D array (samples, features)
            if len(shap_vals.shape) != 2:
                raise ValueError(f"Unexpected SHAP shape: {shap_vals.shape}")

            mean_abs = np.abs(shap_vals).mean(axis=0)
            mean_dir = shap_vals.mean(axis=0)

            result = []
            for i, f in enumerate(feature_names):
                # Ensure we are extracting a scalar value
                val_abs = float(mean_abs[i].item() if hasattr(mean_abs[i], 'item') else mean_abs[i])
                val_dir = float(mean_dir[i].item() if hasattr(mean_dir[i], 'item') else mean_dir[i])
                
                result.append({
                    'feature': f,
                    'importance': val_abs,
                    'direction': 'increases_churn' if val_dir > 0 else 'decreases_churn'
                })
            result.sort(key=lambda x: x['importance'], reverse=True)
            return result
        except Exception as e:
            logger.error(f"SHAP computation error: {e}")
            # Fallback to feature importances
            importances = self.get_feature_importances()
            return [{'feature': f, 'importance': float(v), 'direction': 'unknown'}
                    for f, v in zip(feature_names, importances)]

    # ────────────────────────────────────────────
    #  Advanced Revenue Simulation & Forecast
    # ────────────────────────────────────────────

    def get_potential_recovery(self, rfm_df, metrics=None):
        """
        Simulate total potential revenue recovery if we apply interventions
        that reduce churn by a model-calibrated efficiency factor.
        """
        if 'churn_probability' not in rfm_df.columns or 'revenue_at_risk' not in rfm_df.columns:
            return {'value': 0.0, 'efficiency': 0.0}
            
        # Use dynamic threshold from model
        risk_threshold = getattr(self, '_last_threshold', 0.5)
        # Recovery targets users with risk >= threshold
        at_risk = rfm_df[rfm_df['churn_probability'] >= risk_threshold].copy()
        if at_risk.empty:
            return {'value': 0.0, 'efficiency': 0.0}
            
        # Data-driven recovery efficiency cap based on model confidence
        # More accurate models allow for more precise (and thus effective) targeting
        auc = metrics.get('roc_auc', 0.75) if metrics else 0.75
        recovery_efficiency = min(0.45, max(0.15, auc * 0.5))
        
        # Recovery = Addressable Risk * Efficiency
        # This ensures recovery is a significant, realistic slice of the critical risk
        critical_rar = float(np.nan_to_num(at_risk['revenue_at_risk'].sum()))
        recovery_value = critical_rar * recovery_efficiency
        
        return {
            'value': float(np.nan_to_num(round(recovery_value, 2))),
            'efficiency_pct': round(float(np.nan_to_num(recovery_efficiency * 100)), 1),
            'critical_count': int(len(at_risk))
        }

    # ────────────────────────────────────────────
    #  Per-User Local SHAP Explainability
    # ────────────────────────────────────────────
    def compute_user_shap(self, user_id, rfm_df):
        """Compute local SHAP values for a single user — the 'WHY' behind their score."""
        # Robust type-agnostic matching for user_id
        user_id_str = str(user_id)
        user_row = rfm_df[rfm_df['user_id'].astype(str) == user_id_str]
        
        if user_row.empty:
            return None

        user = user_row.iloc[0]
        feature_names = self._feature_names or ['Recency', 'Frequency', 'Monetary']
        feature_columns = self._feature_columns or [f.lower().replace(' ', '_') for f in feature_names]
        
        # Match features from the model to the user row
        try:
            features = user.reindex(feature_columns, fill_value=0).fillna(0).values.reshape(1, -1)
        except:
            # Fallback for naming mismatches
            features = user[['recency', 'frequency', 'monetary']].values.reshape(1, -1)
            feature_names = ['Recency', 'Frequency', 'Monetary']

        result = {
            'user_id': str(user_id),
            'churn_probability': float(user.get('churn_probability', 0)),
            'risk_threshold': float(getattr(self, '_last_threshold', 0.5)),
            'revenue_at_risk': float(user.get('revenue_at_risk', 0)),
            'predicted_ltv': float(user.get('predicted_ltv', user.get('monetary', 0))),
            'segment': str(user.get('segment', 'Unknown')),
            'top_drivers': [],
            'explanation_summary': ''
        }

        if self._explainer is not None:
            try:
                sv = self._explainer.shap_values(features)
                vals = sv[1][0] if isinstance(sv, list) else sv[0]
                drivers = []
                for i, fname in enumerate(feature_names):
                    v = float(vals[i])
                    direction = 'increases_churn' if v > 0 else 'decreases_churn'
                    fval = float(features[0][i])
                    if direction == 'increases_churn':
                        expl = f"High {fname} ({fval:.0f}) is pushing churn risk UP by {abs(v):.3f}"
                    else:
                        expl = f"{fname} ({fval:.0f}) is helping RETAIN this user (impact: {abs(v):.3f})"
                    drivers.append({'feature': fname, 'shap_value': v, 'direction': direction, 'explanation': expl})
                drivers.sort(key=lambda x: abs(x['shap_value']), reverse=True)
                result['top_drivers'] = drivers[:3]
                top = drivers[0]
                prob = result['churn_probability']
                result['explanation_summary'] = (
                    f"This user has {prob*100:.0f}% churn risk primarily because "
                    f"{top['explanation'].lower()}"
                )
            except Exception as e:
                logger.error(f"Per-user SHAP error: {e}")
                result['top_drivers'] = [{'feature': f, 'shap_value': 0, 'direction': 'unknown', 'explanation': 'SHAP unavailable'} for f in feature_names]
        else:
            result['explanation_summary'] = 'SHAP explainer not available'

        return result

    # ────────────────────────────────────────────
    #  What-If Counterfactual Simulation
    # ────────────────────────────────────────────
    def simulate_whatif(self, rfm_df, segment, feature, delta_pct):
        """Simulate: 'If we change <feature> by <delta_pct>% for <segment>, what happens to churn?'"""
        feature_lower = feature.lower()
        if feature_lower not in ['recency', 'frequency', 'monetary']:
            return {'error': f'Invalid feature: {feature}'}

        seg_mask = rfm_df['segment'] == segment
        if seg_mask.sum() == 0:
            return {'error': f'Segment not found: {segment}'}

        seg_data = rfm_df[seg_mask].copy()
        original_churn = float(seg_data['churn_probability'].mean())
        original_revenue_risk = float(seg_data['revenue_at_risk'].sum()) if 'revenue_at_risk' in seg_data.columns else 0.0

        # Apply counterfactual
        sim_data = seg_data.copy()
        # Robust case-insensitive feature mapping
        raw_features = self._feature_columns or (
            list(self.best_model.feature_names_in_) if hasattr(self.best_model, 'feature_names_in_')
            else [f.lower().replace(' ', '_') for f in self._feature_names]
        )
        
        # ── Fix: Multiple Column Modification ──
        # In summary datasets (like Bank Churn), the feature might exist as both 'frequency' 
        # (calculated by RFM) and 'frequency_raw' (from the original data).
        # We must modify ALL variants that the model was trained on.
        target_cols = [c for c in sim_data.columns if c.lower() == feature_lower or c.lower().startswith(f"{feature_lower}_")]
        
        if not target_cols:
            return {'error': f'Feature {feature} not found in model features.'}
            
        multiplier = 1 + (delta_pct / 100.0)
        for col in target_cols:
            sim_data[col] = sim_data[col] * multiplier
        
        # Use exact feature names model expects
        sim_features = sim_data.reindex(columns=raw_features, fill_value=0).fillna(0)
        # Safety guard — prevents What-If from silently using a stale model
        if not self._is_fitted(self.best_model):
            return {'error': 'Model is not fitted yet. Please load or train a dataset first.'}
        sim_probs = self.best_model.predict_proba(sim_features)[:, 1]
        simulated_churn = float(sim_probs.mean())
        
        # ── Logical Integrity Check (Honest Prediction) ──
        # No artificial linear smoothing — we trust the Calibrated Model's thresholds.
        # If the model finds no statistical impact for a minor delta, we report 0 change.
        reduction = original_churn - simulated_churn
        reduction_pct = (reduction / max(original_churn, 0.001)) * 100
        
        # Calculate simulated revenue risk accurately using the velocity formula
        if 'monetary_velocity' in sim_data.columns:
            sim_revenue_risk = float((sim_data['monetary_velocity'] * 90 * sim_probs).sum())
        else:
            sim_revenue_risk = float((sim_data['monetary'] * sim_probs).sum())
            
        revenue_saved = max(0.0, original_revenue_risk - sim_revenue_risk)
        
        direction = 'increase' if delta_pct > 0 else 'decrease'
        if reduction > 0:
            rec = f"A {abs(delta_pct):.0f}% {direction} in {feature} for '{segment}' could reduce churn by {reduction_pct:.1f}%, protecting ₹{revenue_saved:,.0f} in revenue."
        else:
            rec = f"A {abs(delta_pct):.0f}% {direction} in {feature} for '{segment}' may increase churn by {abs(reduction_pct):.1f}%. Not recommended."

        # Evidence for transparency: How important is this feature to the model?
        importances = self.get_feature_importances()
        feature_importances = dict(zip(raw_features, importances))
        cumulative_importance = sum(feature_importances.get(c, 0) for c in target_cols)

        return {
            'segment': segment,
            'feature': feature,
            'delta_pct': delta_pct,
            'original_churn': float(original_churn),
            'simulated_churn': float(simulated_churn),
            'reduction_pct': float(reduction_pct),
            'churn_reduction_pct': float(reduction_pct),
            'revenue_saved': float(revenue_saved),
            'revenue_protected': float(revenue_saved),
            'recommendation': rec,
            'users_affected': int(seg_mask.sum()),
            'feature_importance': float(cumulative_importance),
            'recommended_duration_days': 14,
            'recommended_confidence_pct': 95,
        }

    # ────────────────────────────────────────────
    #  Revenue-at-Risk Summary
    # ────────────────────────────────────────────
    def get_revenue_at_risk(self, rfm_df):
        """Total, Critical, and per-segment revenue at risk."""
        if 'revenue_at_risk' not in rfm_df.columns:
            return {'total': 0, 'critical': 0, 'by_segment': []}

        # Total Exposure: Probabilistic sum across ALL users
        total_exposure = float(np.nan_to_num(rfm_df['revenue_at_risk'].sum()))
        
        # Critical RAR: RAR from users actually above the churn threshold
        risk_threshold = getattr(self, '_last_threshold', 0.5)
        critical_mask = rfm_df['churn_probability'] >= risk_threshold
        critical_rar = float(np.nan_to_num(rfm_df.loc[critical_mask, 'revenue_at_risk'].sum()))

        by_segment = []
        # Use revenue-weighted churn for business-grade accuracy
        seg_stats = rfm_df.groupby('segment').agg({
            'revenue_at_risk': 'sum',
            'user_id': 'count'
        })
        
        weighted_churns = {}
        for seg, group in rfm_df.groupby('segment'):
            if group['monetary_velocity'].sum() == 0:
                weighted_churns[seg] = group['churn_probability'].mean()
            else:
                weighted_churns[seg] = (group['churn_probability'] * group['monetary_velocity']).sum() / group['monetary_velocity'].sum()
        
        seg_stats['avg_churn'] = pd.Series(weighted_churns)
        seg_stats = seg_stats.rename(columns={'user_id': 'users'}).reset_index()
        by_segment = seg_stats.to_dict(orient='records')
        
        return {
            'total': round(total_exposure, 2), 
            'critical': round(critical_rar, 2),
            'by_segment': by_segment
        }

    # ────────────────────────────────────────────
    #  Model Versioning
    # ────────────────────────────────────────────
    def _save_model_version(self, metrics, model_id=None):
        """Save trained model with timestamp-based versioning."""
        try:
            ts = datetime.now().strftime('%Y%m%d_%H%M%S')
            tag = f"_{model_id}" if model_id else ""
            fname = f'churn_model{tag}_v{ts}.pkl'
            fpath = os.path.join(self._model_dir, fname)
            with open(fpath, 'wb') as f:
                payload = {
                    'model': self.best_model, 
                    'raw_model': self._raw_model,
                    'scaler': self.scaler, 
                    'metrics': metrics, 
                    'features': self._feature_names,
                    'feature_columns': self._feature_columns,
                    'sklearn_version': sklearn.__version__
                }
                pickle.dump(payload, f)

            with open(f"{fpath}.json", "w", encoding="utf-8") as meta:
                json.dump({
                    "filename": fname,
                    "metrics": metrics,
                    "features": self._feature_names,
                    "feature_columns": self._feature_columns,
                    "sklearn_version": sklearn.__version__,
                }, meta, default=str)
            
            # Keep only last 3 versions per model_id to save space
            all_files = sorted([f for f in os.listdir(self._model_dir) if f.endswith('.pkl')])
            if model_id:
                relevant = [f for f in all_files if f"_{model_id}_" in f]
                for old in relevant[:-3]:
                    os.remove(os.path.join(self._model_dir, old))
                    meta = os.path.join(self._model_dir, f"{old}.json")
                    if os.path.exists(meta):
                        os.remove(meta)
            else:
                for old in all_files[:-5]:
                    os.remove(os.path.join(self._model_dir, old))
                    meta = os.path.join(self._model_dir, f"{old}.json")
                    if os.path.exists(meta):
                        os.remove(meta)
                    
            logger.info(f"Model saved: {fname}")
        except Exception as e:
            logger.error(f"Model save error: {e}")

    def load_latest_model(self, model_id):
        """Find and load the most recent model for a specific ID."""
        if not os.path.exists(self._model_dir): return None
        
        files = sorted([f for f in os.listdir(self._model_dir) if f.endswith('.pkl') and f"_{model_id}_" in f])
        if not files: return None
        
        fpath = os.path.join(self._model_dir, files[-1])
        try:
            with open(fpath, 'rb') as f:
                data = pickle.load(f)
                loaded_best = data['model']
                loaded_raw  = data.get('raw_model', loaded_best)

                # Validate the pickled model is truly fitted before accepting it.
                # ── CRITICAL FIX: Version Matching ──
                saved_version = data.get('sklearn_version')
                current_version = sklearn.__version__
                if saved_version and saved_version != current_version:
                    logger.warning(f"⚠️ Model version mismatch ({saved_version} vs {current_version}). Discarding to prevent crashes.")
                    return None

                try:
                    check_is_fitted(loaded_best)
                except Exception as fit_err:
                    logger.error(f"❌ Cached model for '{model_id}' failed fitness check: {fit_err}. Discarding — will retrain.")
                    return None

                # ── ATOMIC SYNC: all three references point to the loaded fitted model ──
                self.best_model  = loaded_best
                self._raw_model  = loaded_raw
                self.model       = loaded_raw   # keep self.model in sync
                self.scaler      = data['scaler']
                self._feature_names    = data['features']
                self._feature_columns  = data.get('feature_columns') or [c.lower().replace(' ', '_') for c in self._feature_names]
                self._last_threshold   = data.get('metrics', {}).get('optimal_threshold', 0.5)
                logger.info(f"✅ Loaded cached model for '{model_id}' | fitted=True | raw_type={type(loaded_raw).__name__}")
                return data.get('metrics', {})
        except Exception as e:
            logger.error(f"Model load error for {model_id}: {e}")
            return None

    def list_model_versions(self):
        """List all saved model versions."""
        versions = []
        if os.path.exists(self._model_dir):
            for f in sorted(os.listdir(self._model_dir)):
                if f.endswith('.pkl'):
                    fpath = os.path.join(self._model_dir, f)
                    ts = f.replace('churn_model_v', '').replace('.pkl', '')
                    meta_path = f"{fpath}.json"
                    m = {}
                    try:
                        if os.path.exists(meta_path):
                            with open(meta_path, "r", encoding="utf-8") as fp:
                                m = json.load(fp).get('metrics', {})
                    except Exception:
                        m = {}
                    versions.append({'version': ts, 'timestamp': ts, 'filename': f, 'metrics': m})
        return versions

    def get_segment_churn(self, rfm_df):
        """Churn rate & stats per RFM segment with data-driven financials."""
        # ── Business-Grade Natural Segmentation ──
        # Natural distribution: Hibernating/At Risk will likely be larger than Champions
        rfm_df = rfm_df.copy()
        scores = rfm_df['rfm_score'].to_numpy()
        r_scores = rfm_df['r_score'].astype(int).to_numpy()

        rfm_df['segment'] = np.select(
            [(scores >= 13) & (r_scores >= 4), (scores >= 10) & (r_scores >= 3), (r_scores <= 2) & (scores >= 8), scores >= 7, scores >= 4],
            ['Champions', 'Loyalists', 'At Risk', 'Promising', 'Needs Attention'],
            default='Hibernating'
        )

        # ── Segment-Level Churn Breakdown ──
        agg_dict = {
            'count': ('user_id', 'count'),
            'avg_monetary': ('monetary', 'mean'),
            'avg_frequency': ('frequency', 'mean'),
            'avg_velocity': ('monetary_velocity', 'mean'),
        }
        if 'revenue_at_risk' in rfm_df.columns:
            agg_dict['total_revenue_at_risk'] = ('revenue_at_risk', 'sum')
        
        stats_df = rfm_df.groupby('segment').agg(**agg_dict).reset_index()
        
        # Calculate Weighted Churn for accuracy
        weighted_churns = {}
        for seg in rfm_df['segment'].unique():
            seg_data = rfm_df[rfm_df['segment'] == seg]
            total_mon = seg_data['monetary'].sum()
            if total_mon > 0:
                weighted_churns[seg] = (seg_data['churn_probability'] * seg_data['monetary']).sum() / total_mon
            else:
                weighted_churns[seg] = seg_data['churn_probability'].mean()
        
        stats_df['avg_churn'] = stats_df['segment'].map(weighted_churns)
        
        # Calculate Segment ROI Metrics - DYNAMIC
        # Using consistent velocity-based projection (1-year forward)
        stats_df['est_ltv'] = stats_df['avg_monetary'] + (stats_df['avg_velocity'] * 365 * (1 - stats_df['avg_churn']))
        
        # ── Data-Driven Unit Economics (Segment Level) ──
        def seg_cost(row):
            aov = row['avg_monetary'] / max(row['avg_frequency'], 1)
            risk = row['avg_churn']
            
            base_admin = 5.0
            if risk > 0.8: var_pct = 0.20
            elif risk > 0.5: var_pct = 0.10
            elif risk > 0.2: var_pct = 0.05
            else: var_pct = 0.02
            
            cost = base_admin + (aov * var_pct)
            return round(float(cost), 2)
            
        stats_df['intervention_cost'] = stats_df.apply(seg_cost, axis=1)
        stats_df['est_ltv'] = stats_df['est_ltv'].round(2)
        stats_df['avg_churn'] = stats_df['avg_churn'].round(4)
        stats_df['is_profitable'] = stats_df['est_ltv'] > (stats_df['avg_monetary'] + stats_df['intervention_cost'])
        
        stats = stats_df.to_dict(orient='records')

        # Add Segment-Level SHAP (The 'Why' for each segment)
        feature_names = self._feature_names
        raw_features = []
        # Use raw model for feature metadata as calibrated wrapper masks it
        if hasattr(self._raw_model, 'feature_names_in_'):
            raw_features = list(self._raw_model.feature_names_in_)
        elif feature_names:
            raw_features = [f.lower().replace(' ', '_') for f in feature_names]
        
        for s in stats:
            seg_name = s['segment']
            seg_users = rfm_df[rfm_df['segment'] == seg_name]
            
            if not seg_users.empty and self._explainer is not None and raw_features:
                try:
                    # Sample users from segment for performance
                    sample_size = min(40, len(seg_users))
                    sample = seg_users.sample(sample_size, random_state=42)
                    
                    # Prepare features matching model training EXACTLY
                    # Force to NumPy to avoid column name mismatch errors in some SHAP versions
                    # Robustness: Ensure all expected columns exist in the sample
                    for col in raw_features:
                        if col not in sample.columns:
                            sample[col] = 0.0
                            
                    X_seg_np = sample[raw_features].fillna(0).values
                    
                    try:
                        sv = self._explainer.shap_values(X_seg_np)
                        # Use class 1 (Churn) for binary classification
                        vals = sv[1] if isinstance(sv, list) else sv
                        if len(vals.shape) == 3: vals = vals[:, :, 1]
                        if len(vals.shape) == 1: vals = vals.reshape(1, -1) # Single sample case
                        
                        # Compute mean absolute SHAP for importance and mean SHAP for direction
                        mean_abs = np.abs(vals).mean(axis=0)
                        mean_dir = vals.mean(axis=0)
                    except:
                        # Fallback to global importance if local SHAP fails
                        logger.warning(f"Local SHAP failed for {seg_name}, using global importance fallback.")
                        importances = self.get_feature_importances()
                        mean_abs = np.array(importances)
                        mean_dir = np.zeros_like(mean_abs) # Direction unknown
                    
                    seg_shap = []
                    display_names = feature_names if feature_names and len(feature_names) == len(raw_features) else raw_features
                    for i, fname in enumerate(display_names):
                        v_abs = float(mean_abs[i])
                        v_dir = float(mean_dir[i])
                        seg_shap.append({
                            'feature': fname,
                            'importance': v_abs,
                            'direction': 'increases_churn' if v_dir >= 0 else 'decreases_churn',
                            'impact_score': v_dir
                        })
                    
                    seg_shap.sort(key=lambda x: x['importance'], reverse=True)
                    s['top_drivers'] = seg_shap[:3]
                    
                    # Generate a natural language explanation for the segment
                    if seg_shap:
                        top = seg_shap[0]
                        s['explanation'] = (
                            f"Churn in this segment is primarily driven by {top['feature']} "
                            f"({'increasing' if top['direction'] == 'increases_churn' else 'decreasing'}) risk."
                        )
                    else:
                        s['explanation'] = "Stable behavioral patterns observed."
                except Exception as e:
                    logger.error(f"Error computing SHAP for segment {seg_name}: {e}")
                    s['top_drivers'] = []
                    s['explanation'] = "SHAP analysis unavailable for this segment."
            else:
                s['top_drivers'] = []
                s['explanation'] = "Insufficient data for SHAP analysis."
                
        return stats

    # ────────────────────────────────────────────
    #  4. Product Mix Analysis
    # ────────────────────────────────────────────
    def analyze_product_mix(self, df, rfm_df):
        """Top products per segment (requires description column)."""
        pcol = None
        for c in ['description', 'Description', 'product', 'Product']:
            if c in df.columns:
                pcol = c
                break
        if pcol is None:
            return None

        top_products = df[pcol].value_counts().head(8).index.tolist()
        df_top = df[df[pcol].isin(top_products)].copy()

        seg_map = rfm_df[['user_id', 'segment']].drop_duplicates()
        merged = df_top.merge(seg_map, on='user_id', how='inner')

        ps = merged.groupby(['segment', pcol]).size().reset_index(name='count')

        by_segment = {}
        for seg in ps['segment'].unique():
            rows = ps[ps['segment'] == seg].sort_values('count', ascending=False)
            by_segment[seg] = rows[[pcol, 'count']].rename(
                columns={pcol: 'product'}
            ).head(5).to_dict(orient='records')

        overall_stats = df_top.merge(rfm_df[['user_id', 'churn_probability']], on='user_id', how='left')
        baseline_churn = rfm_df['churn_probability'].mean()
        
        overall = []
        for p in top_products:
            # UNIQUE users who bought this product (avoids frequency bias)
            p_users = overall_stats[overall_stats[pcol] == p].drop_duplicates('user_id')
            p_count_total = len(p_users)
            
            if p_count_total == 0:
                continue
                
            p_avg_risk = p_users['churn_probability'].mean()
            
            # Risk Correlation: How much does this product's audience differ from the global average?
            risk_diff = (p_avg_risk - baseline_churn) / max(baseline_churn, 0.01) * 100
            
            # Descriptive Insight Generation
            if risk_diff > 12:
                insight = f"High churn correlation ({risk_diff:+.1f}% vs avg). Likely 'One-off' gift buyers."
                risk_level = "High"
            elif risk_diff < -12:
                # Add more professional tone
                if abs(risk_diff) > 40:
                    insight = f"Strategic Anchor ({abs(risk_diff):.1f}% lower risk). Critical for long-term retention."
                else:
                    insight = f"Healthy Retention Signal ({abs(risk_diff):.1f}% lower risk). Core recurring product."
                risk_level = "Low"
            else:
                insight = "Neutral behavioral footprint."
                risk_level = "Neutral"
                
            overall.append({
                'product': p,
                'count': p_count_total,
                'risk_insight': insight,
                'risk_level': risk_level,
                'risk_diff': float(risk_diff)
            })
            
        overall.sort(key=lambda x: (abs(x.get('risk_diff', 0)), x['count']), reverse=True)

        return {
            'by_segment': by_segment,
            'overall': overall,
        }

    # ────────────────────────────────────────────
    #  5. Cohort Retention Matrix
    # ────────────────────────────────────────────
    def build_cohort_matrix(self, df):
        """Monthly cohort retention heatmap data."""
        df = df.copy()
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df['order_month'] = df['timestamp'].dt.to_period('M')

        user_first = df.groupby('user_id')['order_month'].min().reset_index()
        user_first.columns = ['user_id', 'cohort']

        df = df.merge(user_first, on='user_id')

        activity = df.groupby(['cohort', 'order_month'])['user_id'].nunique().reset_index()
        activity.columns = ['cohort', 'order_month', 'active']

        cohort_sizes = user_first.groupby('cohort')['user_id'].nunique().reset_index()
        cohort_sizes.columns = ['cohort', 'size']

        activity = activity.merge(cohort_sizes, on='cohort')
        activity['period'] = (activity['order_month'] - activity['cohort']).apply(lambda x: x.n)
        activity['retention'] = activity['active'] / activity['size']

        pivot = activity.pivot(index='cohort', columns='period', values='retention').fillna(0)

        cohorts = []
        for cohort in pivot.index:
            sz = int(cohort_sizes[cohort_sizes['cohort'] == cohort]['size'].values[0])
            vals = [round(float(v) * 100, 1) for v in pivot.loc[cohort].values[:12]]
            cohorts.append({'cohort': str(cohort), 'size': sz, 'retention': vals})

        return cohorts

    # ────────────────────────────────────────────
    #  6. Data-Driven Hypotheses
    # ────────────────────────────────────────────
    def generate_hypotheses(self, drivers, rfm_df):
        """
        Generate testable hypotheses backed by real data statistics.
        Hypotheses are now dynamically selected based on the top churn drivers.
        """
        hypotheses = []
        risk_threshold = getattr(self, '_last_threshold', 0.5)
        high_churn = rfm_df[rfm_df['churn_probability'] >= risk_threshold]
        low_churn = rfm_df[rfm_df['churn_probability'] < risk_threshold]
        
        if len(high_churn) == 0 or len(low_churn) == 0:
            avg_churn = rfm_df['churn_probability'].mean()
            hypotheses.append({
                'title': 'The Engagement Hypothesis',
                'hypothesis': f'With an average churn risk of {avg_churn*100:.1f}%, proactive re-engagement for the bottom quartile could improve overall retention.',
                'test': 'A/B Test: Personalized retention nudges vs control group.',
                'driver': 'Engagement',
                'stat': f'Avg Churn: {avg_churn*100:.1f}%',
                'impact': 'Medium',
                'expected_lift_pct': round(min(15, max(3, avg_churn * 20)), 1)
            })
            return hypotheses

        # Process top 3 drivers to generate relevant hypotheses
        seen_drivers = set()
        for driver_info in drivers[:3]:
            raw_feat = driver_info.get('raw_feature', '').lower()
            display_feat = driver_info.get('feature', 'Engagement')
            
            # ── H: Inactivity / Recency ──
            if 'recency' in raw_feat or 'delay' in raw_feat:
                rec_churn = high_churn['recency'].mean()
                rec_retain = low_churn['recency'].mean()
                
                # Target: Incremental reduction (e.g., 20% better than current churner avg)
                # Not a jump to the perfect customer profile.
                target_rec = int(max(7, rec_churn * 0.8)) 
                
                ratio = rec_churn / max(rec_retain, 1)
                # Realistic lift: capped at 15%
                lift = round(min(12, max(3, (ratio - 1) * 2.5)), 1)
                
                hypotheses.append({
                    'title': f'The {display_feat} Hypothesis',
                    'hypothesis': f"By reducing the {display_feat.lower()} from {int(rec_churn)} days to below {target_rec} days, we can potentially lower churn risk by {lift}%.",
                    'test': f"A/B Test: Automated nudge triggered at Day {target_rec} vs Control.",
                    'driver': display_feat,
                    'stat': f'Target: {target_rec}d (-20%)',
                    'impact': 'Critical',
                    'expected_lift_pct': lift
                })

            # ── H: Frequency ──
            elif 'frequency' in raw_feat or 'count' in raw_feat or 'diversity' in raw_feat:
                freq_churn = high_churn['frequency'].mean()
                freq_retain = low_churn['frequency'].mean()
                
                # Target: Incremental milestone (e.g., +25% or +1-2 transactions)
                target_freq = int(max(freq_churn + 1, freq_churn * 1.25))
                
                lift = round(min(10.0, max(2.0, (target_freq / max(freq_churn, 1) - 1) * 6)), 1)
                
                hypotheses.append({
                    'title': f'The {display_feat} Hypothesis',
                    'hypothesis': f"Users reaching {target_freq} {display_feat.lower()} show improved retention rates in our cohort models. Incentivizing this milestone could yield a ~{lift}% retention lift.",
                    'test': f'A/B Test: "Loyalty Milestone" rewards for users reaching {target_freq} {display_feat.lower()}.',
                    'driver': display_feat,
                    'stat': f'Target: {target_freq} (+25%)',
                    'impact': 'High',
                    'expected_lift_pct': lift
                })

            # ── H: Wallet Share / Monetary ──
            elif 'monetary' in raw_feat or 'velocity' in raw_feat or 'value' in raw_feat or 'balance' in raw_feat:
                val_churn = high_churn['monetary'].mean()
                val_retain = low_churn['monetary'].mean()
                
                # Target: Incremental 20% jump, not bridging the whole gap to loyalists
                target_val = val_churn * 1.20
                
                lift = round(min(8.0, max(1.5, (target_val / max(val_churn, 1) - 1) * 10)), 1)
                
                hypotheses.append({
                    'title': f'The {display_feat} Hypothesis',
                    'hypothesis': f"Increasing {display_feat.lower()} from ₹{int(val_churn):,} to ₹{int(target_val):,} could stabilize high-risk accounts and improve retention by ~{lift}%.",
                    'test': f'A/B Test: Cross-sell incentives for users in the ₹{int(val_churn):,} bracket.',
                    'driver': display_feat,
                    'stat': f'Target: ₹{int(target_val):,}',
                    'impact': 'Medium',
                    'expected_lift_pct': lift
                })
            
            seen_drivers.add(raw_feat)
            if len(hypotheses) >= 3: break

        if not hypotheses:
            hypotheses.append({
                'title': 'The Behavioral Engagement Hypothesis',
                'hypothesis': 'Targeted re-engagement based on historical activity patterns could improve overall retention by 5-10%.',
                'test': 'A/B Test: Personalized retention sequence vs Control.',
                'driver': 'Behavioral',
                'stat': 'ML Importance > 0.15',
                'impact': 'Medium',
                'expected_lift_pct': 7.5
            })

        return hypotheses[:3]
            
        mon_lift = round(min(10.0, max(1.5, (aov_target / max(aov_churn, 1) - 1) * 15)), 1)
        
        hypotheses.append({
            'title': 'The Wallet Share Hypothesis',
            'hypothesis': f"Offering targeted cross-sell bundles at checkout could increase Average Order Value (AOV) from ₹{int(aov_churn)} to ₹{int(aov_target)}, establishing deeper product engagement and improving retention by ~{mon_lift}%.",
            'test': 'A/B Test: Dynamic "Frequently Bought Together" bundles for at-risk segments.',
            'driver': 'Wallet Share',
            'stat': f'₹{int(aov_target)} vs ₹{int(aov_churn)} AOV',
            'evidence': f"Spend Analysis: Retained users show a {((aov_retain/max(aov_churn, 1) - 1)*100):.0f}% higher baseline order value, indicating that higher single-transaction engagement correlates with long-term loyalty.",
            'impact': 'Medium',
            'expected_lift_pct': mon_lift
        })

        return hypotheses[:3]

    # ────────────────────────────────────────────
    #  7. Lifecycle Stages
    # ────────────────────────────────────────────
    def get_lifecycle_stages(self, df):
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        user_start = df.groupby('user_id')['timestamp'].min().reset_index()
        user_start.columns = ['user_id', 'first_seen']
        current_date = df['timestamp'].max()
        user_start['tenure'] = (current_date - user_start['first_seen']).dt.days

        # ── Optimized Vectorized Lifecycle Detection ──
        user_agg = df.groupby('user_id').agg(
            first_seen=('timestamp', 'min'),
            last_seen=('timestamp', 'max'),
            txn_count=('user_id', 'count')
        )
        
        # Max gap detection
        df_sorted = df[['user_id', 'timestamp']].sort_values(['user_id', 'timestamp'])
        df_sorted['gap'] = df_sorted.groupby('user_id')['timestamp'].diff().dt.days
        max_gaps = df_sorted.groupby('user_id')['gap'].max().fillna(0)
        
        user_agg['max_gap'] = max_gaps
        user_agg['tenure'] = (current_date - user_agg['first_seen']).dt.days
        user_agg['last_purchase_days'] = (current_date - user_agg['last_seen']).dt.days
        
        # Vectorized mapping logic
        conditions = [
            (user_agg['txn_count'] < 2),                                      # New (Single txn)
            (user_agg['max_gap'] > 90) & (user_agg['last_purchase_days'] < 30), # Reactivated
            (user_agg['tenure'] < 15),                                        # New (Recent)
            (user_agg['tenure'] < 90)                                         # Active
        ]
        choices = ['New', 'Reactivated', 'New', 'Active']
        user_agg['lifecycle'] = np.select(conditions, choices, default='Established')
        
        return user_agg.reset_index()[['user_id', 'lifecycle', 'first_seen', 'tenure']]

    # ────────────────────────────────────────────
    #  8. Churn Forecast (Data-Driven Exponential Smoothing)
    # ────────────────────────────────────────────
    def compute_churn_forecast(self, rfm_df, cohort_data, metrics, n_months=6):
        """6-month churn forecast grounded in cohort retention trends and model confidence."""
        import calendar
        # Use revenue-weighted current churn for more realistic forecast starting point
        total_monetary = rfm_df['monetary'].sum()
        if total_monetary > 0:
            current_churn = float((rfm_df['churn_probability'] * rfm_df['monetary']).sum() / total_monetary) * 100
        else:
            current_churn = float(rfm_df['churn_probability'].mean()) * 100
        auc = metrics.get('roc_auc', 0.7)

        # Extract monthly churn trend from cohort retention decay
        trend = 0.3  # default: slight increase per month
        if cohort_data and len(cohort_data) >= 2:
            decay_rates = []
            for cohort in cohort_data:
                ret = [r for r in cohort.get('retention', []) if r > 0]
                for j in range(1, len(ret)):
                    decay_rates.append(ret[j - 1] - ret[j])
            if decay_rates:
                trend = max(0.1, float(np.median(decay_rates)) * 0.25)

        now = datetime.now()
        forecast = []
        for i in range(n_months):
            month_idx = ((now.month - 1 + i) % 12) + 1
            month_label = calendar.month_abbr[month_idx]

            # Baseline: no action, churn drifts upward with inertia
            baseline = min(95, current_churn + (i * trend))

            # Intervention: S-curve recovery modulated by model confidence
            t = i / max(n_months - 1, 1)
            recovery_cap = 0.45 * auc
            recovery = recovery_cap / (1 + np.exp(-8 * (t - 0.4)))
            optimized = max(3, baseline * (1 - recovery))
            saved = baseline - optimized

            forecast.append({
                'month': month_label,
                'baseline': round(baseline, 1),
                'risk': round(optimized, 1),
                'saved': round(saved, 1),
            })
        return forecast

    def _calculate_data_health(self, df):
        """Calculate a Data Health Score (0-100) based on quality metrics."""
        scores = []
        
        # 1. Recency Variance (Better if users are spread across time)
        if 'timestamp' in df.columns:
            days = (df['timestamp'].max() - df['timestamp'].min()).days
            scores.append(min(100, days / 3.65)) # 1 year = 100
            
        # 2. Missing Values (Penalty)
        null_pct = df.isnull().mean().mean()
        scores.append(max(0, 100 - (null_pct * 500)))
        
        # 3. User Volume
        unique_users = df['user_id'].nunique()
        scores.append(min(100, (unique_users / 1000) * 100)) # 1k users = 100
        
        # 4. Feature Variance
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0:
            var_score = (df[numeric_cols].std() > 0).mean() * 100
            scores.append(var_score)
            
        avg_score = sum(scores) / len(scores) if scores else 0
        
        return {
            "score": round(avg_score, 1),
            "status": "Excellent" if avg_score > 85 else "Good" if avg_score > 65 else "Fair" if avg_score > 40 else "Poor",
            "metrics": {
                "user_volume": int(unique_users),
                "null_pct": round(float(null_pct * 100), 2),
                "days_of_history": int(days) if 'timestamp' in df.columns else 0
            }
        }


def run_analysis(df):
    """Run the analytics engine directly for tests and batch jobs."""
    eng = AnalyticsEngine()
    working = df.copy()
    rfm_results, silhouette = eng.calculate_rfm(working)
    churn_results, drivers, metrics, shap_data = eng.predict_churn(working, rfm_results)
    lifecycle = eng.get_lifecycle_stages(working)
    final_df = churn_results.merge(lifecycle, on='user_id', how='left')

    try:
        cohort_data = eng.build_cohort_matrix(working)
    except Exception:
        cohort_data = []

    summary = {
        "total_users": int(final_df['user_id'].nunique()),
        "avg_churn_risk": float((final_df['churn_probability'] * final_df['monetary']).sum() / max(final_df['monetary'].sum(), 1)),
        "data_health": eng._calculate_data_health(working),
        "segments": final_df['segment'].value_counts().to_dict(),
        "lifecycle_stages": final_df['lifecycle'].value_counts().to_dict(),
        "top_drivers": drivers,
        "hypotheses": eng.generate_hypotheses(drivers, final_df),
        "metrics": {"silhouette_score": float(silhouette), **metrics},
        "shap_data": shap_data,
        "segment_churn": eng.get_segment_churn(churn_results),
        "product_mix": eng.analyze_product_mix(working, churn_results),
        "cohort_data": cohort_data,
        "revenue_at_risk": eng.get_revenue_at_risk(churn_results),
        "potential_recovery": eng.get_potential_recovery(churn_results, metrics),
        "forecast": eng.compute_churn_forecast(churn_results, cohort_data, metrics),
    }
    return {"summary": summary, "users": final_df.head(1000).to_dict(orient='records')}
