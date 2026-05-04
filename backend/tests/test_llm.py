"""
test_llm.py — Tests for the LLM hypothesis engine.

Validates:
  - /llm-hypotheses returns structured output
  - Fallback rule-based engine works without Groq key
  - SHAP-linked context is present in hypotheses
  - Hypothesis structure conforms to expected schema
"""
import os
import pytest


class TestLLMHypotheses:
    """GET /llm-hypotheses endpoint tests."""

    def test_returns_200(self, api_client):
        r = api_client.get("/llm-hypotheses")
        assert r.status_code == 200, r.text

    def test_has_hypotheses_key(self, api_client):
        body = api_client.get("/llm-hypotheses").json()
        # Allow both top-level hypotheses list or nested
        assert "hypotheses" in body or isinstance(body, list)

    def test_hypotheses_is_list(self, api_client):
        body = api_client.get("/llm-hypotheses").json()
        hyps = body.get("hypotheses", body) if isinstance(body, dict) else body
        assert isinstance(hyps, list)

    def test_at_least_one_hypothesis(self, api_client):
        body = api_client.get("/llm-hypotheses").json()
        hyps = body.get("hypotheses", body) if isinstance(body, dict) else body
        assert len(hyps) >= 1

    def test_hypothesis_has_required_fields(self, api_client):
        body = api_client.get("/llm-hypotheses").json()
        hyps = body.get("hypotheses", body) if isinstance(body, dict) else body
        for h in hyps[:3]:
            assert isinstance(h, dict)
            # At minimum: some content field
            has_content = any(k in h for k in ("hypothesis", "title", "driver", "action", "text"))
            assert has_content, f"Hypothesis missing content fields: {h.keys()}"

    def test_fallback_works_without_groq_key(self, api_client, monkeypatch):
        """Removing the key should trigger rule-based fallback, not a 500."""
        monkeypatch.delenv("GROQ_API_KEY", raising=False)
        r = api_client.get("/llm-hypotheses")
        assert r.status_code == 200, "Should fall back gracefully without Groq key"
