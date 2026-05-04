# FinSight: Insight-driven dashboard with actionable churn intelligence

FinSight is a high-performance analytics engine designed for Fintech partners. It ingests raw user-event data and uses Machine Learning to perform deep behavioral segmentation (RFM & Lifecycle), predict segment-level churn risk with proper train/test validation, and generate data-driven, actionable retention hypotheses backed by SHAP explainability.

## 🏆 Rank-1 Hackathon Upgrades (New Features)

- **Zero Data Leakage ML Pipeline**: Proper 80/20 Stratified Train/Test Split with 5-fold Cross-Validation ensures robust, generalizable churn predictions. Displays F1, Precision, and Recall metrics.
- **Advanced Explainability (SHAP)**: Replaced basic feature importance with SHAP (SHapley Additive exPlanations) values. The UI visualizes feature impact with color-coded bars (Red = increases churn, Green = decreases churn).
- **Cohort Retention Heatmap**: Interactive Monthly Cohort Heatmap (M0-M11) visualizing exact user drop-off cliffs.
- **Product Mix Analysis**: Uncovers top product preferences per user segment.
- **Data-Driven "Testable" Hypotheses**: Replaces generic hypotheses with live, data-backed insights (e.g., specific recency gaps) paired with actionable A/B test recommendations.
- **Segment-Level Churn**: Dedicated breakdowns to identify immediate intervention targets (e.g., "Loyal" vs "At Risk").
- **Performance & Polish**: Instant analytics via pre-computed startup caching and a one-click CSV export for offline reporting.

## 🧪 Technical Specification

### Analytics Engine
- **RFM Scoring & Clustering**: Quantile-based (1–5 scale) combined with K-Means clustering for behavioral segmentation.
- **Robust Churn Prediction**: 
  - **Random Forest Classifier** trained on normalized features.
  - Built-in **Stratified K-Fold Cross-Validation**.
- **Advanced Explainability**: SHAP (TreeExplainer) integration directly tied to UI visuals.
- **Dynamic Cohort Matrix**: Automated user cohorting and M0-M11 retention calculations.

### Data & Evaluation
- **Data Assumptions**: Handles anonymized transaction logs (user_id, timestamp, amount, description).
- **Evaluation Metrics**: 
  - **Classification Metrics**: ROC-AUC, F1-Score, Precision, Recall.
  - **Clustering Validation**: Silhouette Score.

## 📈 Business Value
- **Improve Retention**: Identify at-risk users before they leave.
- **Targeted Engagement**: Deploy marketing spend only on high-value, high-risk segments.
- **Product Strategy**: Understand which behaviors (Frequency vs. Monetary) drive long-term loyalty.

## 🛠️ Tech Stack

- **Backend**: FastAPI, Pandas, Scikit-learn
- **Frontend**: Vite, React, Recharts, Framer Motion, Lucide Icons
- **DevOps**: Docker, Docker Compose

## 📦 Getting Started

### Prerequisites
- Docker Desktop installed and running.

### Installation

1. **Clone the repository**.
2. **Run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```
3. **Access the application**:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:8000](http://localhost:8000)

## 📊 Sample Data
The application includes a `demo-data` endpoint. You can also upload your own CSV with:
- `user_id`: Unique identifier.
- `timestamp`: Date of event.
- `amount`: Monetary value.

---
Built with ❤️ for Fintech Partners.
