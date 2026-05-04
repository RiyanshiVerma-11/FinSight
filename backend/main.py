from fastapi import FastAPI, UploadFile, File, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pandas as pd
import io
import os
import time
import logging
import json
import asyncio
from services.analytics import AnalyticsEngine
from services.data_generator import generate_event
from services.llm_engine import generate_llm_hypotheses
from schemas import WhatIfRequest
import numpy as np
import threading
from concurrent.futures import ThreadPoolExecutor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Caches ──
_results_cache: dict = {}
_demo_cache: dict | None = None
_engine_cache: dict = {}  # store AnalyticsEngine instances per dataset

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "datasets")


# ──────────────────────────────────────
#  Helpers
# ──────────────────────────────────────
def _read_file(path: str) -> pd.DataFrame:
    if path.endswith('.csv'):
        return pd.read_csv(path, encoding='ISO-8859-1')
    elif path.endswith('.xlsx'):
        return pd.read_excel(path)
    raise ValueError(f"Unsupported: {path}")


def _prepare_retail_df(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise various retail formats into the standard internal schema."""
    # 1. Flexible Column Mapping
    column_variants = {
        'user_id': ['Customer ID', 'CustomerID', 'Customer_ID', 'User ID', 'user', 'id', 'user_id'],
        'timestamp': ['InvoiceDate', 'Date', 'timestamp', 'time', 'Order Date', 'date', 'Invoice Date'],
        'amount': ['Price', 'Total', 'Amount', 'revenue', 'sum', 'amount', 'Total Price', 'TotalPrice'],
        'unit_price': ['Price', 'UnitPrice', 'Unit Price', 'price', 'unit_price'],
        'quantity': ['Quantity', 'Qty', 'quantity', 'Quantity']
    }
    
    # Apply mapping
    current_cols = {c.lower().replace(' ', '').replace('_', ''): c for c in df.columns}
    found_mapping = {}
    
    for target, variants in column_variants.items():
        for v in variants:
            v_norm = v.lower().replace(' ', '').replace('_', '')
            if v_norm in current_cols:
                found_mapping[current_cols[v_norm]] = target
                break
    
    if found_mapping:
        df = df.rename(columns=found_mapping)

    # 1.5 Column Mapping for Bank Churn / Summary datasets
    summary_mapping = {
        'credit_score': 'credit_score',
        'balance': 'monetary',
        'products_number': 'frequency',
        'tenure': 'tenure_months',
        'estimated_salary': 'monetary_velocity',
        'active_member': 'is_active',
        'churn': 'target_churn'
    }
    
    for v, target in summary_mapping.items():
        v_norm = v.lower().replace(' ', '').replace('_', '')
        if v_norm in current_cols:
            df = df.rename(columns={current_cols[v_norm]: target})
            # Also map to standard columns if missing
            if target == 'monetary' and 'amount' not in df.columns:
                df['amount'] = df[target]

    # Handle missing timestamps for summary data (create dummy based on tenure)
    if 'timestamp' not in df.columns and 'tenure_months' in df.columns:
        # Create dummy timestamps so RFM pipeline doesn't crash
        now = pd.Timestamp.now()
        df['timestamp'] = now - pd.to_timedelta(df['tenure_months'].fillna(0) * 30, unit='D')
        if 'amount' not in df.columns:
            df['amount'] = df.get('monetary', 0)

    # 2. Description column for Product Mix
    desc_cols = ['Description', 'description', 'Product', 'product', 'ProductDescription']
    for c in desc_cols:
        if c in df.columns and c != 'description':
            df = df.rename(columns={c: 'description'})
            break

    # 3. Handle required columns
    if 'user_id' in df.columns:
        # Convert user_id to string and remove nulls
        df['user_id'] = pd.to_numeric(df['user_id'], errors='coerce').fillna(0).astype(int).astype(str)
        df = df[df['user_id'] != '0']

    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df = df.dropna(subset=['timestamp'])

    # 4. Calculate amount if missing but price/qty exist
    if 'amount' not in df.columns and 'unit_price' in df.columns and 'quantity' in df.columns:
        df['unit_price'] = pd.to_numeric(df['unit_price'], errors='coerce').fillna(0)
        df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
        df['amount'] = df['unit_price'] * df['quantity']
    elif 'amount' in df.columns:
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0)

    # 5. Final Cleanup
    required = ['user_id', 'timestamp', 'amount']
    df = df.dropna(subset=[c for c in required if c in df.columns])
    
    return df


def _process_dataframe(df: pd.DataFrame, cache_key: str = "_default") -> dict:
    """Full pipeline: RFM → Churn → Lifecycle → Product Mix → Cohort → Revenue → JSON."""
    eng = AnalyticsEngine()

    # 1. Dynamic RFM (with IPI + Monetary Velocity)
    rfm_results, silhouette = eng.calculate_rfm(df)

    # 2. Churn (with proper train/test + SHAP + model versioning)
    churn_results, drivers, metrics, shap_data = eng.predict_churn(df, rfm_results)

    # 3. Lifecycle
    lifecycle = eng.get_lifecycle_stages(df)

    # 4. Segment-level churn (now includes revenue-at-risk)
    segment_churn = eng.get_segment_churn(churn_results)

    # 5. Product mix
    product_mix = eng.analyze_product_mix(df, churn_results)

    # 6. Cohort retention
    try:
        cohort_data = eng.build_cohort_matrix(df)
    except Exception as e:
        logger.error(f"Cohort analysis error: {e}")
        cohort_data = []

    # 7. Revenue-at-Risk
    revenue_at_risk = eng.get_revenue_at_risk(churn_results)

    # Merge
    final_df = churn_results.merge(lifecycle, on='user_id')

    # 8. LLM / Rule-based hypotheses
    hypotheses = eng.generate_hypotheses(drivers, final_df)

    summary = {
        "total_users": int(final_df['user_id'].nunique()),
        "avg_churn_risk": float(final_df['churn_probability'].mean()),
        "segments": final_df['segment'].value_counts().to_dict(),
        "lifecycle_stages": final_df['lifecycle'].value_counts().to_dict(),
        "top_drivers": [{"feature": d[0], "importance": float(d[1])} for d in drivers],
        "hypotheses": hypotheses,
        "metrics": {
            "silhouette_score": float(silhouette),
            **metrics,
        },
        "shap_data": shap_data,
        "segment_churn": segment_churn,
        "product_mix": product_mix,
        "cohort_data": cohort_data,
        "revenue_at_risk": revenue_at_risk,
    }

    user_data = final_df.head(100).to_dict(orient='records')

    # Cache engine for per-user SHAP & what-if
    _engine_cache[cache_key] = {'engine': eng, 'rfm_df': churn_results}

    return {"summary": summary, "users": user_data}




# ──────────────────────────────────────
#  Warmup
# ──────────────────────────────────────
def _warmup_dataset(fname):
    """Worker function for parallel warmup."""
    fpath = os.path.join(DATASET_DIR, fname)
    logger.info(f"⏳ Background processing '{fname}'...")
    try:
        t0 = time.time()
        df = _read_file(fpath)
        df = _prepare_retail_df(df)
        required = ['user_id', 'timestamp', 'amount']
        if not all(c in df.columns for c in required):
            logger.warning(f"⚠️  Skipping '{fname}' - missing columns")
            return
        _results_cache[fname] = _process_dataframe(df, cache_key=fname)
        logger.info(f"✅ '{fname}' is now READY in {time.time() - t0:.1f}s")
    except Exception as e:
        logger.error(f"❌ Failed to process '{fname}': {e}")


def _warmup_caches():
    logger.info("⏳ Starting Warmup Engine (Sequential)...")
    
    if not os.path.exists(DATASET_DIR):
        os.makedirs(DATASET_DIR, exist_ok=True)
        return

    files = [f for f in os.listdir(DATASET_DIR) if f.endswith(('.csv', '.xlsx'))]
    
    # 2. Process all datasets SEQUENTIALLY to save RAM on free tier
    logger.info(f"⏳ Processing {len(files)} datasets sequentially...")
    for fname in files:
        _warmup_dataset(fname)

    # 3. Skip combined dataset on free tier (too much RAM)
    logger.info("✅ All local datasets are now cached and ready for access.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start warmup in the background so API is responsive immediately
    thread = threading.Thread(target=_warmup_caches, daemon=True)
    thread.start()
    yield


# ──────────────────────────────────────
#  App
# ──────────────────────────────────────
app = FastAPI(title="FinSight API", version="3.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/list-datasets")
async def list_datasets():
    if not os.path.exists(DATASET_DIR):
        os.makedirs(DATASET_DIR, exist_ok=True)
        return {"datasets": []}
    files = [f for f in os.listdir(DATASET_DIR) if f.endswith(('.csv', '.xlsx'))]
    return {"datasets": files}


@app.get("/analyze-local")
async def analyze_local(filename: str = Query(...)):
    if filename in _results_cache:
        logger.info(f"⚡ Serving '{filename}' from cache")
        return _results_cache[filename]

    if filename == "all":
        return await _analyze_all_live()

    file_path = os.path.join(DATASET_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Not found: {filename}")

    df = _read_file(file_path)
    df = _prepare_retail_df(df)
    required = ['user_id', 'timestamp', 'amount']
    if not all(c in df.columns for c in required):
        raise HTTPException(status_code=400, detail=f"Missing columns. Found: {list(df.columns)}")

    result = _process_dataframe(df, cache_key=filename)
    _results_cache[filename] = result
    return result


async def _analyze_all_live():
    if not os.path.exists(DATASET_DIR):
        raise HTTPException(status_code=404, detail="Datasets directory not found")
    files = [f for f in os.listdir(DATASET_DIR) if f.endswith(('.csv', '.xlsx'))]
    if not files:
        raise HTTPException(status_code=404, detail="No datasets found")
    all_dfs = []
    for f in files:
        df = _read_file(os.path.join(DATASET_DIR, f))
        df = _prepare_retail_df(df)
        all_dfs.append(df)
    combined = pd.concat(all_dfs, ignore_index=True)
    result = _process_dataframe(combined, cache_key="all")
    _results_cache["all"] = result
    return result


@app.get("/demo-data")
async def get_default_data():
    """Returns the first available dataset as the default dashboard data."""
    # 1. Check if any real dataset is already cached
    if _results_cache:
        first_key = list(_results_cache.keys())[0]
        logger.info(f"⚡ Serving '{first_key}' as default dashboard data")
        return _results_cache[first_key]

    # 2. If not cached but exists on disk, process it
    files = [f for f in os.listdir(DATASET_DIR) if f.endswith(('.csv', '.xlsx'))]
    if files:
        fname = files[0]
        fpath = os.path.join(DATASET_DIR, fname)
        df = _read_file(fpath)
        df = _prepare_retail_df(df)
        # Sample for speed if needed
        if len(df) > 100000:
            df = df.sample(100000, random_state=42).sort_values('timestamp')
        result = _process_dataframe(df, cache_key=fname)
        _results_cache[fname] = result
        return result

    raise HTTPException(status_code=404, detail="No datasets available. Please upload a file.")


@app.post("/analyze")
async def analyze_data(file: UploadFile = File(...)):
    if not file.filename.endswith(('.csv', '.xlsx')):
        raise HTTPException(status_code=400, detail="Only CSV or XLSX files are supported.")
    
    contents = await file.read()
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents), encoding='ISO-8859-1')
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")

    df = _prepare_retail_df(df)
    required = ['user_id', 'timestamp', 'amount']
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing required data columns: {missing}. Found: {list(df.columns)}. "
                   "Please ensure your file has Customer ID, Date, and Amount/Price columns."
        )
    
    # 4. Memory Guard: Sample large datasets on free tier to prevent OOM
    if len(df) > 100000:
        logger.info(f"⚡ Large dataset detected ({len(df)} rows). Sampling 100,000 rows for analysis to prevent memory crash.")
        df = df.sample(100000, random_state=42).sort_values('timestamp')

    try:
        return _process_dataframe(df, cache_key="upload")
    except Exception as e:
        logger.error(f"Analysis failed for uploaded file: {e}")
        # Provide a more helpful error message
        detail = str(e)
        if "MemoryError" in detail:
            detail = "The dataset is too large for the server's RAM. Please try uploading a smaller CSV file."
        raise HTTPException(status_code=500, detail=f"Analytics engine failed: {detail}")


# ──────────────────────────────────────
#  Per-User SHAP Endpoint
# ──────────────────────────────────────
@app.get("/user-shap/{user_id}")
async def get_user_shap(user_id: str):
    """Get local SHAP explanation for a specific user."""
    # Try all cached engines
    for key, cache in _engine_cache.items():
        eng = cache['engine']
        rfm_df = cache['rfm_df']
        result = eng.compute_user_shap(user_id, rfm_df)
        if result:
            return result
    raise HTTPException(status_code=404, detail=f"User '{user_id}' not found in any cached dataset")


# ──────────────────────────────────────
#  What-If Counterfactual Simulation
# ──────────────────────────────────────
@app.post("/whatif")
async def whatif_simulation(req: WhatIfRequest):
    """Run a what-if counterfactual simulation on a segment."""
    # Use most recent engine
    if not _engine_cache:
        raise HTTPException(status_code=400, detail="No data loaded yet. Load data first.")
    
    key = list(_engine_cache.keys())[-1]
    eng = _engine_cache[key]['engine']
    rfm_df = _engine_cache[key]['rfm_df']
    
    result = eng.simulate_whatif(rfm_df, req.segment, req.feature, req.delta_pct)
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    return result


# ──────────────────────────────────────
#  LLM Hypotheses Endpoint
# ──────────────────────────────────────
@app.get("/llm-hypotheses")
async def get_llm_hypotheses():
    """Generate LLM-powered business hypotheses from cached analysis."""
    if not _engine_cache:
        raise HTTPException(status_code=400, detail="No data loaded yet.")
    
    key = list(_engine_cache.keys())[-1]
    eng = _engine_cache[key]['engine']
    rfm_df = _engine_cache[key]['rfm_df']
    
    segment_stats = eng.get_segment_churn(rfm_df)
    drivers = sorted(
        zip(eng._feature_names or ['Recency', 'Frequency', 'Monetary'], eng.model.feature_importances_),
        key=lambda x: x[1], reverse=True
    )
    shap_data = eng._compute_shap(rfm_df[['recency', 'frequency', 'monetary']].head(50), eng._feature_names or ['Recency', 'Frequency', 'Monetary'])
    
    hypotheses = await generate_llm_hypotheses(segment_stats, drivers, shap_data)
    return {"hypotheses": hypotheses, "source": "llm" if os.environ.get('GROQ_API_KEY') else "rule_based"}


# ──────────────────────────────────────
#  Model Versions Endpoint
# ──────────────────────────────────────
@app.get("/models")
async def list_models():
    """List all versioned model artifacts."""
    eng = AnalyticsEngine()
    return {"models": eng.list_model_versions()}


# ──────────────────────────────────────
#  Real-Time WebSocket Event Stream
# ──────────────────────────────────────
@app.websocket("/stream")
async def websocket_stream(websocket: WebSocket):
    """Real-time simulated fintech event stream via WebSocket."""
    await websocket.accept()
    logger.info("🔌 WebSocket client connected")
    try:
        while True:
            event = generate_event()
            await websocket.send_json(event)
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        logger.info("🔌 WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
