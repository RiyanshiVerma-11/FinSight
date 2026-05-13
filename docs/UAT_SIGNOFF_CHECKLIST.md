# UAT Signoff Checklist

Project: FinSight - User Segmentation and Churn Analyzer for Fintech Partners

## Required Screenshots (attach image paths in PR/comments)

- [ ] Executive View tab loaded with real dataset and ROC-AUC Confidence Badge
- [ ] Overview tab with Segments, Lifecycle, and Churn Drivers visible
- [ ] Survival Analysis tab with 6-month risk projections vs baseline
- [ ] Active Experiments tab with AI-driven hypotheses and testable interventions
- [ ] Explainability tab with SHAP Feature Impact and Behavioral Risk Interaction scatter points
- [ ] Simulation tab with What-If result cards and Intervention Engine table
- [ ] Users tab with Cohort Retention table and User-Level Analytics table
- [ ] Model Health section displays modernized Confusion Matrix (Correct Detection vs Missed Churners)

## Functional Acceptance

- [ ] Dataset selector loads `Year 2009-2010.csv`
- [ ] Dataset selector loads `Year 2010-2011.csv`
- [ ] Combined analysis handles overlap without duplicate inflation
- [ ] Behavioral Risk Interaction shows distributed points (not collapsed to 0,0)
- [ ] What-If works for recency/frequency/monetary and alias names
- [ ] Top-3 churn drivers are visible and mapped to testable hypotheses

## Model and Quality Gates

- [ ] Backend tests pass (`pytest -q`)
- [ ] Frontend tests pass (`npm test`)
- [ ] Quality gates pass (ROC-AUC and Accuracy thresholds in `backend/tests/test_quality_gates.py`)
- [ ] Full-dataset benchmark completed and stored in `scratch/analysis_output.json`

## Business Signoff

- [ ] Product Owner signoff
- [ ] Data Science lead signoff
- [ ] Engineering lead signoff
