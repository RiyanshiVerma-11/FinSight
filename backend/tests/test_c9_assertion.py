import pytest
from services.analytics import FinsightEngine
import pandas as pd

def test_predict_shape_assertion():
    engine = FinsightEngine()
    class BadModel:
        def predict_proba(self, X): return [[0.5, 0.5]]  # Hardcoded single output array
    engine.best_model = BadModel()
    df = pd.DataFrame({'recency': [1, 2], 'frequency': [1, 2], 'monetary': [10, 20], 'tenure': [1, 2], 'ipi_consistency': [1, 1]})
    with pytest.raises(AssertionError):
        engine.predict_churn(df)
