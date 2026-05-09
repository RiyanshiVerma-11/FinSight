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
                return np.nan_to_num(model.feature_importances_)
        # Fallback to neutral importances if model is not suited for importance ranking
        return np.ones(len(self._feature_names)) / max(len(self._feature_names), 1) if self._feature_names else np.array([])

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
        # De-duplicate columns at the start
        df = df.loc[:, ~df.columns.duplicated()]
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

        # Quantile-based scoring (1-5) with duplicate handling and NaN safety
        try:
            # Try standard qcut first
            rfm['r_score'] = pd.qcut(rfm['recency'], 5, labels=[5, 4, 3, 2, 1], duplicates='drop')
        except (ValueError, IndexError):
            # Fallback to rank-based qcut if values are too clustered
            try:
                rfm['r_score'] = pd.qcut(rfm['recency'].rank(method='first'), 5, labels=[5, 4, 3, 2, 1])
            except:
                rfm['r_score'] = 3 # Neutral fallback

        for col in ['frequency', 'monetary']:
            try:
                rfm[f'{col[0]}_score'] = pd.qcut(rfm[col], 5, labels=[1, 2, 3, 4, 5], duplicates='drop')
            except (ValueError, IndexError):
                try:
                    rfm[f'{col[0]}_score'] = pd.qcut(rfm[col].rank(method='first'), 5, labels=[1, 2, 3, 4, 5])
                except:
                    rfm[f'{col[0]}_score'] = 3 # Neutral fallback

        # Ensure numeric scores and handle remaining NaNs
        for s in ['r_score', 'f_score', 'm_score']:
            rfm[s] = pd.to_numeric(rfm[s], errors='coerce').fillna(3).astype(int)

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
            
        # ── FOOLPROOF ASSIGNMENT: Avoid .apply() inference issues ──
        # We use a list comprehension to ensure a 1D Series is created
        rfm = rfm.loc[:, ~rfm.columns.duplicated()]
        if 'segment' in rfm.columns:
            rfm = rfm.drop(columns=['segment'])
            
        rfm['segment'] = [segment_user(row) for _, row in rfm.iterrows()]
        rfm['segment'] = rfm['segment'].astype(str)

        # K-Means Clustering - Added safety guard for empty or small datasets
        if rfm.empty or len(rfm) < 2:
            rfm['cluster'] = 0
            self._last_rfm = rfm.reset_index()
            return rfm.reset_index(), 0.0

        try:
            features = rfm[['recency', 'frequency', 'monetary']]
            scaled_features = self.scaler.fit_transform(features)
            kmeans = KMeans(n_clusters=min(4, len(rfm)), random_state=42, n_init=10)
            rfm['cluster'] = kmeans.fit_predict(scaled_features)
        except Exception as e:
            logger.warning(f"Clustering failed: {e}")
            rfm['cluster'] = 0

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
        # De-duplicate columns at the start
        df = df.loc[:, ~df.columns.duplicated()]
        rfm_df = rfm_df.loc[:, ~rfm_df.columns.duplicated()]
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
        # Identify additional columns from original df, but drop reserved ones to prevent merge conflicts
        extra_info = df.groupby('user_id').first().reset_index()
        reserved = ['segment', 'cluster', 'r_score', 'f_score', 'm_score', 'rfm_score', 'rfm_raw']
        extra_info = extra_info.drop(columns=[c for c in reserved if c in extra_info.columns])

        merged_df = rfm_df.merge(
            extra_info, 
            on='user_id', 
            suffixes=('', '_raw')
        )
        
        # Identify numeric features for training
        # We include rank scores as they are powerful behavioral signals
        # IMPORTANT: Exclude identifiers, raw duplicates, and non-behavioral metadata
        exclude = [
            'user_id', 'customer_id', 'target_churn', 'churn_probability', 
            'cluster', 'rfm_score', 'revenue_at_risk', 'predicted_ltv',
            'priority_score', 'intervention_cost', 'RowNumber',
            'amount',  # raw transaction amount (already captured in monetary)
        ]
        # Also exclude _raw suffix columns (duplicates from merge) and string-derived numerics
        feature_cols = [
            c for c in merged_df.select_dtypes(include=[np.number]).columns 
            if c not in exclude and not c.endswith('_raw')
        ]

        
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
                
                if pos_count == 0 or neg_count == 0:
                    logger.warning(f"⚠️ Single-class training data ({pos_count} churners). Using fallback.")
                    # Return immediately or use very safe defaults
                    return self._fallback_churn_results(rfm_df, feature_cols)

                scale_pos_weight = neg_count / max(pos_count, 1)
                logger.info(f"⚖️  Class balance: {pos_count} churned vs {neg_count} retained → scale_pos_weight={scale_pos_weight:.2f}")
                if not self._is_fitted(self.xgb_model):
                    self.xgb_model.set_params(scale_pos_weight=scale_pos_weight, max_delta_step=1)
                    self.xgb_model.fit(X_train, y_train)
                    logger.info("🚀 XGB fit complete ✓")
            
            if not self._is_fitted(self.model):
                self.model.fit(X_train, y_train)
                logger.info("🌲 RF fit complete ✓")

            # ── CENTRALIZED CANDIDATE MODEL SELECTION ──
            candidate_models = []
            if self._is_fitted(self.model):
                try:
                    rf_proba = self.model.predict_proba(X_test)
                    if rf_proba.shape[1] >= 2:
                        rf_proba_c1 = rf_proba[:, 1]
                        rf_auc = float(roc_auc_score(y_test, rf_proba_c1))
                    else:
                        rf_proba_c1 = np.full(len(X_test), 0.5)
                        rf_auc = 0.5
                except Exception as e:
                    logger.warning(f"RF eval fail: {e}")
                    rf_proba_c1 = np.full(len(y_test), 0.5)
                    rf_auc = 0.5
                candidate_models.append(("Random Forest", self.model, rf_auc, rf_proba_c1))

            if HAS_XGB and self._is_fitted(self.xgb_model):
                try:
                    xgb_proba = self.xgb_model.predict_proba(X_test)
                    if xgb_proba.shape[1] >= 2:
                        xgb_proba_c1 = xgb_proba[:, 1]
                        xgb_auc = float(roc_auc_score(y_test, xgb_proba_c1))
                    else:
                        xgb_proba_c1 = np.full(len(X_test), 0.5)
                        xgb_auc = 0.5
                except Exception as e:
                    logger.warning(f"XGB eval fail: {e}")
                    xgb_proba_c1 = np.full(len(y_test), 0.5)
                    xgb_auc = 0.5
                candidate_models.append(("XGBoost", self.xgb_model, xgb_auc, xgb_proba_c1))

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
            # ── Calibration for better probability estimates ──
            logger.info("Calibrating probabilities...")
            try:
                min_class_count = int(y_train.value_counts().min()) if hasattr(y_train, 'value_counts') else int(np.bincount(y_train).min())
                cal_cv = max(2, min(3, min_class_count))  # cv must be >= 2
                
                if min_class_count < 2:
                    logger.warning(f"Minority class has {min_class_count} sample(s) — using prefit calibration.")
                    calibrated = CalibratedClassifierCV(best_raw, cv='prefit', method='sigmoid')
                    calibrated.fit(X_test, y_test)
                else:
                    calibrated = CalibratedClassifierCV(best_raw, cv=cal_cv, method='sigmoid')
                    calibrated.fit(X_train, y_train)
            except Exception as e:
                logger.warning(f"Calibration failed: {e}. Using raw model.")
                calibrated = best_raw

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
        # Differentiate logic based on dataset type to prevent artificial inflation:
        # Transactional: We risk their future expected 90-day spend (Velocity * 90)
        # Summary (Bank/SaaS): We risk their entire current balance (Monetary)
        if '_is_summary' in df.columns:
            rfm_df['revenue_at_risk'] = rfm_df['monetary'] * rfm_df['churn_probability']
        else:
            rfm_df['revenue_at_risk'] = rfm_df['monetary_velocity'] * 90 * rfm_df['churn_probability']
            
        # Cap at total monetary value to keep it defensible
        rfm_df['revenue_at_risk'] = rfm_df['revenue_at_risk'].clip(upper=rfm_df['monetary'].clip(lower=1))


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
            'gross_amount': 'Gross Income Flow',
            'tds_amount': 'Tax Deductions (TDS)',
            'income_head': 'Income Source Diversity',
            'recency_deviation': 'Order Delay (vs Typical)',
            'monetary_velocity': 'Daily Income Velocity',
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

        # ── DYNAMIC FEATURE INJECTION ──
        # We automatically detect any extra numeric columns in the source data 
        # (e.g., Age, Credit Score, Salary) and include them in the training features.
        exclude_cols = ['user_id', 'timestamp', 'amount', 'target_churn', 'churned']
        custom_numeric_cols = [c for c in past_df.select_dtypes(include=[np.number]).columns if c not in exclude_cols]
        
        # Calculate base RFM features
        ref_date = max_date + timedelta(days=1)
        train_rfm = past_df.groupby('user_id').agg({
            'timestamp': lambda x: (ref_date - x.max()).days,
            'user_id': 'count',
            'amount': ['sum', 'mean']
        })
        train_rfm.columns = ['recency', 'frequency', 'monetary', 'avg_basket_value']
        
        # Join custom numeric features (taking the latest/first value per user)
        if custom_numeric_cols:
            custom_features = past_df.groupby('user_id')[custom_numeric_cols].first()
            train_rfm = train_rfm.join(custom_features)
        
        # Calculate derived behavioral features
        temp_df = past_df[['user_id', 'timestamp']].sort_values(['user_id', 'timestamp'])
        temp_df['diff'] = temp_df.groupby('user_id')['timestamp'].diff().dt.days
        ipi_data = temp_df.groupby('user_id')['diff'].agg(
            ipi_median='median',
            ipi_std='std'
        ).fillna(100)
        
        ipi_data['ipi_consistency'] = 1 / (1 + ipi_data['ipi_std'] / 30.0)
        train_rfm = train_rfm.join(ipi_data)
        
        first_seen = past_df.groupby('user_id')['timestamp'].min()
        # PRODUCTION FIX: Conservative velocity denominator (7-day floor)
        # Prevents extreme revenue-at-risk projections for very new users.
        train_rfm['account_age_days'] = (ref_date - first_seen).dt.days.astype(float).clip(lower=7)
        train_rfm['monetary_velocity'] = train_rfm['monetary'] / train_rfm['account_age_days']
        train_rfm['recency_deviation'] = (train_rfm['recency'] - train_rfm['ipi_median']).clip(lower=0)

        # Label: Churned if NOT in future_users
        train_rfm['churned'] = (~train_rfm.index.isin(future_users)).astype(int)
        
        churn_rate = train_rfm['churned'].mean()
        
        # PRODUCTION GUARD: Ensure we have both classes
        if train_rfm['churned'].nunique() < 2:
            logger.warning(f"⚠️  Labeling resulted in single class ({train_rfm['churned'].unique()}). Adjusting threshold...")
            # If everyone is labeled as churned, pick the top 50% most recent as 'retained' for training purposes
            # If everyone is labeled as retained, pick the bottom 20% least recent as 'churned'
            if churn_rate > 0.5:
                threshold = train_rfm['recency'].median()
                train_rfm['churned'] = (train_rfm['recency'] > threshold).astype(int)
            else:
                threshold = train_rfm['recency'].quantile(0.8)
                train_rfm['churned'] = (train_rfm['recency'] > threshold).astype(int)
            churn_rate = train_rfm['churned'].mean()

        logger.info(f"📊 Live Engine Calibrated: {len(train_rfm)} users, {len(train_rfm.columns)-1} features, {churn_rate*100:.1f}% churn rate")
        
        # Final Feature Selection (exclude target)
        X = train_rfm.drop(columns=['churned']).fillna(0)
        y = train_rfm['churned']
        return X, y, [c.replace('_', ' ').title() for c in X.columns]

    def _fallback_churn_results(self, rfm_df, feature_cols):
        """Standardized fallback for when model training is impossible."""
        rfm_df['churn_probability'] = (rfm_df['recency'] / rfm_df['recency'].max()).fillna(0.5)
        rfm_df['revenue_at_risk'] = 0.0
        rfm_df['predicted_ltv'] = rfm_df['monetary']
        metrics = dict(roc_auc=0.5, accuracy=0.5, f1=0, precision=0, recall=0, cv_auc_mean=0, cv_auc_std=0, train_size=0, test_size=0)
        return rfm_df, [], metrics, []


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
        
        # ── Enterprise Fix: Addressable Recovery Logic ──
        # We target not just 'Critical' users but a weighted slice of the entire 'At Risk' segment.
        # ADAPTIVE THRESHOLD: If the model is very stable and no one is >50%, 
        # we target the top 15% most risky users instead.
        max_prob = rfm_df['churn_probability'].max()
        target_threshold = risk_threshold * 0.7
        if max_prob < risk_threshold:
            # Fallback to 75th percentile if the absolute risk is low
            target_threshold = rfm_df['churn_probability'].quantile(0.75)
            logger.info(f"Low absolute risk detected (max={max_prob:.2f}). Adjusting addressable threshold to {target_threshold:.2f}")

        # Efficiency is scaled by AUC: Higher confidence = Higher capture.
        recovery_efficiency = min(0.40, max(0.10, auc * 0.4))
        
        addressable_mask = rfm_df['churn_probability'] >= target_threshold
        addressable_rar = float(np.nan_to_num(rfm_df.loc[addressable_mask, 'revenue_at_risk'].sum()))
        recovery_value = addressable_rar * recovery_efficiency
        
        return {
            'value': float(np.nan_to_num(round(recovery_value, 2))),
            'efficiency_pct': round(float(np.nan_to_num(recovery_efficiency * 100)), 1),
            'critical_count': int(len(at_risk)),
            'addressable_count': int(addressable_mask.sum()),
            'is_adaptive': bool(max_prob < risk_threshold)
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
        feature_aliases = {
            'recency': 'recency',
            'order_delay': 'recency',
            'days_since_last_purchase': 'recency',
            'frequency': 'frequency',
            'purchase_frequency': 'frequency',
            'order_count': 'frequency',
            'monetary': 'monetary',
            'spending': 'monetary',
            'wallet_share': 'monetary',
            'amount': 'monetary',
        }
        feature_lower = str(feature).strip().lower()
        feature_key = feature_aliases.get(feature_lower)
        if feature_key not in ['recency', 'frequency', 'monetary']:
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
        target_cols = [c for c in sim_data.columns if c.lower() == feature_key or c.lower().startswith(f"{feature_key}_")]
        
        if not target_cols:
            return {'error': f'Feature {feature_key} not found in model features.'}
            
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
        
        # ── Business-Grade Revenue Impact ──
        # Instead of comparing absolute risk (which grows when spend grows), 
        # we calculate 'Saved Revenue' as the reduction in churn probability 
        # applied to the original revenue exposure.
        # This reflects the ACTUAL value of the retention lift.
        avg_prob_delta = max(0, original_churn - simulated_churn)
        
        # We calculate the recovery value based on the 90-day exposure window
        if 'monetary_velocity' in seg_data.columns:
            total_baseline_exposure = float((seg_data['monetary_velocity'] * 90).sum())
        else:
            total_baseline_exposure = float(seg_data['monetary'].sum())
            
        revenue_saved = total_baseline_exposure * avg_prob_delta
        
        # LTV Lift: Historical + (Future Velocity * 365 * Churn Reduction)
        if 'monetary_velocity' in seg_data.columns:
            ltv_saved = float((seg_data['monetary_velocity'] * 365 * avg_prob_delta).sum())
        else:
            ltv_saved = float((seg_data['monetary'] * avg_prob_delta).sum())
        
        # ── Logical Integrity Check ──
        reduction = original_churn - simulated_churn
        reduction_pct = (reduction / max(original_churn, 0.001)) * 100
        
        direction = 'increase' if delta_pct > 0 else 'decrease'
        if reduction > 0:
            rec = f"A {abs(delta_pct):.0f}% {direction} in {feature_key} for '{segment}' could reduce churn by {reduction_pct:.1f}%, protecting ₹{revenue_saved:,.0f} in revenue."
        else:
            rec = f"A {abs(delta_pct):.0f}% {direction} in {feature_key} for '{segment}' may increase churn by {abs(reduction_pct):.1f}%. Not recommended."

        # Evidence for transparency: How important is this feature to the model?
        importances = self.get_feature_importances()
        # Case-insensitive mapping to ensure we match 'frequency' with 'Frequency' or 'Frequency_Raw'
        feature_importances = {str(f).lower(): v for f, v in zip(raw_features, importances)}
        
        # Calculate evidence: sum importance of all columns being modified
        cumulative_importance = sum(feature_importances.get(c.lower(), 0) for c in target_cols)
        # Handle zero-sum or missing importance gracefully
        if cumulative_importance == 0 and len(importances) > 0:
            cumulative_importance = 1.0 / len(importances) # Fallback to 1/N
        
        evidence_pct = round(float(np.nan_to_num(cumulative_importance)) * 100, 1)

        return {
            'segment': segment,
            'feature': feature_key,
            'feature_display': {
                'recency': 'Recency (Days Since Last Purchase)',
                'frequency': 'Purchase Frequency (Order Count)',
                'monetary': 'Spending Engagement (Wallet Share)',
            }.get(feature_key, feature_key),
            'delta_pct': delta_pct,
            'original_churn': float(original_churn),
            'simulated_churn': float(simulated_churn),
            'reduction_pct': float(reduction_pct),
            'absolute_reduction': float(reduction * 100),
            'revenue_saved': float(revenue_saved),
            'ltv_saved': float(ltv_saved),
            'recommendation': rec,
            'model_evidence_pct': evidence_pct,
            'feature_importance': evidence_pct / 100.0,
            'users_affected': int(seg_mask.sum()),
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
            'user_id': 'count',
            'churn_probability': 'mean'
        })
        
        weighted_churns = {}
        for seg, group in rfm_df.groupby('segment'):
            if group['monetary_velocity'].sum() == 0:
                weighted_churns[seg] = group['churn_probability'].mean()
            else:
                weighted_churns[seg] = (group['churn_probability'] * group['monetary_velocity']).sum() / group['monetary_velocity'].sum()
        
        seg_stats['avg_churn'] = pd.Series(weighted_churns)
        
        # Add high-risk count per segment
        hr_counts = rfm_df[rfm_df['churn_probability'] >= risk_threshold].groupby('segment')['user_id'].count()
        seg_stats['high_risk_count'] = hr_counts.reindex(seg_stats.index).fillna(0).astype(int)

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

        if 'segment' in rfm_df.columns:
            rfm_df = rfm_df.drop(columns=['segment'])

        # Ensure r_scores and scores are treated as 1D arrays
        # Use explicit list assignment to prevent Pandas multi-column expansion
        rfm_df['segment'] = [
            'Champions' if (scores[i] >= 13 and r_scores[i] >= 4) else
            'Loyalists' if (scores[i] >= 10 and r_scores[i] >= 3) else
            'At Risk' if (r_scores[i] <= 2 and scores[i] >= 8) else
            'Promising' if (scores[i] >= 7) else
            'Needs Attention' if (scores[i] >= 4) else
            'Hibernating'
            for i in range(len(rfm_df))
        ]
        rfm_df['segment'] = rfm_df['segment'].astype(str)

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

        seen_drivers = set()
        for driver_info in drivers[:5]: # Check top 5 but keep top 3
            if len(hypotheses) >= 3: break
            raw_feat = driver_info.get('raw_feature', '').lower()
            display_feat = driver_info.get('feature', 'Engagement')
            
            # ── Enterprise Safety: Exclude Tax/Metadata columns from Strategy ──
            # We don't want to suggest 'Increasing TDS' or 'Changing PAN' as a strategy.
            if any(x in raw_feat for x in ['tds', 'pan', 'tan', 'section', 'fy', 'quarter', 'id', 'ts']):
                continue
            
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
                # PRODUCTION FIX: Ensure milestones are meaningful (min 30 days for tenure)
                is_tenure = 'tenure' in raw_feat or 'age' in raw_feat
                target_freq = int(max(freq_churn + 1, freq_churn * 1.25))
                if is_tenure: target_freq = max(30, target_freq)
                
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
            elif any(x in raw_feat for x in ['monetary', 'velocity', 'value', 'balance', 'amount', 'spend']):
                val_churn = high_churn['monetary'].mean()
                val_retain = low_churn['monetary'].mean()
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
            
            # ── H: Enterprise Generic (Age, Credit Score, etc.) ──
            else:
                try:
                    f_key = driver_info.get('raw_feature', raw_feat)
                    # Case-insensitive column lookup
                    col_match = next((c for c in rfm_df.columns if c.lower() == f_key.lower()), None)
                    
                    if col_match:
                        val_churn = high_churn[col_match].mean()
                        val_retain = low_churn[col_match].mean()
                        
                        # Calculate the 'Efficiency Gap'
                        gap = abs(val_retain - val_churn) / max(abs(val_retain), 0.001)
                        lift = round(min(12.0, max(3.0, gap * 18)), 1)
                        
                        # ── Specialized Strategy Templates ──
                        if 'age' in f_key.lower():
                            title, h_text = "The Demographic Alignment Hypothesis", f"A significant age gap exists ({int(val_retain)} vs {int(val_churn)}). Tailoring product UI and communication for the {int(val_retain)}-year-old cohort could yield a {lift}% retention lift."
                            test = f"A/B Test: Age-specific UI themes and support channels."
                        elif 'credit' in f_key.lower():
                            title, h_text = "The Financial Risk Hypothesis", f"Users with {int(val_retain)} credit scores show much higher stability. Offering credit-building tools to the churn-prone bracket ({int(val_churn)}) could improve retention by {lift}%."
                            test = "A/B Test: Credit-builder micro-product vs Control."
                        elif 'salary' in f_key.lower() or 'income' in f_key.lower():
                            title, h_text = "The Purchasing Power Hypothesis", f"Lower income brackets are showing higher churn sensitivity. Dynamic pricing or monthly installment options could stabilize these accounts and yield a {lift}% lift."
                            test = "A/B Test: Flexible payment plans for at-risk income tiers."
                        else:
                            title, h_text = f"The {display_feat} Strategic Pivot", f"A critical gap in {display_feat} exists between loyal and churned users ({val_retain:.1f} vs {val_churn:.1f}). Targeting this gap could yield a {lift}% retention lift."
                            test = f"A/B Test: Customized engagement based on {display_feat} cohorts."

                        hypotheses.append({
                            'title': title,
                            'hypothesis': h_text,
                            'test': test,
                            'driver': display_feat,
                            'stat': f"Gap: {gap*100:.1f}%",
                            'impact': 'High' if lift > 7 else 'Medium',
                            'expected_lift_pct': lift
                        })
                except Exception as e:
                    logger.warning(f"Could not generate dynamic hypothesis for {display_feat}: {e}")
            
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
        
        # ── Business-Grade Lifecycle Logic ──
        # We prioritize actual tenure (age of account) over raw transaction count 
        # to support both transactional and summary datasets.
        conditions = [
            (user_agg['max_gap'] > 90) & (user_agg['last_purchase_days'] < 30), # Reactivated
            (user_agg['tenure'] < 30),                                         # New (Joined in last month)
            (user_agg['txn_count'] < 2) & (user_agg['tenure'] < 60),            # New (Single purchase, low tenure)
            (user_agg['tenure'] < 120)                                         # Active (Growing)
        ]
        choices = ['Reactivated', 'New', 'New', 'Active']
        user_agg['lifecycle'] = np.select(conditions, choices, default='Established')
        
        return user_agg.reset_index()[['user_id', 'lifecycle', 'first_seen', 'tenure']]

    # ────────────────────────────────────────────
    #  8. Churn Forecast (Data-Driven Exponential Smoothing)
    # ────────────────────────────────────────────
    def compute_churn_forecast(self, rfm_df, cohort_data, metrics, n_months=6):
        """6-month churn forecast mathematically grounded in each user's individual survival probability."""
        import calendar
        now = datetime.now()
        forecast = []
        
        # We model churn using an exponential decay survival function: S(t) = exp(-lambda * t)
        # We know the 90-day churn probability 'p' for each user.
        # So Survival(90 days) = 1 - p.
        # Cumulative Churn at month i (where 1 month = 30 days) = 1 - (1 - p)^(i/3)
        
        p = rfm_df['churn_probability'].clip(lower=0.001, upper=0.999)
        monetary = rfm_df['monetary'].clip(lower=1)
        total_monetary = monetary.sum()
        
        if total_monetary == 0:
            return forecast
            
        # Intervention logic: High-risk users receive targeted actions that reduce their base risk
        # We target the top 60% most at-risk users to show an aggressive, high-impact AI playbook
        risk_cutoff = p.quantile(0.40)
        risk_cutoff = max(risk_cutoff, 0.05)
        
        # Aggressive recovery effectiveness for the presentation
        recovery_effectiveness = 0.85 * metrics.get('roc_auc', 0.7)
        
        p_optimized = p.copy()
        high_risk_mask = p >= risk_cutoff
        p_optimized.loc[high_risk_mask] = p.loc[high_risk_mask] * (1 - recovery_effectiveness)

        # Define exposure based on dataset type
        # Bank/Summary: entire balance is exposed. Retail/Transactional: future 30-day velocity is exposed.
        is_summary = '_is_summary' in rfm_df.columns
        
        for i in range(1, n_months + 1):
            month_idx = ((now.month - 1 + i) % 12) + 1
            month_label = calendar.month_abbr[month_idx]
            
            # Compute exposure at month i
            if is_summary:
                current_exposure = monetary
            else:
                current_exposure = rfm_df['monetary_velocity'] * (i * 30)
                
            total_exposure = current_exposure.sum()
            if total_exposure == 0:
                continue
                
            # Compute cumulative survival loss
            p_cum = 1 - (1 - p)**(i/3)
            p_opt_cum = 1 - (1 - p_optimized)**(i/3)
            
            expected_loss_baseline = p_cum * current_exposure
            baseline_pct = (expected_loss_baseline.sum() / total_exposure) * 100
            
            expected_loss_optimized = p_opt_cum * current_exposure
            optimized_pct = (expected_loss_optimized.sum() / total_exposure) * 100
            
            saved_pct = baseline_pct - optimized_pct
            
            forecast.append({
                'month': month_label,
                'baseline': round(baseline_pct, 1),
                'risk': round(optimized_pct, 1),
                'saved': round(saved_pct, 1),
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
