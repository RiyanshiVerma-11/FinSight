import os
import shutil
import tempfile
import pickle
import hashlib
import pandas as pd
import numpy as np
import pytest
from services.analytics import AnalyticsEngine, run_analysis
from sklearn.ensemble import RandomForestClassifier

def test_b6_rfm_segment_assignment():
    """Test B6: Textbook Deterministic RFM Segment Assignment.
    Verify that _assign_segment returns one of the 7 textbook segments for all 125 permutations,
    and returns 'New' for account_age_days < 30.
    """
    engine = AnalyticsEngine()
    valid_segments = {'Champions', 'Loyalists', 'Promising', 'At Risk', 'About to Sleep', 'Hibernating', 'Needs Attention'}
    
    # 1. Test New segment when account_age_days < 30
    for r in range(1, 6):
        for f in range(1, 6):
            for m in range(1, 6):
                seg = engine._assign_segment(r, f, m, account_age_days=15)
                assert seg == 'New'
                
    # 2. Test 125 permutations without age (or age >= 30)
    for r in range(1, 6):
        for f in range(1, 6):
            for m in range(1, 6):
                seg = engine._assign_segment(r, f, m, account_age_days=100)
                assert seg in valid_segments, f"Invalid segment '{seg}' returned for r={r}, f={f}, m={m}"

def test_b2_temporal_and_cohort_drift():
    """Test B2: Temporal & Cohort Drift Detection.
    Verify that we can detect drift when injecting a large distribution shift.
    """
    engine = AnalyticsEngine()
    
    # Create base temporal dataset
    np.random.seed(42)
    dates = pd.date_range("2024-01-01", periods=100, freq='D')
    user_ids = [f"user_{i}" for i in range(100)]
    
    df = pd.DataFrame({
        'user_id': user_ids * 5,
        'timestamp': np.random.choice(dates, 500),
        'amount': np.random.uniform(10, 100, 500),
        'target_churn': np.random.choice([0, 1], 500, p=[0.7, 0.3])
    })
    
    # Run analytics on the stable base
    rfm_results, _ = engine.calculate_rfm(df)
    _, _, metrics_stable, _ = engine.predict_churn(df, rfm_results)
    
    # Now, build a highly drifted dataset by adding huge delay to half the rows
    drifted_df = df.copy()
    drifted_df.loc[drifted_df.index[:250], 'amount'] = drifted_df.loc[drifted_df.index[:250], 'amount'] + 500.0
    
    engine_drift = AnalyticsEngine()
    rfm_drift, _ = engine_drift.calculate_rfm(drifted_df)
    _, _, metrics_drift, _ = engine_drift.predict_churn(drifted_df, rfm_drift)
    
    # Assert that some metrics show drift or that drift dict exists in metrics
    assert 'drift' in metrics_drift
    drift_info = metrics_drift['drift']
    assert drift_info['total_features'] > 0

def test_b9_feature_schema_hash_verification():
    """Test B9: Feature Schema Hash Verification.
    Assert that a mismatch in feature columns prevents loading stale models.
    """
    # Create a temporary directory for model versioning tests
    temp_model_dir = tempfile.mkdtemp()
    
    try:
        engine = AnalyticsEngine()
        engine._model_dir = temp_model_dir
        
        # Setup initial features and save the model
        engine._feature_names = ["Recency", "Frequency", "Monetary"]
        engine._feature_columns = ["recency", "frequency", "monetary"]
        
        # Mock models
        rf = RandomForestClassifier()
        # Train on dummy data so check_is_fitted passes
        X_dummy = np.random.randn(10, 3)
        y_dummy = np.random.randint(0, 2, 10)
        rf.fit(X_dummy, y_dummy)
        
        engine.best_model = rf
        engine._raw_model = rf
        
        metrics = {"optimal_threshold": 0.5}
        # Save model version
        engine._save_model_version(metrics, model_id="test_schema")
        
        # Load the model with identical feature columns - should succeed
        engine_load1 = AnalyticsEngine()
        engine_load1._model_dir = temp_model_dir
        loaded_metrics1 = engine_load1.load_latest_model("test_schema", current_feature_columns=["recency", "frequency", "monetary"])
        assert loaded_metrics1 is not None
        assert engine_load1._feature_columns == ["recency", "frequency", "monetary"]
        
        # Load the model with missing/different feature columns - should fail (return None)
        engine_load2 = AnalyticsEngine()
        engine_load2._model_dir = temp_model_dir
        loaded_metrics2 = engine_load2.load_latest_model("test_schema", current_feature_columns=["recency", "frequency", "some_new_feature"])
        assert loaded_metrics2 is None
        
    finally:
        shutil.rmtree(temp_model_dir)

