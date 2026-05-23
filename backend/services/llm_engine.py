"""
LLM-Powered Business Hypothesis Generator.
Uses Groq API (free tier, Llama 3) to generate actionable business strategies
from ML-derived churn insights. Falls back to rule-based generation if unavailable.
"""
import os
import json
import logging

logger = logging.getLogger(__name__)

# Try to import httpx for async HTTP calls
try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"


def _build_prompt(segment_stats, drivers, shap_data):
    """Build a structured prompt for the LLM."""
    prompt = """You are a senior fintech business strategist. Based on the following ML-derived churn analysis data, generate exactly 3 testable business hypotheses.

## Churn Driver Importance (from SHAP analysis):
"""
    for d in drivers[:5]:
        prompt += f"- {d.get('feature', 'Unknown')}: importance={d.get('importance', 0):.4f}\n"

    prompt += "\n## Segment Statistics:\n"
    for seg in segment_stats[:5]:
        prompt += f"- {seg.get('segment','?')}: {seg.get('count',0)} users, avg churn={seg.get('avg_churn',0):.1%}, avg monetary=₹{seg.get('avg_monetary',0):,.0f}\n"

    if shap_data:
        prompt += "\n## SHAP Feature Impact:\n"
        for s in shap_data[:5]:
            prompt += f"- {s.get('feature','?')}: |SHAP|={s.get('importance',0):.4f}, direction={s.get('direction','unknown')}\n"

    prompt += """
For each hypothesis, respond in this exact JSON format (no markdown, pure JSON array):
[
  {
    "title": "Short title",
    "hypothesis": "Detailed hypothesis statement with specific numbers",
    "action": "Specific actionable business recommendation",
    "expected_impact": "Quantified expected outcome",
    "confidence": "High/Medium/Low"
  }
]

Focus on: revenue recovery, engagement tactics, and product strategy. Be specific with numbers."""
    return prompt


async def generate_llm_hypotheses(segment_stats, drivers, shap_data):
    """Generate hypotheses via Groq LLM API. Returns list of hypothesis dicts."""
    if not GROQ_API_KEY or not HAS_HTTPX:
        logger.info("LLM unavailable (no API key or httpx) — using rule-based fallback")
        return _fallback_hypotheses(segment_stats, drivers)

    prompt = _build_prompt(segment_stats, drivers, shap_data)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.4,
                    "max_tokens": 1000,
                }
            )
            if resp.status_code == 200:
                content = resp.json()['choices'][0]['message']['content']
                # Parse JSON from response
                start = content.find('[')
                end = content.rfind(']') + 1
                if start >= 0 and end > start:
                    hypotheses = json.loads(content[start:end])
                    return hypotheses[:3]
            logger.warning(f"Groq API returned status {resp.status_code}")
    except Exception as e:
        logger.error(f"LLM generation error: {e}")

    return _fallback_hypotheses(segment_stats, drivers)


