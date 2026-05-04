# FinSight v3.0 — AI-Powered Churn Intelligence Platform

<div align="center">

> **Predict · Explain · Intervene · Protect Revenue**
>
> An enterprise-grade analytics engine that transforms raw fintech transaction data into actionable churn intelligence — with per-user SHAP explainability, counterfactual simulation, AI-generated strategy playbooks, and a real-time intervention engine.

[![Python](https://img.shields.io/badge/Python-3.10+-3776ab?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0-orange)](https://xgboost.readthedocs.io/)
[![SHAP](https://img.shields.io/badge/SHAP-0.44-blueviolet)](https://shap.readthedocs.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed?logo=docker&logoColor=white)](https://docs.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-22c55e)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-Passing-22c55e)](tests/)

</div>

---

## 🏆 Competitive Differentiation

| Dimension | Standard Project (Top 10%) | **FinSight v3.0 (Top 1%)** |
|-----------|---------------------------|--------------------------|
| **Prediction** | Binary churn (Yes/No) | **Probability + Revenue at Risk** |
| **Segments** | Simple K-Means | **Dynamic RFM + Behavioral Trajectories** |
| **Explainability** | Static charts | **Per-user Local SHAP Waterfall** |
| **Action** | None | **AI Hypothesis Engine (SHAP-linked)** |
| **Simulation** | None | **What-If + Campaign Simulator** |
| **Prioritization** | None | **Priority Score = Churn × Revenue × Engagement** |
| **Intervention** | None | **Prescriptive Action Playbook per Segment** |
| **Executive View** | None | **One-screen Judge/CEO Dashboard** |
| **Churn Drivers** | Generic | **Global Top 3 SHAP Drivers with impact %** |
| **Data Ingestion** | CSV only | **CSV/XLSX + Real-Time WebSocket** |
| **Validation** | None | **Pydantic v2 Strict Schemas** |
| **Model Management** | Single model | **Timestamped Model Versioning** |

---

## ✨ Feature Catalogue

### 1. 🧠 Dynamic RFM Intelligence
- **Inter-Purchase Interval (IPI)**: Median days between purchases per user. Detects *silently churning* users whose inactivity exceeds their own behavioral norm.
- **Recency Deviation**: `actual_recency − expected_recency_from_IPI` — personalized churn signal beyond raw recency.
- **Monetary Velocity**: `total_spent / account_age_days` — distinguishes high-value vs. high-volume users.
- Quantile-based RFM scoring (1–5) + K-Means clustering with Silhouette Score validation.

### 2. 🔍 Per-User Local SHAP Explainability
- Click any user row → modal renders their individual SHAP waterfall.
- *"85% churn risk BECAUSE Recency pushes risk +0.187, Frequency reduces it −0.042"*
- Color-coded bars: 🔴 increases churn, 🟢 decreases churn. Revenue-at-risk per user.

### 3. 🎯 What-If Counterfactual Simulation Engine
- **Manual mode**: Segment → Feature → % delta → Run → instant impact.
- **Campaign Simulator** *(new)*: Pick from 5 real campaigns:
  - 💰 ₹100 Cashback · 📱 Push Notification · 🏷️ Plan Discount (20%) · 🏆 Loyalty Points · 📧 Re-engagement Email
- **Impact Hero Card**: Animated *"You just saved ₹8,40,000"* banner.
- **Impact Summary**: Churn ↓ · Revenue Protected · Users Saved.

### 4. 📊 Top 3 Churn Drivers (Global) *(new)*
Prominent animated bar section showing global SHAP impact:
```
🔴 Recency deviation   → 42% impact  ↑ increases churn
🔴 Frequency drop      → 31% impact  ↑ increases churn
🟢 High monetary       → 18% impact  ↓ reduces churn
```

### 5. 🎮 Intervention Engine *(new)*
Prescriptive action playbook — segment-specific, judge-ready table:

| Segment | Problem | Recommended Action | Urgency |
|---------|---------|-------------------|---------|
| 🚨 At Risk | High recency deviation | Send ₹100 cashback offer | CRITICAL |
| 💎 Loyal | Frequency plateau | Launch loyalty reward program | HIGH |
| 👑 Champions | Needs nurturing | Exclusive VIP upgrade offer | MEDIUM |
| 😴 Hibernating | High IPI deviation | Re-engagement email + push | HIGH |
| 💔 Lost | Very high churn probability | Win-back campaign | CRITICAL |

### 6. 🏆 Executive Dashboard Mode *(new)*
One-screen judge/CEO view (press **"Exec View"** button in header):
- **4 KPI cards**: Total Users · Avg Churn Risk · Revenue at Risk · Potential Revenue Saved
- **Before vs After FinSight** comparison table
- **Top Priority Action** with estimated $ impact
- **Churn by Segment** animated bars

### 7. 🥇 Priority Score Ranking *(new)*
User table sorted by `Priority Score = churn_probability × (LTV / max_LTV) × engagement_sensitivity`:
- 🥇🥈🥉 medals for top 3 at-risk users
- **🔥 URGENT / ⚠️ HIGH / 📌 MONITOR** badges
- *"Top 50 Users to Save TODAY"* — actionable daily list for ops teams

### 8. 🧠 SHAP-Linked AI Hypotheses *(upgraded)*
Each AI hypothesis now displays its SHAP context chip:
```
"Because Recency ↑ (42% impact) → offer cashback campaign"
```
Ties the LLM reasoning directly to quantitative ML drivers — making AI recommendations auditable.

### 9. 📡 Real-Time WebSocket Event Stream
Simulated fintech events: transactions, logins, plan downgrades, support tickets — with live churn impact indicators and animated ticker.

### 10. 📈 Cohort Retention Heatmap
User cohorts grouped by acquisition month. Color-coded retention matrix across M0–M12.

### 11. 💡 Predicted LTV
Heuristic LTV model: `historical_spend × (1 − churn_probability) × tenure_multiplier`.

---

## 🏗️ System Architecture

```mermaid
graph TB
    classDef frontend fill:#eef2ff,stroke:#6366f1,stroke-width:2px
    classDef backend fill:#f0fdf4,stroke:#16a34a,stroke-width:2px
    classDef engine fill:#fdf4ff,stroke:#9333ea,stroke-width:2px
    classDef infra fill:#fff7ed,stroke:#ea580c,stroke-width:2px

    subgraph FE ["Frontend (React 19 + Vite 8)"]
        HD[Header + Exec Button]
        ED[Executive Dashboard Modal]
        ST[Stats + Segment Charts]
        WI[What-If + Campaign Simulator]
        IE[Intervention Engine Table]
        HY[SHAP-Linked Hypotheses]
        UT[Priority-Ranked User Table]
        LT[Live WebSocket Ticker]
        SM[SHAP User Modal]
    end

    subgraph API ["Backend API (FastAPI)"]
        AN[POST /analyze]
        AL[GET /analyze-local]
        DD[GET /demo-data]
        US[GET /user-shap/{id}]
        WF[POST /whatif]
        LH[GET /llm-hypotheses]
        WS[WS /stream]
        LD[GET /list-datasets]
        MV[GET /models]
    end

    subgraph AE ["Analytics Engine"]
        RFM[Dynamic RFM + IPI]
        CM[RF + XGBoost Ensemble]
        SH[SHAP TreeExplainer]
        WIF[Counterfactual Engine]
        RAR[Revenue at Risk]
        COH[Cohort Analysis]
        LTV[Predicted LTV]
    end

    subgraph SVC ["Services"]
        LLM[LLM Engine — Groq/Llama3]
        DG[Fintech Data Generator]
        MVM[Model Version Manager]
    end

    FE -->|REST + WS| API
    API --> AE
    AE --> SVC

    class FE,HD,ED,ST,WI,IE,HY,UT,LT,SM frontend
    class API,AN,AL,DD,US,WF,LH,WS,LD,MV backend
    class AE,RFM,CM,SH,WIF,RAR,COH,LTV engine
    class SVC,LLM,DG,MVM infra
```

### Analytics Pipeline

```
Raw CSV/XLSX
     │
     ▼
[1] Data Validation (Pydantic v2)
     │
     ▼
[2] Dynamic RFM (IPI · Recency Deviation · Monetary Velocity · Quantile Scoring)
     │
     ▼
[3] Temporal Split (past window → features | future window → labels) ← prevents leakage
     │
     ▼
[4] Churn Model (Random Forest + XGBoost | Stratified 5-Fold CV | ROC-AUC)
     │
     ▼
[5] SHAP (Global TreeExplainer + Per-user local values)
     │
     ▼
[6] Revenue-at-Risk (monetary × churn_probability per user + segment rollup)
     │
     ▼
[7] Priority Score (churn × revenue × engagement sensitivity → ranked list)
     │
     ▼
[8] Intervention Engine (segment → problem → action playbook)
     │
     ▼
[9] Hypothesis Generation (LLM via Groq API | SHAP-linked context | rule-based fallback)
     │
     ▼
[10] JSON Response → React Dashboard
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **API** | FastAPI 0.104 | Async REST + WebSocket server |
| **Validation** | Pydantic v2 | Strict request/response schemas |
| **ML** | Scikit-learn 1.3, XGBoost 2.0 | Churn classification |
| **Explainability** | SHAP 0.44 | Global + local feature attribution |
| **Data** | Pandas 2.1, NumPy 1.26 | Feature engineering |
| **LLM** | Groq API (Llama 3 70B) | AI hypothesis generation |
| **Frontend** | React 19, Vite 8 | SPA dashboard |
| **Animation** | Framer Motion | Micro-animations |
| **Charts** | Recharts | Data visualization |
| **Icons** | Lucide React | UI icons |
| **Real-Time** | WebSocket, AsyncIO | Live event stream |
| **DevOps** | Docker, Docker Compose | Containerization |
| **Deployment** | Render.com | Cloud hosting |
| **Testing** | Pytest, HTTPX, Vitest | Backend + frontend tests |

---

## 📦 Getting Started

### Prerequisites
- Python 3.10+ and Node.js 18+, **or** Docker Desktop

### Option A — Docker (Recommended)
```bash
git clone https://github.com/RiyanshiVerma-11/FinSight.git
cd FinSight

# Optional: add your Groq key for AI features
cp .env.example .env
# Edit .env → set GROQ_API_KEY=gsk_...

docker-compose up --build
```
| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |

### Option B — Local Development
```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Optional: Enable AI Hypotheses
```bash
# Free key at https://console.groq.com
export GROQ_API_KEY=gsk_your_key_here
```

---

## 🧪 Testing

FinSight ships with a comprehensive test suite covering the analytics engine, API endpoints, and UI components.

### Backend Tests (Pytest + HTTPX)

```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest tests/ -v --tb=short
```

**Test coverage:**

| Module | Tests | Description |
|--------|-------|-------------|
| `test_analytics.py` | 12 | RFM engine, churn model, SHAP, revenue-at-risk |
| `test_api.py` | 15 | All REST endpoints, schema validation, error handling |
| `test_whatif.py` | 6 | Counterfactual simulation, campaign scenarios |
| `test_priority.py` | 4 | Priority score ranking correctness |
| `test_llm.py` | 5 | LLM engine, SHAP-linked context, fallback |

### Frontend Tests (Vitest + React Testing Library)

```bash
cd frontend
npm test
npm run test:coverage   # Coverage report
```

**Test coverage:**

| Component | Tests | Description |
|-----------|-------|-------------|
| `WhatIfPanel.test.jsx` | 8 | Campaign selection, simulation, impact card rendering |
| `ExecutiveDashboard.test.jsx` | 6 | KPI rendering, before/after table, close handler |
| `InterventionEngine.test.jsx` | 5 | Segment mapping, urgency labels, action display |
| `PriorityScore.test.jsx` | 4 | Sort order, medal rendering, score calculation |
| `App.test.jsx` | 10 | Data loading, dataset switching, export flows |

### Run All Tests
```bash
# From project root
cd backend && pytest tests/ -v
cd ../frontend && npm test -- --run
```

---

## 📊 API Reference

### Core Endpoints

| Method | Endpoint | Body / Params | Response |
|--------|----------|---------------|----------|
| `GET` | `/` | — | Health check + capabilities |
| `GET` | `/demo-data` | — | Full analytics payload |
| `POST` | `/analyze` | `multipart/form-data` (CSV/XLSX) | Full analytics payload |
| `GET` | `/analyze-local` | `?filename=<name>` | Full analytics payload |
| `GET` | `/list-datasets` | — | `{ datasets: string[] }` |
| `GET` | `/user-shap/{user_id}` | — | Per-user SHAP waterfall |
| `POST` | `/whatif` | `WhatIfRequest` | `WhatIfResponse` |
| `GET` | `/llm-hypotheses` | — | Structured AI hypotheses |
| `GET` | `/models` | — | Model version metadata |
| `WS` | `/stream` | — | Real-time event stream |

### Request / Response Schemas

**`POST /whatif`**
```json
// Request
{
  "segment": "At Risk",
  "feature": "frequency",
  "delta_pct": 20
}

// Response
{
  "segment": "At Risk",
  "feature": "frequency",
  "delta_pct": 20,
  "original_churn": 0.72,
  "simulated_churn": 0.54,
  "churn_reduction_pct": -18.0,
  "users_affected": 312,
  "revenue_protected": 840000,
  "recommendation": "Increasing frequency by 20% could save ₹8,40,000..."
}
```

**Analytics Payload (abbreviated)**
```json
{
  "summary": {
    "total_users": 5000,
    "avg_churn_risk": 0.34,
    "segments": { "At Risk": 820, "Loyal": 1240, "Champions": 650 },
    "segment_churn": [{ "segment": "At Risk", "avg_churn": 0.72, "revenue_at_risk": 240000 }],
    "shap_data": [{ "feature": "recency_deviation", "importance": 0.42, "direction": "increases_churn" }],
    "top_drivers": [{ "feature": "recency_deviation", "importance": 0.42, "direction": "increases_churn" }],
    "revenue_at_risk": { "total": 1200000 },
    "hypotheses": [{ "driver": "Recency", "hypothesis": "...", "action": "..." }],
    "metrics": { "roc_auc": 0.87, "cv_auc_mean": 0.85 },
    "cohort_data": [],
    "lifecycle_stages": {}
  },
  "users": [
    {
      "user_id": "U001",
      "segment": "At Risk",
      "lifecycle": "Declining",
      "churn_probability": 0.78,
      "predicted_ltv": 12400,
      "monetary": 8500,
      "frequency_score": 0.4
    }
  ]
}
```

---

## 📊 Data Format

Upload your own CSV/XLSX with these columns:

| Column | Description | Required |
|--------|-------------|----------|
| `user_id` | Unique user identifier | ✅ |
| `timestamp` | Event date/time (`YYYY-MM-DD`) | ✅ |
| `amount` | Monetary value (numeric) | ✅ |
| `description` | Product/event label | Optional |

Also supports **Online Retail II** format (auto-mapped: `Customer ID` → `user_id`, `InvoiceDate` → `timestamp`, `Price × Quantity` → `amount`).

---

## 🚀 Deployment

### Render.com (Production)
The project ships with a `render.yaml` for zero-config cloud deployment:

```bash
# Push to GitHub, connect repo on render.com
# Environment variables to set in Render dashboard:
GROQ_API_KEY=gsk_...
VITE_API_URL=https://your-backend.onrender.com
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GROQ_API_KEY` | Groq API key for AI hypotheses | *(falls back to rule-based)* |
| `VITE_API_URL` | Backend URL for frontend | `http://localhost:8000` |
| `PORT` | Backend port | `8000` |

---

## 📈 Business Value

| Problem | FinSight Solution | Quantified Impact |
|---------|-----------------|-------------------|
| **No segmentation** | Dynamic RFM + K-Means | Identify 5-6 distinct behavioral cohorts |
| **Blind campaigns** | Intervention Engine playbook | Segment-specific targeted actions |
| **Hidden churn** | Priority Score ranking | Top 50 users to save TODAY |
| **Unknown revenue loss** | Revenue-at-Risk per user | Exact $ exposure per segment |
| **Unexplainable AI** | SHAP-linked hypotheses | Auditable ML → action chain |
| **Executive blind spot** | Executive Dashboard | One-screen C-suite view |

---

## 🗂️ Project Structure

```
FinSight/
├── backend/
│   ├── main.py                 # FastAPI app, all endpoints
│   ├── schemas.py              # Pydantic v2 request/response models
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── datasets/               # Pre-loaded local datasets
│   ├── models/                 # Versioned .pkl model artifacts
│   ├── services/
│   │   ├── analytics.py        # RFM, churn model, SHAP, cohort, LTV
│   │   ├── llm_engine.py       # Groq + rule-based hypothesis engine
│   │   └── data_generator.py   # Fintech event stream generator
│   └── tests/
│       ├── test_analytics.py
│       ├── test_api.py
│       ├── test_whatif.py
│       ├── test_priority.py
│       └── test_llm.py
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Main dashboard orchestrator
│   │   ├── index.css           # Design system + component styles
│   │   └── components/
│   │       ├── ExecutiveDashboard.jsx   # CEO/judge one-screen view
│   │       ├── InterventionEngine.jsx   # Segment → action playbook
│   │       ├── WhatIfPanel.jsx          # Simulation + campaign engine
│   │       ├── ShapModal.jsx            # Per-user SHAP waterfall
│   │       └── LiveTicker.jsx           # Real-time event feed
│   ├── tests/
│   │   ├── WhatIfPanel.test.jsx
│   │   ├── ExecutiveDashboard.test.jsx
│   │   ├── InterventionEngine.test.jsx
│   │   └── App.test.jsx
│   ├── vite.config.js
│   └── package.json
├── render.yaml                 # Render.com deployment config
├── docker-compose.yml
└── README.md
```

---

## 🔒 Code Quality

- **Pydantic v2**: All API inputs/outputs strictly typed — no raw dicts in route handlers.
- **Error boundaries**: Graceful fallback on LLM timeout, model failure, or malformed data.
- **Memory safety**: Vectorized Pandas operations; chunked reading for large files; top-5 model artifact retention.
- **Type safety**: TypeScript-style prop validation on React components via PropTypes where applicable.
- **Zero secrets in code**: All keys via environment variables; `.env.example` ships with repo.

---

## 📜 License

MIT © 2026 Riyanshi Verma

---

<div align="center">

Built with ❤️ for Fintech Partners · **FinSight v3.0** · Predict · Explain · Intervene

</div>
