# FinSight v3.0 — Frontend Intelligence Dashboard

This is the high-performance React application that powers the **FinSight** analytics experience. Built with React 19 and Vite 8, it provides a real-time, tabbed interface for churn prediction, ROI simulation, and executive reporting.

## 🚀 Core Frontend Features

### 1. Retention ROI Simulation
Interactive "What-If" engine that calculates the financial viability of retention strategies. 
- Uses a local ROI calculator to compare **Intervention Cost** vs **Predicted LTV**.
- Dynamic visual feedback for profitable/non-profitable segments.

### 2. Executive View & Reporting
A board-ready dashboard designed for the C-Suite.
- **Predictive Trends**: 6-month churn vs. recovery forecast using Recharts.
- **Revenue Leakage**: Product-mix risk analysis.
- **One-Click PDF**: Full-dashboard export using `html2canvas` and `jsPDF`.

### 3. Explainable AI (SHAP)
Deep integration with the backend SHAP engine.
- Interactive waterfall charts for local user-level explainability.
- Global feature dependence plots for macro trend analysis.

### 4. Interactive Onboarding
A professional walkthrough powered by `react-joyride` that guides new users through the complex analytical sections of the platform.

## 🛠 Tech Stack

- **Framework**: React 19 (Hooks, Context, Tabbed State)
- **Bundler**: Vite 8 (HMR, Oxc Transform)
- **Charts**: Recharts (Area, Bar, Pie, Scatter)
- **Animations**: Framer Motion (Smooth layout transitions)
- **Icons**: Lucide React
- **Tour**: React Joyride
- **PDF Export**: html2canvas + jsPDF

## 📦 Getting Started

### Local Setup
1. `npm install`
2. `npm run dev`

### Production Build
1. `npm run build`
2. Result will be in the `dist/` directory.

## 🧪 Testing
Run component tests using Vitest and React Testing Library:
`npm test`
