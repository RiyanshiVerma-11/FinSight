from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import threading
import os
import logging
from concurrent.futures import ThreadPoolExecutor

import state
from routers.v1 import datasets, upload, whatif, stream
from routers.v1.datasets import _prepare_bank_churn_df, _prepare_retail_df
from services.analytics import AnalyticsEngine

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
        "https://finsight-portal.render.com"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

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

app.include_router(datasets.router)
app.include_router(upload.router)
app.include_router(whatif.router)
app.include_router(stream.router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
