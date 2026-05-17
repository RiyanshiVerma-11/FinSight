import pytest
import pandas as pd
import numpy as np
from main import _prepare_bank_churn_df

def test_bank_churn_tenure_alignment():
    mock_data = {
        'Latest_Transaction_Date': pd.date_range(start='2026-01-01', periods=5, freq='D'),
        'Total_Transactions': [5, 10, 2, 8, 7],
        'Estimated_Salary': [50000, 60000, 45000, 80000, 90000],
        'Tenure': [2, 5, 0, 3, 4]
    }
    df = pd.DataFrame(mock_data)
    processed_df = _prepare_bank_churn_df(df)
    assert (processed_df['tenure'].values == np.array([2, 5, 0, 3, 4])).all()
