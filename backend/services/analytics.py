import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    silhouette_score, roc_auc_score, f1_score,
    precision_score, recall_score
)
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from datetime import datetime, timedelta
import logging
import os
import pickle
import json

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False

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
        self.model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
        if HAS_XGB:
            self.xgb_model = xgb.XGBClassifier(n_estimators=100, random_state=42, learning_rate=0.1, max_depth=5)
        else:
            self.xgb_model = GradientBoostingClassifier(n_estimators=100, random_state=42)
        self._explainer = None
        self._feature_names = []
        self._last_rfm = None
        self._model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models')
        os.makedirs(self._model_dir, exist_ok=True)

    # ────────────────────────────────────────────
    #  1. RFM Analysis & Clustering
    # ────────────────────────────────────────────
    def calculate_rfm(self, df):
        """Dynamic RFM with Inter-Purchase Interval & Monetary Velocity."""
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        reference_date = df['timestamp'].max() + timedelta(days=1)

        rfm = df.groupby('user_id').agg({
            'timestamp': lambda x: (reference_date - x.max()).days,
            'user_id': 'count',
            'amount': 'sum'
        })
        rfm.columns = ['recency', 'frequency', 'monetary']

        # ── Dynamic Feature: Inter-Purchase Interval ──
        def calc_ipi(group):
            ts = group['timestamp'].sort_values()
            if len(ts) < 2:
                return pd.Series({'ipi_median': 0.0, 'ipi_std': 0.0})
            diffs = ts.diff().dropna().dt.days
            return pd.Series({'ipi_median': float(diffs.median()), 'ipi_std': float(diffs.std()) if len(diffs) > 1 else 0.0})

        ipi_data = df.groupby('user_id').apply(calc_ipi).reset_index()
        ipi_data.set_index('user_id', inplace=True)
        rfm = rfm.join(ipi_data)

        # Recency Deviation: how overdue is this user vs their own pattern
        rfm['recency_deviation'] = rfm['recency'] - rfm['ipi_median']
        rfm['recency_deviation'] = rfm['recency_deviation'].clip(lower=0)

        # ── Dynamic Feature: Monetary Velocity ──
        first_seen = df.groupby('user_id')['timestamp'].min()
        account_age = (reference_date - first_seen).dt.days.clip(lower=1)
        rfm['account_age_days'] = account_age
        rfm['monetary_velocity'] = rfm['monetary'] / rfm['account_age_days']

        # Quantile-based scoring (1-5)
        rfm['r_score'] = pd.qcut(rfm['recency'], 5, labels=[5, 4, 3, 2, 1])
        for col in ['frequency', 'monetary']:
            try:
                rfm[f'{col[0]}_score'] = pd.qcut(rfm[col], 5, labels=[1, 2, 3, 4, 5])
            except ValueError:
                rfm[f'{col[0]}_score'] = pd.qcut(rfm[col].rank(method='first'), 5, labels=[1, 2, 3, 4, 5])

        rfm['rfm_score'] = rfm[['r_score', 'f_score', 'm_score']].astype(int).sum(axis=1)

        def segment_user(row):
            score = row['rfm_score']
            if score >= 13: return 'Champions'
            if score >= 10: return 'Loyal'
            if score >= 7: return 'Potential Loyalist'
            if score >= 4: return 'At Risk'
            return 'Lost'

        rfm['segment'] = rfm.apply(segment_user, axis=1)

        # K-Means Clustering
        features = rfm[['recency', 'frequency', 'monetary']]
        scaled_features = self.scaler.fit_transform(features)
        kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
        rfm['cluster'] = kmeans.fit_predict(scaled_features)

        try:
            sil_score = silhouette_score(scaled_features, rfm['cluster'])
        except Exception as e:
            logger.error(f"Error calculating silhouette score: {e}")
            sil_score = 0.0

        self._last_rfm = rfm.reset_index()
        return rfm.reset_index(), sil_score

    # ────────────────────────────────────────────
    #  2. Churn Prediction (proper train/test)
    # ────────────────────────────────────────────
    def predict_churn(self, df, rfm_df):
        """
        Predicts churn using a temporal split to avoid data leakage.
        Trains on past data to predict a 'future' 30-day window.
        """
        # 1. Prepare training data with a temporal split (past -> future)
        X_train_full, y_train_full, feature_names = self._prepare_training_data(df)

        if len(X_train_full) < 10 or y_train_full.nunique() < 2:
            # Fallback if dataset is too small for a temporal split
            rfm_df['churn_probability'] = 0.0
            metrics = dict(roc_auc=0, f1=0, precision=0, recall=0, cv_auc_mean=0, cv_auc_std=0)
            return rfm_df, [], metrics, []

        # 2. Stratified split for model evaluation
        X_train, X_test, y_train, y_test = train_test_split(
            X_train_full, y_train_full, test_size=0.25, random_state=42, stratify=y_train_full
        )

        # 3. Train models
        self.model.fit(X_train, y_train)
        self.xgb_model.fit(X_train, y_train)

        # 4. Evaluate on the 'future' test set
        y_pred_proba = self.model.predict_proba(X_test)[:, 1]
        y_pred = self.model.predict(X_test)
        
        # Cross-validation
        cv_n = min(5, len(X_train_full) // 5)
        if cv_n >= 2:
            cv = StratifiedKFold(n_splits=cv_n, shuffle=True, random_state=42)
            cv_scores = cross_val_score(self.model, X_train_full, y_train_full, cv=cv, scoring='roc_auc')
            cv_auc_mean = float(cv_scores.mean())
            cv_auc_std = float(cv_scores.std())
        else:
            cv_auc_mean, cv_auc_std = 0.0, 0.0

        try:
            auc = roc_auc_score(y_test, y_pred_proba)
        except:
            auc = 0.0

        metrics = {
            'roc_auc': float(auc),
            'f1': float(f1_score(y_test, y_pred, zero_division=0)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'cv_auc_mean': cv_auc_mean,
            'cv_auc_std': cv_auc_std,
            'test_size': int(len(X_test)),
            'train_size': int(len(X_train)),
        }

        # 5. Model Comparison
        xgb_y_pred_proba = self.xgb_model.predict_proba(X_test)[:, 1]
        try:
            xgb_auc = roc_auc_score(y_test, xgb_y_pred_proba)
        except:
            xgb_auc = 0.0
            
        metrics['model_comparison'] = [
            {'model': 'Random Forest', 'auc': float(auc), 'f1': metrics['f1']},
            {'model': 'XGBoost', 'auc': float(xgb_auc), 'f1': float(f1_score(y_test, self.xgb_model.predict(X_test), zero_division=0))}
        ]

        # 6. Apply to CURRENT data for dashboard probabilities
        current_features = rfm_df[['recency', 'frequency', 'monetary']]
        rfm_df['churn_probability'] = self.model.predict_proba(current_features)[:, 1]

        # Revenue at Risk
        rfm_df['revenue_at_risk'] = rfm_df['monetary'] * rfm_df['churn_probability']
        
        # Predicted Customer Lifetime Value (LTV)
        # Heuristic: Historical spend + Expected future spend based on retention probability
        rfm_df['predicted_ltv'] = rfm_df['monetary'] + (rfm_df['monetary'] * (1 - rfm_df['churn_probability']) * 1.5)

        # 7. Drivers & SHAP
        importances = self.model.feature_importances_
        drivers = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
        self._feature_names = feature_names
        shap_data = self._compute_shap(X_test, feature_names)

        # 8. Cache explainer for per-user SHAP
        if HAS_SHAP:
            try:
                self._explainer = shap.TreeExplainer(self.model)
            except Exception:
                self._explainer = None

        # 9. Model Versioning
        self._save_model_version(metrics)

        return rfm_df, drivers, metrics, shap_data

    def _prepare_training_data(self, df, future_days=30):
        """
        Creates features from the 'past' and labels from the 'future'.
        Helps prevent data leakage by splitting on time.
        """
        df = df.copy()
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        max_date = df['timestamp'].max()
        cutoff = max_date - timedelta(days=future_days)

        # Observation Window (Past)
        past_df = df[df['timestamp'] < cutoff]
        # Labeling Window (Future)
        future_users = df[df['timestamp'] >= cutoff]['user_id'].unique()

        if past_df.empty or len(past_df['user_id'].unique()) < 5:
            # Fallback if windowing is not possible (e.g. data is too short)
            return pd.DataFrame(), pd.Series(), []

        # Calculate features using ONLY past data
        reference_date = cutoff
        train_rfm = past_df.groupby('user_id').agg({
            'timestamp': lambda x: (reference_date - x.max()).days,
            'user_id': 'count',
            'amount': 'sum'
        })
        train_rfm.columns = ['recency', 'frequency', 'monetary']
        
        # Label: Churned if NOT in future_users
        train_rfm['churned'] = (~train_rfm.index.isin(future_users)).astype(int)
        
        X = train_rfm[['recency', 'frequency', 'monetary']]
        y = train_rfm['churned']
        return X, y, ['Recency', 'Frequency', 'Monetary']


    def _compute_shap(self, X, feature_names):
        """Compute SHAP values for model explainability."""
        if not HAS_SHAP:
            logger.warning("SHAP not installed – using feature_importances_ fallback")
            return [{'feature': f, 'importance': float(v), 'direction': 'unknown'}
                    for f, v in zip(feature_names, self.model.feature_importances_)]
        try:
            # Use a smaller sample for faster dashboard updates
            sample_size = min(100, len(X))
            X_sample = X.sample(sample_size, random_state=42) if len(X) > sample_size else X
            explainer = shap.TreeExplainer(self.model)
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
            importances = self.model.feature_importances_
            return [{'feature': f, 'importance': float(v), 'direction': 'unknown'}
                    for f, v in zip(feature_names, importances)]

    # ────────────────────────────────────────────
    #  Per-User Local SHAP Explainability
    # ────────────────────────────────────────────
    def compute_user_shap(self, user_id, rfm_df):
        """Compute local SHAP values for a single user — the 'WHY' behind their score."""
        user_row = rfm_df[rfm_df['user_id'] == str(user_id)]
        if user_row.empty:
            return None

        user = user_row.iloc[0]
        features = user[['recency', 'frequency', 'monetary']].values.reshape(1, -1)
        feature_names = self._feature_names or ['Recency', 'Frequency', 'Monetary']

        result = {
            'user_id': str(user_id),
            'churn_probability': float(user.get('churn_probability', 0)),
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
        original_revenue_risk = float(seg_data['revenue_at_risk'].sum())

        # Apply counterfactual
        sim_data = seg_data.copy()
        multiplier = 1 + (delta_pct / 100.0)
        sim_data[feature_lower] = sim_data[feature_lower] * multiplier

        sim_features = sim_data[['recency', 'frequency', 'monetary']]
        sim_probs = self.model.predict_proba(sim_features)[:, 1]
        simulated_churn = float(sim_probs.mean())
        sim_revenue_risk = float((sim_data['monetary'] * sim_probs).sum())

        reduction = original_churn - simulated_churn
        reduction_pct = (reduction / max(original_churn, 0.001)) * 100

        direction = 'increase' if delta_pct > 0 else 'decrease'
        if reduction > 0:
            rec = f"A {abs(delta_pct):.0f}% {direction} in {feature} for '{segment}' could reduce churn by {reduction_pct:.1f}%, protecting ${original_revenue_risk - sim_revenue_risk:,.0f} in revenue."
        else:
            rec = f"A {abs(delta_pct):.0f}% {direction} in {feature} for '{segment}' may increase churn by {abs(reduction_pct):.1f}%. Not recommended."

        return {
            'segment': segment,
            'feature_modified': feature,
            'delta_pct': delta_pct,
            'original_churn': round(original_churn, 4),
            'simulated_churn': round(simulated_churn, 4),
            'churn_reduction_pct': round(reduction_pct, 2),
            'users_affected': int(seg_mask.sum()),
            'revenue_protected': round(max(original_revenue_risk - sim_revenue_risk, 0), 2),
            'recommendation': rec
        }

    # ────────────────────────────────────────────
    #  Revenue-at-Risk Summary
    # ────────────────────────────────────────────
    def get_revenue_at_risk(self, rfm_df):
        """Total and per-segment revenue at risk."""
        total = float(rfm_df['revenue_at_risk'].sum()) if 'revenue_at_risk' in rfm_df.columns else 0
        by_segment = []
        if 'revenue_at_risk' in rfm_df.columns:
            seg_rar = rfm_df.groupby('segment').agg(
                revenue_at_risk=('revenue_at_risk', 'sum'),
                users=('user_id', 'count'),
                avg_churn=('churn_probability', 'mean')
            ).reset_index()
            by_segment = seg_rar.to_dict(orient='records')
        return {'total': round(total, 2), 'by_segment': by_segment}

    # ────────────────────────────────────────────
    #  Model Versioning
    # ────────────────────────────────────────────
    def _save_model_version(self, metrics):
        """Save trained model with timestamp-based versioning."""
        try:
            ts = datetime.now().strftime('%Y%m%d_%H%M%S')
            fname = f'churn_model_v{ts}.pkl'
            fpath = os.path.join(self._model_dir, fname)
            with open(fpath, 'wb') as f:
                pickle.dump({'model': self.model, 'scaler': self.scaler, 'metrics': metrics, 'features': self._feature_names}, f)
            # Keep only last 5 versions
            versions = sorted([f for f in os.listdir(self._model_dir) if f.endswith('.pkl')])
            for old in versions[:-5]:
                os.remove(os.path.join(self._model_dir, old))
            logger.info(f"Model saved: {fname}")
        except Exception as e:
            logger.error(f"Model save error: {e}")

    def list_model_versions(self):
        """List all saved model versions."""
        versions = []
        if os.path.exists(self._model_dir):
            for f in sorted(os.listdir(self._model_dir)):
                if f.endswith('.pkl'):
                    fpath = os.path.join(self._model_dir, f)
                    ts = f.replace('churn_model_v', '').replace('.pkl', '')
                    try:
                        with open(fpath, 'rb') as fp:
                            data = pickle.load(fp)
                        m = data.get('metrics', {})
                    except:
                        m = {}
                    versions.append({'version': ts, 'timestamp': ts, 'filename': f, 'metrics': m})
        return versions

    # ────────────────────────────────────────────
    #  3. Segment-Level Churn Breakdown
    # ────────────────────────────────────────────
    def get_segment_churn(self, rfm_df):
        """Churn rate & stats per RFM segment with revenue at risk."""
        agg_dict = {
            'avg_churn': ('churn_probability', 'mean'),
            'count': ('user_id', 'count'),
            'avg_monetary': ('monetary', 'mean'),
            'avg_recency': ('recency', 'mean'),
            'avg_frequency': ('frequency', 'mean'),
        }
        if 'revenue_at_risk' in rfm_df.columns:
            agg_dict['total_revenue_at_risk'] = ('revenue_at_risk', 'sum')
        if 'monetary_velocity' in rfm_df.columns:
            agg_dict['avg_monetary_velocity'] = ('monetary_velocity', 'mean')
        if 'recency_deviation' in rfm_df.columns:
            agg_dict['avg_recency_deviation'] = ('recency_deviation', 'mean')
        stats = rfm_df.groupby('segment').agg(**agg_dict).reset_index()
        return stats.to_dict(orient='records')

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

        overall = df[pcol].value_counts().head(8).reset_index()
        overall.columns = ['product', 'count']

        return {
            'by_segment': by_segment,
            'overall': overall.to_dict(orient='records'),
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
        """Generate testable hypotheses backed by real data statistics."""
        hypotheses = []
        high_churn = rfm_df[rfm_df['churn_probability'] > 0.5]
        low_churn = rfm_df[rfm_df['churn_probability'] <= 0.5]

        if len(high_churn) == 0 or len(low_churn) == 0:
            hypotheses.append({
                'driver': 'Behavioral',
                'hypothesis': 'Insufficient churn variance detected. Extend observation window.',
                'impact': 'Low', 'stat': 'N/A', 'test': 'Extend data window'
            })
            return hypotheses

        # ── H1: Recency ──
        rec_churn = high_churn['recency'].mean()
        rec_retain = low_churn['recency'].mean()
        ratio = rec_churn / max(rec_retain, 1)
        hypotheses.append({
            'driver': 'Recency',
            'hypothesis': (
                f"High-risk users average {int(rec_churn)} days since last activity vs "
                f"{int(rec_retain)} days for retained ({ratio:.1f}x gap). "
                f"Re-engagement at day {int(rec_retain + 7)} could reduce churn by ~{min(int(ratio * 5), 25)}%."
            ),
            'impact': 'High',
            'stat': f'{ratio:.1f}x recency gap',
            'test': f'A/B: Re-engage at day {int(rec_retain + 7)}'
        })

        # ── H2: Frequency ──
        freq_churn = high_churn['frequency'].mean()
        freq_retain = low_churn['frequency'].mean()
        churn_pct = len(high_churn) / len(rfm_df) * 100
        hypotheses.append({
            'driver': 'Frequency',
            'hypothesis': (
                f"Churning users average {freq_churn:.1f} transactions vs "
                f"{freq_retain:.1f} for retained. Users with <{int(freq_churn + 1)} "
                f"txns have a {churn_pct:.0f}% churn rate."
            ),
            'impact': 'High',
            'stat': f'{freq_retain:.1f} vs {freq_churn:.1f} avg txns',
            'test': f'A/B: Streak rewards below {int(freq_retain)} txns'
        })

        # ── H3: Monetary ──
        mon_churn = high_churn['monetary'].mean()
        mon_retain = low_churn['monetary'].mean()
        top20 = rfm_df['monetary'].quantile(0.8)
        hv_at_risk = len(high_churn[high_churn['monetary'] > top20])
        hypotheses.append({
            'driver': 'Monetary Value',
            'hypothesis': (
                f"Retained users spend ${mon_retain:,.0f} avg vs ${mon_churn:,.0f} for "
                f"churners. {hv_at_risk} high-value users (>${top20:,.0f} LTV) are at risk."
            ),
            'impact': 'Medium',
            'stat': f'${mon_retain:,.0f} vs ${mon_churn:,.0f} spend',
            'test': f'A/B: Fee rebates above ${top20:,.0f} LTV'
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

        def map_lifecycle(tenure):
            if tenure < 30: return 'New'
            if tenure < 90: return 'Growing'
            if tenure < 180: return 'Mature'
            return 'Veteran'

        user_start['lifecycle'] = user_start['tenure'].apply(map_lifecycle)
        return user_start
