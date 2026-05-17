import pandas as pd
import numpy as np
import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'backend'))
from services.analytics import AnalyticsEngine
from routers.v1.datasets import _prepare_data_df

def analyze_tax():
    csv_path = "backend/datasets/tax_form26as_style.csv"
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} does not exist.")
        return

    df = pd.read_csv(csv_path)
    df_prep = _prepare_data_df(df)

    eng = AnalyticsEngine()
    rfm_results, _ = eng.calculate_rfm(df_prep)
    
    X_train_full, y_train_full, feature_names = eng._prepare_training_data(df_prep)
    
    print(f"\n--- True Labels ---")
    print(f"Total users: {len(y_train_full)}")
    print(f"Churn rate: {y_train_full.mean():.4f}")
    
    merged = X_train_full.copy()
    merged['target_churn'] = y_train_full.values
    
    churned = merged[merged['target_churn'] == 1]
    retained = merged[merged['target_churn'] == 0]
    
    print("\n--- Empirical Data Averages (Churned vs Retained) ---")
    for col in ['frequency', 'monetary', 'recency', 'quantity', 'amount']:
        if col in merged.columns:
            c_mean = churned[col].mean()
            r_mean = retained[col].mean()
            print(f"{col.upper()}: Churned Avg = {c_mean:.2f} | Retained Avg = {r_mean:.2f}")
            
if __name__ == "__main__":
    analyze_tax()
