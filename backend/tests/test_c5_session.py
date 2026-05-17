import pytest
import time
from concurrent.futures import ThreadPoolExecutor
import state

def test_session_isolation():
    def set_and_get_dataset_key(key, delay):
        state._active_dataset_key = key
        # Sleep to allow potential race-condition contamination
        time.sleep(delay)
        return state._active_dataset_key

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(set_and_get_dataset_key, "tenant_a.csv", 0.2)
        f2 = executor.submit(set_and_get_dataset_key, "tenant_b.csv", 0.05)
        
        res1 = f1.result()
        res2 = f2.result()
        
    # With contextvars isolation, each thread retains its own active dataset key
    assert res1 == "tenant_a.csv"
    assert res2 == "tenant_b.csv"
