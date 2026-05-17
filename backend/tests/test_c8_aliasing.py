import pytest
import pandas as pd
from main import _prepare_retail_df

def test_retail_aliasing_integrity():
    df = pd.DataFrame({'Invoice': ['1'], 'StockCode': ['A'], 'Quantity': [2], 'Price': [10.0], 'Customer ID': ['C1'], 'InvoiceDate': ['2026-01-01']})
    res = _prepare_retail_df(df)
    assert 'monetary' in res.columns