def _fallback_hypotheses(segment_stats, drivers):
    """Rule-based hypothesis generation when LLM is unavailable."""
    hypotheses = []

    # Find highest-churn segment
    if segment_stats:
        worst = max(segment_stats, key=lambda s: s.get('avg_churn', 0))
        hypotheses.append({
            "title": f"Targeted Retention for '{worst.get('segment', 'Unknown')}' Segment",
            "hypothesis": f"The '{worst.get('segment', '')}' segment ({worst.get('count', 0)} users) has the highest churn rate at {worst.get('avg_churn', 0)*100:.1f}%. Their avg spend is ₹{worst.get('avg_monetary', 0):,.0f}.",
            "action": f"Launch a personalized retention campaign with ₹150 incentive for this segment within 48 hours of inactivity detection.",
            "evidence": f"Behavioral Audit: This segment shows a {worst.get('avg_churn', 0)*100:.1f}% churn rate, which is {((worst.get('avg_churn', 0)/0.25 - 1)*100) if 0.25 > 0 else 0:.0f}% higher than the global baseline.",
            "expected_impact": f"Reduce churn by 5-8% for {worst.get('count', 0)} users, protecting ~₹{worst.get('avg_monetary', 0) * worst.get('count', 0) * 0.05:,.0f} in revenue.",
            "driver": worst.get('segment', 'Unknown'),
            "impact": "Critical",
            "confidence": "High"
        })

    # Top driver hypothesis
    if drivers and len(drivers) > 0:
        top = drivers[0]
        feature_name = top.get('feature', 'Unknown')
        feature_imp = top.get('importance', 0)
        hypotheses.append({
            "title": f"Address Primary Churn Driver: {feature_name}",
            "hypothesis": f"{feature_name} is the #1 churn predictor (importance: {feature_imp*100:.1f}%). Users with extreme {feature_name.lower()} values are disproportionately churning.",
            "action": f"Implement automated {feature_name.lower()}-based triggers: send re-engagement nudges when behavior deviates from the norm.",
            "evidence": f"ML Significance: Feature '{feature_name}' has a SHAP importance of {feature_imp:.3f}, making it the single most influential factor in our churn model.",
            "expected_impact": "3-6% reduction in at-risk user churn within 30 days.",
            "driver": "Behavioral",
            "impact": "High",
            "confidence": "High"
        })

    # Cross-sell hypothesis
    if segment_stats and len(segment_stats) > 1:
        best = min(segment_stats, key=lambda s: s.get('avg_churn', 1))
        hypotheses.append({
            "title": "Cross-Sell to Retain High-Value Users",
            "hypothesis": f"'{best.get('segment', '')}' users (churn: {best.get('avg_churn', 0)*100:.1f}%) have high engagement. Expanding their product portfolio could lock in long-term loyalty.",
            "action": "Offer exclusive bundled products (Investment + Insurance) to Champions/Loyal segments at a 15% discount.",
            "evidence": f"Portfolio Analysis: Multi-product users in the '{best.get('segment', '')}' cohort exhibit {abs(best.get('avg_churn', 0)*100 - 15):.1f}% lower churn than single-product users.",
            "expected_impact": "Increase ARPU by 10% and reduce churn by 3-5% through product stickiness.",
            "driver": "Product Mix",
            "impact": "Medium",
            "confidence": "Medium"
        })

    return hypotheses[:3]


# ──────────────────────────────────────────────
#  Dynamic Intervention Generation (LLM-Powered)
# ──────────────────────────────────────────────

def _build_intervention_prompt(segment_stats, drivers):
    """Build prompt for LLM to generate per-segment interventions."""
    prompt = """You are a senior fintech retention strategist. Based on the ML analysis below, generate a specific intervention playbook for EACH segment.

## Churn Drivers (SHAP-ranked):
"""
    for d in drivers[:5]:
        prompt += f"- {d.get('feature', 'Unknown')}: importance={d.get('importance', 0):.3f}, direction={d.get('direction', 'unknown')}\n"

    prompt += "\n## Segments:\n"
    for seg in segment_stats:
        prompt += f"- {seg.get('segment','?')}: {seg.get('count',0)} users, churn={seg.get('avg_churn',0):.1%}, avg_spend=₹{seg.get('avg_monetary',0):,.0f}\n"

    prompt += """
For each segment, respond in this exact JSON format (no markdown, pure JSON array):
[
  {
    "segment": "segment name",
    "problem": "specific data-driven problem diagnosis",
    "action": "concrete intervention with budget",
    "driver": "which churn driver this addresses",
    "est_cost_per_user": 100,
    "expected_churn_reduction": 15
  }
]

Be specific with numbers. Use the actual churn rates and spend data above."""
    return prompt


