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
        n_tx = int(rng.integers(3, 30))
        for _ in range(n_tx):
            days_ago = int(rng.integers(0, 365))
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
