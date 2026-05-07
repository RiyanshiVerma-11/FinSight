"""
Pydantic v2 schemas for strict API request/response validation.
Production-grade type safety for all FinSight endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional


# ── Request Schemas ──

class WhatIfRequest(BaseModel):
    """Request body for What-If counterfactual simulation."""
    segment: str = Field(..., description="Target segment name (e.g., 'At Risk', 'Champions')")
    feature: str = Field(..., description="Feature to modify: 'recency', 'frequency', or 'monetary'")
    delta_pct: float = Field(..., ge=-100, le=500, description="Percentage change to apply (-100 to +500)")


class StreamConfigRequest(BaseModel):
    """Configuration for the real-time event stream."""
    speed_ms: int = Field(default=1500, ge=200, le=10000, description="Event interval in milliseconds")
    event_types: list[str] = Field(
        default=["transaction", "login", "logout", "transaction_fail"],
        description="Types of events to simulate"
    )


# ── Response Schemas ──

class DriverResponse(BaseModel):
    feature: str
    importance: float
    direction: str = "unknown"


class ShapFeature(BaseModel):
    feature: str
    shap_value: float
    direction: str
    explanation: str


class UserShapResponse(BaseModel):
    user_id: str
    churn_probability: float
    risk_threshold: float = 0.5
    revenue_at_risk: float
    predicted_ltv: float
    segment: str
    top_drivers: list[ShapFeature]
    explanation_summary: str


class WhatIfResponse(BaseModel):
    segment: str
    feature_modified: str
    delta_pct: float
    original_churn: float
    simulated_churn: float
    churn_reduction_pct: float
    users_affected: int
    revenue_protected: float
    recommendation: str


class ModelVersionInfo(BaseModel):
    version: str
    timestamp: str
    filename: str
    metrics: dict = Field(default_factory=dict)


class LLMHypothesis(BaseModel):
    title: str
    hypothesis: str
    action: str
    expected_impact: str
    confidence: str = "Medium"


class StreamEvent(BaseModel):
    event_id: str
    user_id: str
    event_type: str
    timestamp: str
    amount: Optional[float] = None
    status: str = "success"
    churn_delta: Optional[float] = None
