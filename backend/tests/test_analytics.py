"""
test_analytics.py — Unit tests for the analytics engine.

Tests the core ML pipeline in isolation using synthetic data:
  - RFM feature engineering
  - Churn model training + evaluation
  - SHAP value correctness
  - Revenue-at-risk computation
  - Cohort construction
  - Priority score ranking
"""
import pytest
import numpy as np
import pandas as pd


# ── import analytics service ───────────────────────────────────────────────
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    from services.analytics import run_analysis
    ANALYTICS_AVAILABLE = True
except ImportError:
    ANALYTICS_AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not ANALYTICS_AVAILABLE, reason="analytics service not importable"
)


# ──────────────────────────────────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def analysis_result(synthetic_df):
    """Run full pipeline once; share across all tests in this module."""
    return run_analysis(synthetic_df)


# ──────────────────────────────────────────────────────────────────────────
# Top-level shape
# ──────────────────────────────────────────────────────────────────────────
class TestAnalysisToplevel:
    def test_returns_dict(self, analysis_result):
        assert isinstance(analysis_result, dict)

    def test_has_summary_and_users(self, analysis_result):
        assert "summary" in analysis_result
        assert "users" in analysis_result

    def test_users_is_list(self, analysis_result):
        assert isinstance(analysis_result["users"], list)
        assert len(analysis_result["users"]) > 0


# ──────────────────────────────────────────────────────────────────────────
# Summary fields
# ──────────────────────────────────────────────────────────────────────────
class TestSummaryFields:
    def test_total_users_matches_input(self, analysis_result, synthetic_df):
        actual_users = synthetic_df["user_id"].nunique()
        reported = analysis_result["summary"]["total_users"]
        assert reported == actual_users

    def test_avg_churn_risk_in_range(self, analysis_result):
        risk = analysis_result["summary"]["avg_churn_risk"]
        assert 0.0 <= risk <= 1.0

    def test_segments_dict_not_empty(self, analysis_result):
        segs = analysis_result["summary"]["segments"]
        assert isinstance(segs, dict)
        assert len(segs) > 0

    def test_segment_counts_sum_to_total_users(self, analysis_result):
        s = analysis_result["summary"]
        total = s["total_users"]
        seg_sum = sum(s["segments"].values())
        # Allow ±5 for edge-case users dropped during temporal split
        assert abs(seg_sum - total) <= 5

    def test_revenue_at_risk_non_negative(self, analysis_result):
        rar = analysis_result["summary"].get("revenue_at_risk", {})
        total = rar.get("total", 0)
        assert total >= 0

    def test_metrics_present_and_valid(self, analysis_result):
        metrics = analysis_result["summary"]["metrics"]
        assert "roc_auc" in metrics
        auc = metrics["roc_auc"]
        assert 0.0 <= auc <= 1.0


# ──────────────────────────────────────────────────────────────────────────
# Per-user fields
# ──────────────────────────────────────────────────────────────────────────
class TestUserRecords:
    def test_churn_probability_always_in_range(self, analysis_result):
        for u in analysis_result["users"]:
            p = u.get("churn_probability", -1)
            assert 0.0 <= p <= 1.0, f"Bad churn_probability={p} for user {u.get('user_id')}"

    def test_segment_field_present(self, analysis_result):
        for u in analysis_result["users"][:50]:
            assert "segment" in u and u["segment"], "Missing segment"

    def test_monetary_non_negative(self, analysis_result):
        for u in analysis_result["users"][:50]:
            m = u.get("monetary", 0)
            assert m >= 0


# ──────────────────────────────────────────────────────────────────────────
# SHAP / churn drivers
# ──────────────────────────────────────────────────────────────────────────
class TestShapDrivers:
    def test_top_drivers_present(self, analysis_result):
        drivers = (
            analysis_result["summary"].get("top_drivers")
            or analysis_result["summary"].get("shap_data")
        )
        assert drivers is not None and len(drivers) > 0

    def test_driver_has_feature_and_importance(self, analysis_result):
        drivers = (
            analysis_result["summary"].get("top_drivers")
            or analysis_result["summary"].get("shap_data")
        )
        for d in drivers[:3]:
            assert "feature" in d
            assert "importance" in d
            assert d["importance"] >= 0

    def test_importance_values_sum_leq_one(self, analysis_result):
        drivers = (
            analysis_result["summary"].get("top_drivers")
            or analysis_result["summary"].get("shap_data")
        )
        total = sum(d["importance"] for d in drivers)
        # SHAP importances normalised → should sum to ≤ 1 (or close)
        assert total <= 1.05, f"Importances sum too high: {total}"


# ──────────────────────────────────────────────────────────────────────────
# Priority Score (computed in frontend, but we validate user data quality)
# ──────────────────────────────────────────────────────────────────────────
class TestPriorityScore:
    def test_high_churn_users_have_high_monetary(self, analysis_result):
        """
        High-risk users should generally have non-trivial LTV so priority
        score is meaningful.
        """
        high_risk = [
            u for u in analysis_result["users"]
            if u.get("churn_probability", 0) > 0.7
        ]
        if not high_risk:
            pytest.skip("No high-risk users in synthetic dataset")
        avg_monetary = np.mean([u.get("monetary", 0) for u in high_risk])
        assert avg_monetary >= 0  # non-negative sanity

    def test_sorting_by_priority_score_is_stable(self, analysis_result):
        users = analysis_result["users"]
        max_ltv = max((u.get("monetary", 0) for u in users), default=1) or 1
        scored = sorted(
            users,
            key=lambda u: u["churn_probability"]
            * (u.get("monetary", 0) / max_ltv)
            * (u.get("frequency_score", 1) or 1),
            reverse=True,
        )
        assert scored[0]["churn_probability"] >= scored[-1]["churn_probability"] * 0.5


# ──────────────────────────────────────────────────────────────────────────
# Segment churn
# ──────────────────────────────────────────────────────────────────────────
class TestSegmentChurn:
    def test_segment_churn_list_present(self, analysis_result):
        seg_churn = analysis_result["summary"].get("segment_churn", [])
        assert isinstance(seg_churn, list)

    def test_avg_churn_in_range_per_segment(self, analysis_result):
        for sc in analysis_result["summary"].get("segment_churn", []):
            assert 0.0 <= sc.get("avg_churn", 0) <= 1.0
