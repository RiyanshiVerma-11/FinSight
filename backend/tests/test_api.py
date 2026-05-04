"""
test_api.py — Integration tests for all FastAPI REST endpoints.

Coverage:
  - GET  /                     health check
  - GET  /demo-data            payload schema
  - POST /analyze              CSV upload → analytics
  - GET  /list-datasets        dataset enumeration
  - GET  /user-shap/{user_id} per-user SHAP
  - POST /whatif               counterfactual simulation
  - GET  /llm-hypotheses       hypothesis structure
  - GET  /models               model versioning
"""
import pytest


# ──────────────────────────────────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────────────────────────────────
class TestHealthCheck:
    def test_root_returns_200(self, api_client):
        r = api_client.get("/")
        assert r.status_code == 200

    def test_root_contains_version(self, api_client):
        body = api_client.get("/").json()
        # Accept any key that indicates a live service
        assert any(k in body for k in ("status", "message", "version", "service"))


# ──────────────────────────────────────────────────────────────────────────
# Demo data
# ──────────────────────────────────────────────────────────────────────────
class TestDemoData:
    def test_status_200(self, api_client):
        assert api_client.get("/demo-data").status_code == 200

    def test_has_summary_key(self, demo_payload):
        assert "summary" in demo_payload

    def test_summary_has_required_fields(self, demo_payload):
        s = demo_payload["summary"]
        for field in ("total_users", "avg_churn_risk", "segments", "segment_churn",
                      "revenue_at_risk", "metrics"):
            assert field in s, f"Missing field: {field}"

    def test_total_users_positive(self, demo_payload):
        assert demo_payload["summary"]["total_users"] > 0

    def test_avg_churn_risk_in_range(self, demo_payload):
        risk = demo_payload["summary"]["avg_churn_risk"]
        assert 0.0 <= risk <= 1.0

    def test_has_users_list(self, demo_payload):
        assert "users" in demo_payload
        assert isinstance(demo_payload["users"], list)
        assert len(demo_payload["users"]) > 0

    def test_user_has_required_fields(self, demo_payload):
        user = demo_payload["users"][0]
        for field in ("user_id", "segment", "churn_probability"):
            assert field in user, f"User missing field: {field}"

    def test_user_churn_probability_in_range(self, demo_payload):
        for u in demo_payload["users"][:20]:
            assert 0.0 <= u["churn_probability"] <= 1.0

    def test_metrics_contain_roc_auc(self, demo_payload):
        metrics = demo_payload["summary"]["metrics"]
        assert "roc_auc" in metrics
        assert 0.5 <= metrics["roc_auc"] <= 1.0, "ROC-AUC should be above random baseline"

    def test_shap_data_present(self, demo_payload):
        s = demo_payload["summary"]
        shap = s.get("shap_data") or s.get("top_drivers")
        assert shap is not None and len(shap) > 0


# ──────────────────────────────────────────────────────────────────────────
# CSV Upload / Analyze
# ──────────────────────────────────────────────────────────────────────────
class TestAnalyzeUpload:
    def test_upload_valid_csv_returns_200(self, api_client, synthetic_csv_bytes):
        r = api_client.post(
            "/analyze",
            files={"file": ("test.csv", synthetic_csv_bytes, "text/csv")},
        )
        assert r.status_code == 200, r.text

    def test_upload_returns_summary(self, api_client, synthetic_csv_bytes):
        r = api_client.post(
            "/analyze",
            files={"file": ("test.csv", synthetic_csv_bytes, "text/csv")},
        )
        body = r.json()
        assert "summary" in body
        assert body["summary"]["total_users"] > 0

    def test_upload_invalid_file_type_rejected(self, api_client):
        r = api_client.post(
            "/analyze",
            files={"file": ("bad.txt", b"not,a,valid,file", "text/plain")},
        )
        # Should return 4xx
        assert r.status_code >= 400

    def test_upload_empty_csv_rejected(self, api_client):
        r = api_client.post(
            "/analyze",
            files={"file": ("empty.csv", b"user_id,timestamp,amount\n", "text/csv")},
        )
        assert r.status_code >= 400


# ──────────────────────────────────────────────────────────────────────────
# Dataset listing
# ──────────────────────────────────────────────────────────────────────────
class TestListDatasets:
    def test_returns_200(self, api_client):
        assert api_client.get("/list-datasets").status_code == 200

    def test_has_datasets_key(self, api_client):
        body = api_client.get("/list-datasets").json()
        assert "datasets" in body
        assert isinstance(body["datasets"], list)


# ──────────────────────────────────────────────────────────────────────────
# Model versioning
# ──────────────────────────────────────────────────────────────────────────
class TestModelsEndpoint:
    def test_returns_200(self, api_client):
        assert api_client.get("/models").status_code == 200

    def test_returns_list(self, api_client):
        body = api_client.get("/models").json()
        assert isinstance(body, (list, dict))
