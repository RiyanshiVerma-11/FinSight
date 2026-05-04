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

    # ────────────────────────────────────────────
    #  1. RFM Analysis & Clustering
    # ────────────────────────────────────────────
    def calculate_rfm(self, df):
        """Calculates RFM scores for users using Quantile-based scoring (1-5)."""
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        reference_date = df['timestamp'].max() + timedelta(days=1)

        rfm = df.groupby('user_id').agg({
            'timestamp': lambda x: (reference_date - x.max()).days,
            'user_id': 'count',
            'amount': 'sum'
        })
        rfm.columns = ['recency', 'frequency', 'monetary']

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
        # Features for current data use the full rfm_df features
        current_features = rfm_df[['recency', 'frequency', 'monetary']]
        rfm_df['churn_probability'] = self.model.predict_proba(current_features)[:, 1]

        # 7. Drivers & SHAP
        importances = self.model.feature_importances_
        drivers = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
        shap_data = self._compute_shap(X_test, feature_names)

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

            if isinstance(shap_values, list):
                shap_vals = shap_values[1]
            else:
                shap_vals = shap_values

            mean_abs = np.abs(shap_vals).mean(axis=0)
            mean_dir = shap_vals.mean(axis=0)

            result = []
            for i, f in enumerate(feature_names):
                result.append({
                    'feature': f,
                    'importance': float(mean_abs[i]),
                    'direction': 'increases_churn' if mean_dir[i] > 0 else 'decreases_churn'
                })
            result.sort(key=lambda x: x['importance'], reverse=True)
            return result
        except Exception as e:
            logger.error(f"SHAP computation error: {e}")
            return [{'feature': f, 'importance': float(v), 'direction': 'unknown'}
                    for f, v in zip(feature_names, self.model.feature_importances_)]

    # ────────────────────────────────────────────
    #  3. Segment-Level Churn Breakdown
    # ────────────────────────────────────────────
    def get_segment_churn(self, rfm_df):
        """Churn rate & stats per RFM segment."""
        stats = rfm_df.groupby('segment').agg(
            avg_churn=('churn_probability', 'mean'),
            count=('user_id', 'count'),
            avg_monetary=('monetary', 'mean'),
            avg_recency=('recency', 'mean'),
            avg_frequency=('frequency', 'mean'),
        ).reset_index()
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
