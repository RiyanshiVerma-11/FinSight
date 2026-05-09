
import sys
import os
import time
import json
import pandas as pd
import numpy as np
import logging
from datetime import datetime

# Add backend to path to import services
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from services.analytics import AnalyticsEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _prepare_retail_df(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise various retail formats into the standard internal schema."""
    column_variants = {
        'user_id': ['Customer ID', 'CustomerID', 'Customer_ID', 'User ID', 'user', 'id', 'user_id'],
        'timestamp': ['InvoiceDate', 'Date', 'timestamp', 'time', 'Order Date', 'date', 'Invoice Date'],
        'amount': ['Price', 'Total', 'Amount', 'revenue', 'sum', 'amount', 'Total Price', 'TotalPrice'],
        'unit_price': ['Price', 'UnitPrice', 'Unit Price', 'price', 'unit_price'],
        'quantity': ['Quantity', 'Qty', 'quantity', 'Quantity']
    }
    
    current_cols = {c.lower().replace(' ', '').replace('_', ''): c for c in df.columns}
    found_mapping = {}
    
    for target, variants in column_variants.items():
        for v in variants:
            v_norm = v.lower().replace(' ', '').replace('_', '')
            if v_norm in current_cols:
                found_mapping[current_cols[v_norm]] = target
                break
    
    if found_mapping:
        df = df.rename(columns=found_mapping)

    if 'user_id' in df.columns:
        df['user_id'] = pd.to_numeric(df['user_id'], errors='coerce').fillna(0).astype(int).astype(str)
        df = df[df['user_id'] != '0']

    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df = df.dropna(subset=['timestamp'])

    if 'amount' not in df.columns and 'unit_price' in df.columns and 'quantity' in df.columns:
        df['unit_price'] = pd.to_numeric(df['unit_price'], errors='coerce').fillna(0)
        df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
        df['amount'] = df['unit_price'] * df['quantity']
    elif 'amount' in df.columns:
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0)

    required = ['user_id', 'timestamp', 'amount']
    df = df.dropna(subset=[c for c in required if c in df.columns])
    return df

def analyze_dataset(file_path):
    logger.info(f"Analyzing {file_path}...")
    t0 = time.perf_counter()
    df = pd.read_csv(file_path, encoding='ISO-8859-1')
    df = _prepare_retail_df(df)
    
    eng = AnalyticsEngine()
    rfm_results, silhouette = eng.calculate_rfm(df)
    churn_results, drivers, metrics, shap_data = eng.predict_churn(df, rfm_results)
    
    # Get high level metrics
    rev_at_risk = eng.get_revenue_at_risk(churn_results)
    recovery = eng.get_potential_recovery(churn_results, metrics)
    
    # Identify users
    optimal_threshold = metrics.get('optimal_threshold', 0.5)
    critical_users = churn_results[churn_results['churn_probability'] >= 0.8].sort_values('revenue_at_risk', ascending=False)
    risk_users = churn_results[(churn_results['churn_probability'] >= optimal_threshold) & (churn_results['churn_probability'] < 0.8)].sort_values('revenue_at_risk', ascending=False)
    
    elapsed = round(time.perf_counter() - t0, 2)
    return {
        "filename": os.path.basename(file_path),
        "elapsed_seconds": elapsed,
        "total_users": len(churn_results),
        "revenue_at_risk": rev_at_risk['total'],
        "potential_recovery": recovery,
        "metrics": metrics,
        "critical_users_count": len(critical_users),
        "risk_users_count": len(risk_users),
        "top_critical_users": critical_users.head(5)[['user_id', 'churn_probability', 'revenue_at_risk']].to_dict(orient='records'),
        "top_risk_users": risk_users.head(5)[['user_id', 'churn_probability', 'revenue_at_risk']].to_dict(orient='records'),
        "segments": churn_results['segment'].value_counts().to_dict()
    }

if __name__ == "__main__":
    dataset_dir = "backend/datasets"
    files = ["Year 2009-2010.csv", "Year 2010-2011.csv"]
    
    results = []
    bench_started = time.perf_counter()
    for f in files:
        path = os.path.join(dataset_dir, f)
        if os.path.exists(path):
            results.append(analyze_dataset(path))
    
    # Combined analysis
    logger.info("Performing combined analysis...")
    all_dfs = []
    for f in files:
        path = os.path.join(dataset_dir, f)
        if os.path.exists(path):
            df = pd.read_csv(path, encoding='ISO-8859-1')
            all_dfs.append(_prepare_retail_df(df))
    
    combined_df = pd.concat(all_dfs, ignore_index=True)
    combined_df = combined_df.drop_duplicates(subset=[c for c in ['user_id', 'timestamp', 'amount'] if c in combined_df.columns])
    combined_started = time.perf_counter()
    eng = AnalyticsEngine()
    rfm_results, silhouette = eng.calculate_rfm(combined_df)
    churn_results, drivers, metrics, shap_data = eng.predict_churn(combined_df, rfm_results)
    
    combined_results = {
        "filename": "Combined (2009-2011)",
        "elapsed_seconds": round(time.perf_counter() - combined_started, 2),
        "total_users": len(churn_results),
        "revenue_at_risk": eng.get_revenue_at_risk(churn_results)['total'],
        "potential_recovery": eng.get_potential_recovery(churn_results, metrics),
        "metrics": metrics,
        "critical_users_count": len(churn_results[churn_results['churn_probability'] >= 0.8]),
        "risk_users_count": len(churn_results[(churn_results['churn_probability'] >= metrics.get('optimal_threshold', 0.5)) & (churn_results['churn_probability'] < 0.8)]),
        "segments": churn_results['segment'].value_counts().to_dict()
    }
    
    quality_gates = {
        "roc_auc_min": 0.65,
        "accuracy_min": 0.60,
    }

    def pass_fail(m):
        return {
            "roc_auc_pass": (m.get("roc_auc", 0) >= quality_gates["roc_auc_min"]),
            "accuracy_pass": (m.get("accuracy", 0) >= quality_gates["accuracy_min"]),
        }

    payload = {
        "generated_at": datetime.now().isoformat(),
        "elapsed_total_seconds": round(time.perf_counter() - bench_started, 2),
        "quality_gates": quality_gates,
        "individual": [{**r, "gate_result": pass_fail(r.get("metrics", {}))} for r in results],
        "combined": {**combined_results, "gate_result": pass_fail(combined_results.get("metrics", {}))}
    }

    with open("scratch/analysis_output.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    summary_lines = [
        "# Full Dataset Benchmark",
        "",
        f"- Generated: {payload['generated_at']}",
        f"- Total runtime: {payload['elapsed_total_seconds']}s",
        f"- Quality gates: ROC-AUC >= {quality_gates['roc_auc_min']}, Accuracy >= {quality_gates['accuracy_min']}",
        "",
        "## Per Dataset",
    ]
    for row in payload["individual"]:
        summary_lines.append(
            f"- {row['filename']}: users={row['total_users']}, auc={row['metrics'].get('roc_auc', 0):.4f}, "
            f"acc={row['metrics'].get('accuracy', 0):.4f}, elapsed={row['elapsed_seconds']}s, "
            f"gate={row['gate_result']}"
        )

    c = payload["combined"]
    summary_lines.extend([
        "",
        "## Combined",
        f"- users={c['total_users']}, auc={c['metrics'].get('roc_auc', 0):.4f}, acc={c['metrics'].get('accuracy', 0):.4f}, "
        f"elapsed={c['elapsed_seconds']}s, gate={c['gate_result']}",
        ""
    ])

    with open("scratch/full_dataset_benchmark.md", "w", encoding="utf-8") as f:
        f.write("\n".join(summary_lines))

    print("Benchmark complete. Outputs:")
    print("- scratch/analysis_output.json")
    print("- scratch/full_dataset_benchmark.md")
