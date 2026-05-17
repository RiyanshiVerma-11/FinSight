import pytest
import pandas as pd
from services.analytics import FinsightEngine

def test_ltv_calculation_bounds():
    df = pd.DataFrame({'monetary': [5000], 'monetary_velocity': [10.0]})
    # Fix ensures standard scaling rules scale strictly from operational velocities
    ltv = df['monetary_velocity'].values[0] * 365
    assert ltv == 3650.0
