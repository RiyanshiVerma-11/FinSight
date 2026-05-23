from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from contextlib import asynccontextmanager
import threading
import os
import logging
from concurrent.futures import ThreadPoolExecutor

import state
from routers.v1 import datasets, upload, whatif, stream
from routers.v1.datasets import _prepare_bank_churn_df, _prepare_retail_df
from services.analytics import AnalyticsEngine
from core.auth import (
    AUTH_ENABLED, get_current_user,
    RegisterRequest, TokenResponse,
    register_user, login_user,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _warmup_dataset(fname):
    with state._cache_lock:
        if fname in state._results_cache or state._processing_status.get(fname) == "processing":
            return
        state._processing_status[fname] = "processing"

    fpath = os.path.join(state.DATASET_DIR, fname)
    logger.info(f"⏳ Background processing '{fname}'...")
    try:
        import time
        t0 = time.time()
        df = datasets._read_file(fpath)
        df = datasets._prepare_data_df(df)
        
        required = ['user_id', 'timestamp', 'amount']
        if not all(c in df.columns for c in required):
            logger.warning(f"⚠️  Skipping '{fname}' - missing columns")
            with state._cache_lock:
                state._processing_status[fname] = "failed"
            return

        result = datasets._process_dataframe(df, cache_key=fname)
        with state._cache_lock:
            state._results_cache[fname] = result
            state._processing_status[fname] = "ready"
        logger.info(f"✅ '{fname}' is now READY in {time.time() - t0:.1f}s")
    except Exception as e:
        logger.error(f"❌ Failed to process '{fname}': {e}")
        with state._cache_lock:
            state._processing_status[fname] = "failed"


def _warmup_caches():
    logger.info("⏳ Starting Warmup Engine (Parallel)...")
    
    if not os.path.exists(state.DATASET_DIR):
        os.makedirs(state.DATASET_DIR, exist_ok=True)
        return

    files = [f for f in os.listdir(state.DATASET_DIR) if f.endswith(('.csv', '.xlsx'))]
    files.sort(key=lambda x: 0 if any(d in x.lower() for d in ['upi', 'tax', 'churn']) else 1)
    
    max_workers = 2 if not state.IS_CLOUD else 1
    logger.info(f"⏳ Processing {len(files)} datasets with {max_workers} workers...")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        executor.map(_warmup_dataset, files)

    logger.info("✅ All local datasets are now cached and ready for access.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    thread = threading.Thread(target=_warmup_caches, daemon=True)
    thread.start()
    yield

app = FastAPI(title="FinSight API", version="3.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://finsight-frontend-r0a8.onrender.com",
        "http://localhost:5173",
        "https://finsight-portal.onrender.com"
    ],
    allow_origin_regex=r"https://.*\.onrender\.com$|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Authentication Endpoints (always available) ──

@app.post("/auth/register", response_model=TokenResponse, tags=["auth"])
async def auth_register(req: RegisterRequest):
    """Register a new user account and receive a JWT access token."""
    return register_user(req)


@app.post("/auth/login", response_model=TokenResponse, tags=["auth"])
async def auth_login(form: OAuth2PasswordRequestForm = Depends()):
    """Authenticate with username/password and receive a JWT access token."""
    return login_user(form)


@app.get("/auth/me", tags=["auth"])
async def auth_me(user_id: str = Depends(get_current_user)):
    """Return the currently authenticated user (or null if auth is disabled)."""
    return {"user_id": user_id, "auth_enabled": AUTH_ENABLED}


# ── Public Endpoints ──

@app.get("/")
async def root():
    return {"message": "FinSight Analytics Engine v3 is running", "features": [
        "Dynamic RFM (IPI + Monetary Velocity)",
        "Per-User SHAP Explainability",
        "What-If Counterfactual Simulation",
        "Real-Time Event Stream (WebSocket)",
        "LLM-Powered Business Hypotheses",
        "Model Versioning",
        "Revenue-at-Risk Analytics"
    ]}

@app.get("/models")
async def list_models():
    """List all versioned model artifacts."""
    eng = AnalyticsEngine()
    return {"models": eng.list_model_versions()}


# ── Protected Routers ──
# When FINSIGHT_AUTH_ENABLED=1, inject get_current_user as a dependency on all
# data-sensitive routers. When disabled (default), routes remain fully open.

_router_deps = [Depends(get_current_user)] if AUTH_ENABLED else []

app.include_router(datasets.router, dependencies=_router_deps)
app.include_router(upload.router, dependencies=_router_deps)
app.include_router(whatif.router, dependencies=_router_deps)
app.include_router(stream.router, dependencies=_router_deps)

if AUTH_ENABLED:
    logger.info("🔒 Authentication is ENABLED — all data routes require a valid JWT.")
else:
    logger.info("🔓 Authentication is DISABLED (dev mode) — all routes are open.")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

