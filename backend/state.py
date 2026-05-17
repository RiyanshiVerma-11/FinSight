import sys
import threading
import os
import contextvars
from collections import OrderedDict
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

_results_cache: dict = {}
_demo_cache = None
_engine_cache = LRUCache(capacity=5)
_processing_status: dict = {}
_cache_lock = threading.Lock()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "datasets")

IS_CLOUD = os.environ.get('RENDER') is not None or os.environ.get('IS_CLOUD') == '1'
MAX_ROWS = 250000 if IS_CLOUD else 1_000_000 
MIN_USERS_TO_KEEP = 100

_active_dataset_key_var = contextvars.ContextVar('active_dataset_key', default=None)

class StateModule(ModuleType):
    def __getattr__(self, name):
        if name == '_active_dataset_key':
            return _active_dataset_key_var.get()
        return super().__getattribute__(name)

    def __setattr__(self, name, value):
        if name == '_active_dataset_key':
            _active_dataset_key_var.set(value)
        else:
            super().__setattr__(name, value)

sys.modules[__name__].__class__ = StateModule
