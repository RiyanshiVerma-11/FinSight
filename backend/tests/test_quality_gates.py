"""
Production quality gates for model and analytics output.

These checks are intentionally modest and deterministic so CI can fail early
when regressions break baseline model quality or response integrity.
"""
import pytest

from services.analytics import run_analysis


# Minimum acceptable thresholds for this project baseline.
MIN_ROC_AUC = 0.65
MIN_ACCURACY = 0.60
MAX_NULL_PCT = 5.0


@pytest.fixture(scope="module")
def quality_result(synthetic_df):
    return run_analysis(synthetic_df)


def test_quality_gate_roc_auc(quality_result):
    auc = quality_result["summary"]["metrics"].get("roc_auc", 0.0)
    assert auc >= MIN_ROC_AUC, f"ROC-AUC regression: {auc:.4f} < {MIN_ROC_AUC:.2f}"


def test_quality_gate_accuracy(quality_result):
    acc = quality_result["summary"]["metrics"].get("accuracy", 0.0)
    assert acc >= MIN_ACCURACY, f"Accuracy regression: {acc:.4f} < {MIN_ACCURACY:.2f}"


def test_quality_gate_data_health(quality_result):
    null_pct = quality_result["summary"]["data_health"]["metrics"].get("null_pct", 100.0)
    assert null_pct <= MAX_NULL_PCT, f"Data health regression: null_pct={null_pct:.2f}% > {MAX_NULL_PCT:.2f}%"


def test_quality_gate_top_drivers_present(quality_result):
    drivers = quality_result["summary"].get("top_drivers") or []
    assert len(drivers) >= 3, "Expected at least top-3 churn drivers"
