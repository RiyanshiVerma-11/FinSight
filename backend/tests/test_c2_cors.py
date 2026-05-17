import pytest
from fastapi.testclient import TestClient
from main import app

def test_cors_policy():
    client = TestClient(app)
    
    # Valid origins from whitelist
    for origin in [
        "http://localhost:3000",
        "https://finsight-frontend-r0a8.onrender.com",
        "http://localhost:5173",
        "https://finsight-portal.render.com"
    ]:
        response = client.options(
            "/",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Content-Type",
            }
        )
        assert response.headers.get("access-control-allow-origin") == origin
        assert response.headers.get("access-control-allow-credentials") == "true"
    
    # Unauthorized origin should be denied/not returned in the header
    response_bad = client.options(
        "/",
        headers={
            "Origin": "http://unauthorized.domain",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type",
        }
    )
    assert response_bad.headers.get("access-control-allow-origin") is None
