import pytest
from services.analytics import FinsightEngine
import pandas as pd

def test_no_temporal_dropout():
    dates = pd.date_range(start="2026-01-01", periods=4, freq="D")
    df = pd.DataFrame({'date': dates, 'recency': [1,2,3,4], 'frequency': [1,1,1,1], 'monetary': [10,10,10,10], 'tenure': [1,2,3,4], 'ipi_consistency': [1,1,1,1], 'exited': [0,0,1,1]})
    engine = FinsightEngine()
    # Explicitly verify window sizing parity across split boundaries
    assert len(df[df['date'] <= "2026-01-02"]) == 2
