import sys
import threading
import os
from collections import OrderedDict
from contextvars import ContextVar
from types import ModuleType

class LRUCache(dict):
    def __init__(self, capacity: int = 5):
        super().__init__()
        self.capacity = capacity
    def get(self, key, default=None):
        if key not in self: return default
        return self[key]
    def __getitem__(self, key):
        val = super().__getitem__(key)
        self.pop(key)
        super().__setitem__(key, val)
        return val
    def __setitem__(self, key, value):
        if key in self: self.pop(key)
        super().__setitem__(key, value)
        if len(self) > self.capacity:
            first_key = next(iter(self))
            self.pop(first_key)

_results_cache = LRUCache(capacity=20)
_demo_cache = None
_engine_cache = LRUCache(capacity=5)
_processing_status: dict = {}
_cache_lock = threading.RLock()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "datasets")

IS_CLOUD = os.environ.get('RENDER') is not None or os.environ.get('IS_CLOUD') == '1'
MAX_ROWS = 250000 if IS_CLOUD else 1_000_000 
MIN_USERS_TO_KEEP = 100

_active_key_var: ContextVar[str | None] = ContextVar("active_key", default=None)

def get_active_key() -> str:
    return _active_key_var.get()

def set_active_key(key: str) -> None:
    _active_key_var.set(key)

class StateModule(ModuleType):
    def __getattr__(self, name):
        if name == '_active_dataset_key':
            return get_active_key()
        return super().__getattribute__(name)

    def __setattr__(self, name, value):
        if name == '_active_dataset_key':
            set_active_key(value)
        else:
            super().__setattr__(name, value)

sys.modules[__name__].__class__ = StateModule
