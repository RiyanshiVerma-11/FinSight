import pytest
from state import _engine_cache, LRUCache

def test_engine_cache_oom_prevention():
    assert isinstance(_engine_cache, LRUCache)
    
    # Use a separate LRUCache instance for testing mutations 
    # to avoid contaminating the shared global _engine_cache state.
    test_cache = LRUCache(capacity=5)
    
    # Fill cache to capacity limit (5)
    for i in range(5):
        test_cache[f"key_{i}"] = f"value_{i}"
        
    assert len(test_cache) == 5
    
    # Insert 6th item, causing key_0 (oldest) to be evicted
    test_cache["key_5"] = "value_5"
    
    assert len(test_cache) == 5
    assert "key_0" not in test_cache
    assert "key_5" in test_cache