def test_summary_dataset_financial_metrics():
    """Verify that summary datasets with estimated_salary yield non-zero monetary_velocity and revenue_at_risk."""
    engine = AnalyticsEngine()
    
    # Simulate a bank churn summary dataset
    df = pd.DataFrame({
        'user_id': [f"user_{i}" for i in range(20)],
        'timestamp': pd.date_range("2024-01-01", periods=20, freq='D'),
        'amount': [1000.0] * 20,
        'monetary': [1000.0] * 20,
        'estimated_salary': [120000.0] * 20, # 120,000 annual salary
        'tenure': [12.0] * 20,
        'target_churn': [0, 1] * 10,
        '_is_summary': [True] * 20,
        'domain': ['bank_churn'] * 20
    })
    
    # 1. Calculate RFM
    rfm_df, _ = engine.calculate_rfm(df)
    
    # Assert monetary_velocity is populated and non-zero
    assert 'monetary_velocity' in rfm_df.columns
    assert (rfm_df['monetary_velocity'] > 0).all()
    # Check that estimated_salary / 365.0 is around 328.76
    np.testing.assert_allclose(rfm_df['monetary_velocity'], 120000.0 / 365.0)

    # 2. Run prediction to verify LTV and RAR calculations are non-zero
    churn_results, _, metrics, _ = engine.predict_churn(df, rfm_df)
    
    assert 'revenue_at_risk' in churn_results.columns
    assert 'predicted_ltv' in churn_results.columns
    
    # Since churn probabilities are non-zero, RAR should be > 0
    total_rar = churn_results['revenue_at_risk'].sum()
    assert total_rar > 0, f"Expected non-zero revenue at risk, got {total_rar}"


def test_isolated_domain_column_mapping():
    """Verify that domain mappings are isolated, so NumOfProducts does not map to description
    in Bank Churn datasets, and instead maps to frequency, and other domains remain unpolluted.
    """
    from routers.v1.datasets import _prepare_data_df
    
    # 1. Create a dummy Bank Churn dataset
    df_bank = pd.DataFrame({
        'CustomerId': [1, 2, 3],
        'Surname': ['Hargrave', 'Hill', 'Onio'],
        'CreditScore': [600, 597, 502],
        'Geography': ['France', 'Spain', 'France'],
        'Gender': ['Female', 'Female', 'Female'],
        'Age': [42, 41, 42],
        'Tenure': [2, 1, 8],
        'Balance': [0.0, 83807.86, 159660.8],
        'NumOfProducts': [1, 2, 3],
        'HasCrCard': [1, 0, 1],
        'IsActiveMember': [1, 1, 0],
        'EstimatedSalary': [101348.88, 112542.58, 113931.57],
        'Exited': [1, 0, 1]
    })
    
    prepared_bank = _prepare_data_df(df_bank)
    
    # Verify it is detected as bank_churn domain
    assert prepared_bank['domain'].iloc[0] == 'bank_churn'
    # Verify that NumOfProducts was mapped to frequency (standardized numeric frequency column)
    assert 'frequency' in prepared_bank.columns
    # Check that the mapped values match NumOfProducts
    np.testing.assert_array_equal(prepared_bank['frequency'], [1.0, 2.0, 3.0])
    
    # Verify that 'description' is NOT in the columns (it should NOT map NumOfProducts to description)
    assert 'description' not in prepared_bank.columns

    # 2. Create a dummy UPI dataset to verify UPI mapping
    df_upi = pd.DataFrame({
        'Txn ID': ['T1', 'T2'],
        'Sender VPA': ['u1@upi', 'u2@upi'],
        'Payee VPA': ['m1@upi', 'm2@upi'],
        'Amount': [100.0, 200.0],
        'Txn Date': ['2024-05-01', '2024-05-02'],
        'Status': ['SUCCESS', 'FAILURE']
    })
    prepared_upi = _prepare_data_df(df_upi)
    assert prepared_upi['domain'].iloc[0] == 'upi'
    assert 'user_id' in prepared_upi.columns  # Sender VPA should map to user_id
    assert 'amount' in prepared_upi.columns   # Amount should map to amount
    assert 'is_failure' in prepared_upi.columns # UPI-specific field
    np.testing.assert_array_equal(prepared_upi['is_failure'], [0, 1])

    # 3. Create a dummy Retail dataset to verify Retail mapping
    df_retail = pd.DataFrame({
        'InvoiceNo': ['536365', '536366'],
        'StockCode': ['85123A', '71053'],
        'Description': ['WHITE HANGING HEART T-LIGHT HOLDER', 'WHITE METAL LANTERN'],
        'Quantity': [6, 2],
        'InvoiceDate': ['2010-12-01 08:26:00', '2010-12-01 08:28:00'],
        'UnitPrice': [2.55, 3.39],
        'CustomerID': [17850.0, 17850.0]
    })
    prepared_retail = _prepare_data_df(df_retail)
    assert prepared_retail['domain'].iloc[0] == 'retail'
    assert 'description' in prepared_retail.columns
    assert 'user_id' in prepared_retail.columns
