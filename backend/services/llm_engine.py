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
        prompt += f"- {d[0]}: importance={d[1]:.4f}\n"

    prompt += "\n## Segment Statistics:\n"
    for seg in segment_stats[:5]:
        prompt += f"- {seg.get('segment','?')}: {seg.get('count',0)} users, avg churn={seg.get('avg_churn',0):.1%}, avg monetary=${seg.get('avg_monetary',0):,.0f}\n"

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
            "hypothesis": f"The '{worst.get('segment', '')}' segment ({worst.get('count', 0)} users) has the highest churn rate at {worst.get('avg_churn', 0)*100:.1f}%. Their avg spend is ${worst.get('avg_monetary', 0):,.0f}.",
            "action": f"Launch a personalized retention campaign with 10% cashback for this segment within 48 hours of inactivity detection.",
            "expected_impact": f"Reduce churn by 15-20% for {worst.get('count', 0)} users, recovering ~${worst.get('avg_monetary', 0) * worst.get('count', 0) * 0.15:,.0f} in revenue.",
            "confidence": "High"
        })

    # Top driver hypothesis
    if drivers and len(drivers) > 0:
        top = drivers[0]
        hypotheses.append({
            "title": f"Address Primary Churn Driver: {top[0]}",
            "hypothesis": f"{top[0]} is the #1 churn predictor (importance: {top[1]*100:.1f}%). Users with extreme {top[0].lower()} values are disproportionately churning.",
            "action": f"Implement automated {top[0].lower()}-based triggers: send re-engagement nudges when {top[0].lower()} crosses the 75th percentile threshold.",
            "expected_impact": "10-25% reduction in at-risk user churn within 30 days.",
            "confidence": "High"
        })

    # Cross-sell hypothesis
    if segment_stats and len(segment_stats) > 1:
        best = min(segment_stats, key=lambda s: s.get('avg_churn', 1))
        hypotheses.append({
            "title": "Cross-Sell to Retain High-Value Users",
            "hypothesis": f"'{best.get('segment', '')}' users (churn: {best.get('avg_churn', 0)*100:.1f}%) have high engagement. Expanding their product portfolio could lock in long-term loyalty.",
            "action": "Offer exclusive bundled products (Investment + Insurance) to Champions/Loyal segments at a 15% discount.",
            "expected_impact": "Increase ARPU by 20% and reduce churn by 8% through product stickiness.",
            "confidence": "Medium"
        })

    return hypotheses[:3]
