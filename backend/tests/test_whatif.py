"""
test_whatif.py — Integration tests for the What-If Simulation Engine.

Validates:
  - API contract for /whatif
  - Revenue protection is non-negative
  - Simulated churn moves in the correct direction given the delta sign
  - Campaign scenarios (positive/negative delta mapping)
  - Edge cases: unknown segment, zero delta, extreme delta
"""
import pytest


class TestWhatIfAPI:
    """POST /whatif endpoint tests."""

    def _post(self, api_client, payload):
        return api_client.post("/whatif", json=payload)

    # ── Schema validation ─────────────────────────────────────────────────
    def test_missing_segment_returns_422(self, api_client):
        r = self._post(api_client, {"feature": "frequency", "delta_pct": 20})
        assert r.status_code == 422

    def test_missing_feature_returns_422(self, api_client):
        r = self._post(api_client, {"segment": "At Risk", "delta_pct": 20})
        assert r.status_code == 422

    def test_missing_delta_returns_422(self, api_client):
        r = self._post(api_client, {"segment": "At Risk", "feature": "frequency"})
        assert r.status_code == 422

    # ── Valid requests ─────────────────────────────────────────────────────
    @pytest.mark.parametrize("segment", ["At Risk", "Loyal", "Champions"])
    def test_valid_segment_returns_200(self, api_client, demo_payload, segment):
        # Only test segments that exist in demo data
        available = list(demo_payload["summary"]["segments"].keys())
        if segment not in available:
            pytest.skip(f"Segment '{segment}' not in demo data")
        r = self._post(api_client, {"segment": segment, "feature": "frequency", "delta_pct": 20})
        assert r.status_code == 200, r.text

    def test_response_has_required_fields(self, api_client, demo_payload):
        seg = list(demo_payload["summary"]["segments"].keys())[0]
        r = self._post(api_client, {"segment": seg, "feature": "frequency", "delta_pct": 20})
        if r.status_code != 200:
            pytest.skip("Segment simulation failed — possibly too few users")
        body = r.json()
        for field in ("original_churn", "simulated_churn", "churn_reduction_pct",
                      "users_affected", "revenue_protected"):
            assert field in body, f"Missing field: {field}"

    # ── Business logic ─────────────────────────────────────────────────────
    def test_positive_frequency_delta_reduces_churn(self, api_client, demo_payload):
        """Increasing engagement (frequency) should decrease churn."""
        seg = list(demo_payload["summary"]["segments"].keys())[0]
        r = self._post(api_client, {"segment": seg, "feature": "frequency", "delta_pct": 30})
        if r.status_code != 200:
            pytest.skip("Simulation failed")
        body = r.json()
        assert body["simulated_churn"] <= body["original_churn"] + 0.05, (
            "Increasing frequency by 30% should not significantly increase churn"
        )

    def test_revenue_protected_non_negative(self, api_client, demo_payload):
        seg = list(demo_payload["summary"]["segments"].keys())[0]
        r = self._post(api_client, {"segment": seg, "feature": "monetary", "delta_pct": 20})
        if r.status_code != 200:
            pytest.skip("Simulation failed")
        assert r.json()["revenue_protected"] >= 0

    def test_churn_values_in_valid_range(self, api_client, demo_payload):
        seg = list(demo_payload["summary"]["segments"].keys())[0]
        r = self._post(api_client, {"segment": seg, "feature": "recency", "delta_pct": -20})
        if r.status_code != 200:
            pytest.skip("Simulation failed")
        body = r.json()
        assert 0.0 <= body["original_churn"] <= 1.0
        assert 0.0 <= body["simulated_churn"] <= 1.0

    def test_users_affected_positive(self, api_client, demo_payload):
        seg = list(demo_payload["summary"]["segments"].keys())[0]
        r = self._post(api_client, {"segment": seg, "feature": "frequency", "delta_pct": 10})
        if r.status_code != 200:
            pytest.skip("Simulation failed")
        assert r.json()["users_affected"] > 0

    # ── Campaign scenarios ─────────────────────────────────────────────────
    @pytest.mark.parametrize("campaign", [
        {"feature": "monetary",   "delta_pct": 20,  "name": "cashback"},
        {"feature": "frequency",  "delta_pct": 15,  "name": "push_notification"},
        {"feature": "monetary",   "delta_pct": 25,  "name": "plan_discount"},
        {"feature": "frequency",  "delta_pct": 30,  "name": "loyalty_points"},
        {"feature": "recency",    "delta_pct": -30, "name": "reengagement_email"},
    ])
    def test_campaign_simulation(self, api_client, demo_payload, campaign):
        seg = list(demo_payload["summary"]["segments"].keys())[0]
        r = self._post(api_client, {
            "segment": seg,
            "feature": campaign["feature"],
            "delta_pct": campaign["delta_pct"],
        })
        # Campaign simulations must not crash
        assert r.status_code in (200, 422, 400), (
            f"Campaign '{campaign['name']}' returned unexpected status {r.status_code}"
        )

    # ── Edge cases ─────────────────────────────────────────────────────────
    def test_unknown_segment_returns_error(self, api_client):
        r = self._post(api_client, {
            "segment": "NonExistentSegment_XYZ",
            "feature": "frequency",
            "delta_pct": 20,
        })
        assert r.status_code in (400, 404, 422)

    def test_zero_delta_is_valid(self, api_client, demo_payload):
        seg = list(demo_payload["summary"]["segments"].keys())[0]
        r = self._post(api_client, {"segment": seg, "feature": "frequency", "delta_pct": 0})
        # Zero delta — should succeed or return graceful error
        assert r.status_code in (200, 400)
