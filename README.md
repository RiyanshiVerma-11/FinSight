# FinSight v3.0 — AI-Powered Churn Intelligence Engine for Fintech Partners

> **User Segmentation & Churn Analyzer** — An enterprise-grade analytics engine that segments fintech partners' end-users by behavior (Dynamic RFM, lifecycle stage, product mix) and predicts churn risk per segment with per-user explainability, counterfactual simulations, and AI-generated business strategies.

[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 🏆 What Makes FinSight a Winner

| Dimension | Standard Project (Top 10%) | **FinSight v3.0 (Top 1%)** |
|-----------|---------------------------|--------------------------|
| **Prediction** | Binary (Churn: Yes/No) | **Probability + Revenue at Risk ($)** |
| **Segments** | Simple K-Means | **Dynamic RFM + Behavioral Trajectories** |
| **Explainability** | Static Charts | **Per-User Local SHAP Drivers** |
| **Action** | None | **AI-Generated Business Hypotheses** |
| **Simulation** | None | **What-If Counterfactual Engine** |
| **Data Ingestion** | CSV Upload Only | **CSV + Real-Time WebSocket Stream** |
| **Validation** | None | **Pydantic v2 Strict Schemas** |
| **Model Management** | Single model | **Timestamped Model Versioning** |

---

## ✨ Key Features

### 1. Dynamic RFM Analytics (Advanced)
- **Inter-Purchase Interval (IPI)**: Calculates median days between purchases per user. Detects "silently churning" users who appear normal by recency but are overdue by their own behavioral pattern.
- **Recency Deviation**: `actual_recency - expected_recency_from_IPI` — flags users whose inactivity exceeds their personal norm.
- **Monetary Velocity**: `total_spent / account_age_days` — distinguishes "High Value" (spends a lot per day) from "High Volume" (many small transactions).
- Quantile-based RFM scoring (1–5) + K-Means clustering with Silhouette validation.

### 2. Per-User Local SHAP Explainability
- **Click any user row** → modal shows their individual SHAP waterfall explaining exactly WHY they have their churn score.
- Example: *"This user has 85% churn risk BECAUSE their Recency (45 days) is pushing churn risk UP by 0.187"*
- Color-coded impact bars (🔴 increases churn, 🟢 decreases churn).
- Revenue-at-risk displayed per user.

### 3. What-If Counterfactual Simulation Engine 🎯
- Interactive simulation panel: *"If I increase Frequency by 20% for 'At Risk' segment, what happens to churn?"*
- Segment selector, feature dropdown, percentage slider.
- Returns: original churn → simulated churn, churn reduction %, users affected, revenue protected ($).
- AI-generated recommendation for each simulation.

### 4. Real-Time Event Stream (WebSocket)
- Simulated fintech event stream: transactions, logins, failures, plan downgrades, support tickets.
- User risk profiles with weighted event generation.
- Live ticker with animated transitions and per-event churn impact indicators.
- Demonstrates system capability for live data ingestion.

### 5. AI-Powered Hypothesis Generator
- **LLM Integration**: Groq API (free tier, Llama 3 70B) for generating business strategies from ML insights.
- **Intelligent Fallback**: Rule-based hypothesis engine when API is unavailable.
- Outputs structured hypotheses with: title, hypothesis statement, actionable recommendation, expected quantified impact.
- One-click "✨ AI Generate" button in the dashboard.

### 6. Revenue-at-Risk Analytics
- Per-user: `monetary × churn_probability` = dollar amount at risk.
- Per-segment: aggregated revenue at risk with user counts.
- Dashboard stat card showing total portfolio risk.

### 7. Architecture & Code Quality
- **Pydantic v2 Schemas**: Strict request/response validation on all API endpoints.
- **Model Versioning**: Trained models saved as timestamped `.pkl` files in `/models`. Auto-cleanup keeps last 5 versions.
- **Parallel Warmup**: Multi-threaded dataset pre-processing on startup for instant dashboard loads.
- **WebSocket Support**: Real-time bidirectional communication.

---

## 🧪 Technical Architecture

```mermaid
graph TB
    %% Nodes styling
    classDef frontend fill:#eef2ff,stroke:#6366f1,stroke-width:2px,color:#1e293b
    classDef backend fill:#f8fafc,stroke:#475569,stroke-width:2px,color:#1e293b
    classDef engine fill:#f5f3ff,stroke:#8b5cf6,stroke-width:2px,color:#1e293b
    classDef api fill:#f0f9ff,stroke:#0ea5e9,stroke-width:2px,color:#1e293b

    subgraph UI ["Frontend (React 19)"]
        direction LR
        D[Dashboard Charts]
        S[SHAP Modal]
        W[What-If Panel]
        L[Live Ticker]
    end

    subgraph COM ["Communication Layer"]
        API_REQ[REST API + WebSocket]
    end

    subgraph B_API ["Backend API (FastAPI v3.0)"]
        direction LR
        AN[/analyze]
        US[/user-shap]
        WI[/whatif]
        ST[/stream]
        LH[/llm]
    end

    subgraph AE ["Analytics Engine"]
        direction TB
        RFM[Dynamic RFM]
        CM[Churn Model]
        SL[SHAP Local]
        WIF[What-If Simulation]
        RAR[Revenue at Risk]
    end

    subgraph BS ["Backend Services"]
        direction LR
        LLM[LLM Engine<br/>Groq/Llama]
        DG[Data Generator<br/>WebSocket]
        MV[Model Versioning<br/>.pkl timestamped]
    end

    %% Connections
    UI --> API_REQ
    API_REQ --> B_API
    B_API --> AE
    AE <--> BS

    %% Applying styles
    class D,S,W,L,UI frontend
    class B_API,AN,US,WI,ST,LH api
    class AE,RFM,CM,SL,WIF,RAR engine
    class BS,LLM,DG,MV,COM backend
```

### Analytics Pipeline
1. **Data Ingestion** → CSV/XLSX upload or real-time WebSocket events
2. **Dynamic RFM** → IPI, Recency Deviation, Monetary Velocity + Quantile Scoring
3. **Temporal Split** → Past window (features) vs. Future window (labels) to prevent data leakage
4. **Churn Prediction** → Random Forest + XGBoost with Stratified K-Fold Cross-Validation
5. **SHAP Explainability** → Global feature impact + Per-user local explanations
6. **Revenue-at-Risk** → `monetary × churn_probability` per user and segment
7. **What-If Simulation** → Counterfactual analysis with revenue impact projections
8. **Hypothesis Generation** → LLM-powered or rule-based business strategies

### ML Models & Metrics
- **Random Forest Classifier** (100 trees) — primary model
- **XGBoost Classifier** — comparison model
- **Evaluation**: ROC-AUC, F1, Precision, Recall, 5-Fold CV AUC
- **Clustering**: K-Means (k=4) with Silhouette Score validation
- **Explainability**: SHAP TreeExplainer (global + local)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI, Pandas, Scikit-learn, XGBoost, SHAP, Pydantic v2 |
| **Frontend** | React 19, Vite 8, Recharts, Framer Motion, Lucide Icons |
| **ML/AI** | Random Forest, XGBoost, SHAP TreeExplainer, Groq (Llama 3) |
| **Real-Time** | WebSocket (native), AsyncIO |
| **DevOps** | Docker, Docker Compose |

---

## 📦 Getting Started

### Prerequisites
- Docker Desktop installed and running

### Quick Start
```bash
# Clone the repository
git clone https://github.com/RiyanshiVerma-11/FinSight.git
cd FinSight

# Run with Docker Compose
docker-compose up --build

# Access:
# Frontend → http://localhost:3000
# Backend  → http://localhost:8000
# API Docs → http://localhost:8000/docs
```

### Optional: Enable AI Hypotheses
```bash
# Set Groq API key (free at console.groq.com)
export GROQ_API_KEY=your_key_here
```

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check + feature list |
| `GET` | `/demo-data` | Pre-generated demo analytics |
| `POST` | `/analyze` | Upload CSV/XLSX for analysis |
| `GET` | `/analyze-local?filename=...` | Analyze server-side dataset |
| `GET` | `/list-datasets` | List available local datasets |
| `GET` | `/user-shap/{user_id}` | Per-user SHAP explanation |
| `POST` | `/whatif` | What-If counterfactual simulation |
| `GET` | `/llm-hypotheses` | AI-generated business strategies |
| `GET` | `/models` | List versioned model artifacts |
| `WS` | `/stream` | Real-time event WebSocket |

---

## 📊 Sample Data Format
The application includes a demo data endpoint. Upload your own CSV/XLSX with:
| Column | Description | Required |
|--------|-------------|----------|
| `user_id` | Unique user identifier | ✅ |
| `timestamp` | Event date/time | ✅ |
| `amount` | Monetary value | ✅ |
| `description` | Product/event name | Optional |

Also supports **Online Retail II** format (Customer ID, InvoiceDate, Price, Quantity, Description) with automatic column mapping.

---

## 📈 Business Value
- **Predict & Prevent**: Identify at-risk users BEFORE they churn, with per-user explanations
- **Simulate Interventions**: Test business strategies via What-If analysis before spending budget
- **Revenue Protection**: Quantify exact dollar amounts at risk per segment
- **Data-Driven Strategy**: AI-generated hypotheses with specific, testable recommendations
- **Real-Time Readiness**: Architecture proven for live event processing

---

Built with ❤️ for Fintech Partners.
