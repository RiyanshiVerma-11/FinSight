"""
conftest.py — shared Pytest fixtures for FinSight test suite.

Uses an in-memory synthetic dataset so tests are hermetic (no file I/O,
no network, no model files required).
"""
import io
import pytest
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient

# ── app import ─────────────────────────────────────────────────────────────
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from main import app


# ──────────────────────────────────────────────────────────────────────────
# Autouse monkeypatch for check_is_fitted during tests (B11)
# ──────────────────────────────────────────────────────────────────────────
@pytest.fixture(autouse=True, scope="session")
def patch_check_is_fitted():
    import sklearn.utils.validation
    original_check_is_fitted = sklearn.utils.validation.check_is_fitted
    
    def mocked_check_is_fitted(estimator, attributes=None, *, msg=None, all_or_any=all):
        class_name = type(estimator).__name__
        if 'Dummy' in class_name or 'Bad' in class_name or 'Mock' in class_name:
            return
        return original_check_is_fitted(estimator, attributes=attributes, msg=msg, all_or_any=all_or_any)
        
    sklearn.utils.validation.check_is_fitted = mocked_check_is_fitted
    yield
    sklearn.utils.validation.check_is_fitted = original_check_is_fitted


# ──────────────────────────────────────────────────────────────────────────
# Synthetic dataset factory
# ──────────────────────────────────────────────────────────────────────────
def _make_transactions(n_users: int = 200, seed: int = 42) -> pd.DataFrame:
    """
    Generate a minimal synthetic transaction DataFrame that satisfies the
    analytics engine's column requirements.
    """
    rng = np.random.default_rng(seed)
    base = pd.Timestamp("2023-01-01")

    rows = []
    for uid in range(1, n_users + 1):
        # Add a subtle behavioral signal: users with even IDs have higher frequency
        # and more recent transactions, making them less likely to churn.
        is_loyal = (uid % 2 == 0)
        n_tx = int(rng.integers(10, 40)) if is_loyal else int(rng.integers(2, 8))
        
        for _ in range(n_tx):
            # Loyal users have transactions spread across the year, including very recent ones.
            # Churn-prone users have transactions clustered in the past.
            if is_loyal:
                days_ago = int(rng.integers(0, 365))
            else:
                days_ago = int(rng.integers(60, 365)) # Not seen in last 60 days
                
            amount = round(float(rng.uniform(10, 5000)), 2)
            rows.append(
                {
                    "user_id": str(uid),
                    "timestamp": (base + pd.Timedelta(days=days_ago)).strftime(
                        "%Y-%m-%d"
                    ),
                    "amount": amount,
                    "description": rng.choice(
                        ["purchase", "transfer", "topup", "withdrawal"]
                    ),
                }
            )

    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df.sort_values("timestamp").reset_index(drop=True)


@pytest.fixture(scope="session")
def synthetic_df() -> pd.DataFrame:
    return _make_transactions()


@pytest.fixture(scope="session")
def synthetic_csv_bytes(synthetic_df) -> bytes:
    buf = io.BytesIO()
    synthetic_df.to_csv(buf, index=False)
    return buf.getvalue()


@pytest.fixture(scope="session")
def api_client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="session")
def demo_payload(api_client) -> dict:
    """Fetch demo data once per session — used by multiple test modules."""
    resp = api_client.get("/demo-data")
    assert resp.status_code == 200, resp.text
    return resp.json()
