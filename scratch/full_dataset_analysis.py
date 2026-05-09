
import sys
import os
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
    
    return {
        "filename": os.path.basename(file_path),
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
    eng = AnalyticsEngine()
    rfm_results, silhouette = eng.calculate_rfm(combined_df)
    churn_results, drivers, metrics, shap_data = eng.predict_churn(combined_df, rfm_results)
    
    combined_results = {
        "filename": "Combined (2009-2011)",
        "total_users": len(churn_results),
        "revenue_at_risk": eng.get_revenue_at_risk(churn_results)['total'],
        "potential_recovery": eng.get_potential_recovery(churn_results, metrics),
        "metrics": metrics,
        "critical_users_count": len(churn_results[churn_results['churn_probability'] >= 0.8]),
        "risk_users_count": len(churn_results[(churn_results['churn_probability'] >= metrics.get('optimal_threshold', 0.5)) & (churn_results['churn_probability'] < 0.8)]),
        "segments": churn_results['segment'].value_counts().to_dict()
    }
    
    # Output to a file for the model to read
    import json
    with open("scratch/analysis_output.json", "w") as f:
        json.dump({"individual": results, "combined": combined_results}, f, indent=4)
    
    print("Analysis complete. Results saved to scratch/analysis_output.json")