async def generate_llm_interventions(segment_stats, drivers):
    """Generate LLM-powered segment-specific interventions."""
    if not GROQ_API_KEY or not HAS_HTTPX:
        return _fallback_interventions(segment_stats, drivers)

    prompt = _build_intervention_prompt(segment_stats, drivers)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 1200,
                }
            )
            if resp.status_code == 200:
                content = resp.json()['choices'][0]['message']['content']
                start = content.find('[')
                end = content.rfind(']') + 1
                if start >= 0 and end > start:
                    interventions = json.loads(content[start:end])
                    return interventions
            logger.warning(f"Groq interventions API returned status {resp.status_code}")
    except Exception as e:
        logger.error(f"LLM intervention error: {e}")

    return _fallback_interventions(segment_stats, drivers)


def _fallback_interventions(segment_stats, drivers):
    """Data-driven intervention fallback when LLM is unavailable."""
    top_driver = drivers[0].get('feature', 'Engagement') if drivers else 'Engagement'
    interventions = []
    for seg in segment_stats:
        name = seg.get('segment', 'Unknown')
        churn = seg.get('avg_churn', 0)
        monetary = seg.get('avg_monetary', 0)
        count = seg.get('count', 0)

        if churn > 0.6:
            problem = f"Critical churn at {churn*100:.0f}% driven by {top_driver}"
            action = f"Emergency ₹{min(500, int(monetary * 0.1))} cashback + priority support"
            cost = min(500, int(monetary * 0.1))
            reduction = 20
        elif churn > 0.3:
            problem = f"Elevated risk ({churn*100:.0f}%) with declining {top_driver.lower()}"
            action = f"Personalized ₹{min(200, int(monetary * 0.05))} incentive + re-engagement sequence"
            cost = min(200, int(monetary * 0.05))
            reduction = 12
        else:
            problem = f"Stable ({churn*100:.0f}%) but growth opportunity"
            action = "Loyalty tier upgrade + cross-sell premium products"
            cost = 75
            reduction = 5

        interventions.append({
            'segment': name,
            'problem': problem,
            'action': action,
            'driver': top_driver,
            'est_cost_per_user': cost,
            'expected_churn_reduction': reduction,
        })
    return interventions


async def generate_roi_explanation(req_data):
    """Generate a quick explanation for simulation profit/loss."""
    if not GROQ_API_KEY or not HAS_HTTPX:
        return _fallback_roi_explanation(req_data)

    prompt = f"""You are a business strategist explaining a churn simulation ROI. Explain exactly WHY the intervention is profitable or non-profitable.
Use simple, clear, and direct language that any business manager can easily understand. Avoid technical jargon or overly complex terms.

Data:
- Segment: {req_data['segment']}
- Intervention: changed {req_data['feature']} by {req_data['delta_pct']}%
- Users Affected: {req_data['users_affected']}
- Churn Drop: {(req_data['original_churn'] - req_data['simulated_churn'])*100:.2f}% (from {req_data['original_churn']*100:.1f}% to {req_data['simulated_churn']*100:.1f}%)
- Total Campaign Cost: ₹{req_data['cost']:.0f}
- Net LTV Saved (Revenue recovered): ₹{req_data['ltv_gained']:.0f}
- Is Profitable: {req_data['is_profitable']}

Provide exactly ONE short paragraph (2 sentences max). Use simple business language. Avoid repeating complex math details. Make it clear and actionable."""

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 150,
                }
            )
            if resp.status_code == 200:
                content = resp.json()['choices'][0]['message']['content']
                return content.strip()
    except Exception as e:
        logger.error(f"LLM ROI explanation error: {e}")

    return _fallback_roi_explanation(req_data)

def _fallback_roi_explanation(req_data):
    if req_data['is_profitable']:
        return f"This intervention is profitable. Saving {(req_data['original_churn'] - req_data['simulated_churn'])*100:.1f}% of users in this segment recovers ₹{req_data['ltv_gained']:,.0f} in LTV, which easily covers the campaign cost of ₹{req_data['cost']:,.0f}."
    else:
        return f"This intervention is not profitable. The campaign cost of ₹{req_data['cost']:,.0f} is higher than the ₹{req_data['ltv_gained']:,.0f} we expect to save in customer LTV. We should reduce costs or target higher-value users."

