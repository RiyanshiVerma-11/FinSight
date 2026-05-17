import pytest
from concurrent.futures import ThreadPoolExecutor
from services.analytics import FinsightEngine
import pandas as pd
import numpy as np

def test_thread_safety_predict():
    engine = FinsightEngine()
    class DummyModel:
        def predict_proba(self, X): return np.array([[0.1, 0.9]] * len(X))
    engine.best_model = DummyModel()
    df = pd.DataFrame({'recency': [10], 'frequency': [5], 'monetary': [100.0], 'tenure': [12], 'ipi_consistency': [0.9]})
    
    def run_parallel():
        return engine.predict_churn(df)
        
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(run_parallel) for _ in range(10)]
        results = [f.result() for f in futures]
    assert len(results) == 10
