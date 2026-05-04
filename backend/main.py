from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pandas as pd
import io
import os
import time
import logging
from services.analytics import AnalyticsEngine
import numpy as np
import threading
from concurrent.futures import ThreadPoolExecutor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Caches ──
_results_cache: dict = {}
_demo_cache: dict | None = None

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
    """Normalise Online Retail II format, keeping Description for product mix."""
    mapping = {
        'Customer ID': 'user_id',
        'InvoiceDate': 'timestamp',
        'Price': 'unit_price',
        'Quantity': 'quantity',
    }
    if 'Customer ID' in df.columns:
        # Keep Description column if present
        if 'Description' in df.columns:
            mapping['Description'] = 'description'
        df = df.rename(columns=mapping)
        df['unit_price'] = pd.to_numeric(df['unit_price'], errors='coerce')
        df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce')
        df['amount'] = df['unit_price'] * df['quantity']
        df = df.dropna(subset=['user_id', 'unit_price', 'quantity'])
        df = df[df['quantity'] > 0]
        df['user_id'] = (
            pd.to_numeric(df['user_id'], errors='coerce')
            .fillna(0).astype(int).astype(str)
        )
        df = df[df['user_id'] != '0']
    return df


def _process_dataframe(df: pd.DataFrame) -> dict:
    """Full pipeline: RFM → Churn → Lifecycle → Product Mix → Cohort → JSON."""
    eng = AnalyticsEngine()

    # 1. RFM
    rfm_results, silhouette = eng.calculate_rfm(df)

    # 2. Churn (with proper train/test + SHAP)
    churn_results, drivers, metrics, shap_data = eng.predict_churn(df, rfm_results)

    # 3. Lifecycle
    lifecycle = eng.get_lifecycle_stages(df)

    # 4. Segment-level churn
    segment_churn = eng.get_segment_churn(churn_results)

    # 5. Product mix (graceful skip if no description col)
    product_mix = eng.analyze_product_mix(df, churn_results)

    # 6. Cohort retention
    try:
        cohort_data = eng.build_cohort_matrix(df)
    except Exception as e:
        logger.error(f"Cohort analysis error: {e}")
        cohort_data = []

    # Merge
    final_df = churn_results.merge(lifecycle, on='user_id')

    summary = {
        "total_users": int(final_df['user_id'].nunique()),
        "avg_churn_risk": float(final_df['churn_probability'].mean()),
        "segments": final_df['segment'].value_counts().to_dict(),
        "lifecycle_stages": final_df['lifecycle'].value_counts().to_dict(),
        "top_drivers": [{"feature": d[0], "importance": float(d[1])} for d in drivers],
        "hypotheses": eng.generate_hypotheses(drivers, final_df),
        "metrics": {
            "silhouette_score": float(silhouette),
            **metrics,
        },
        "shap_data": shap_data,
        "segment_churn": segment_churn,
        "product_mix": product_mix,
        "cohort_data": cohort_data,
    }

    user_data = final_df.head(100).to_dict(orient='records')
    return {"summary": summary, "users": user_data}


def _generate_demo_df() -> pd.DataFrame:
    np.random.seed(42)
    n_users, n_events = 200, 2000
    user_ids = [f"USR_{i:03d}" for i in range(n_users)]
    products = ['Premium Plan', 'Basic Plan', 'Add-on Pack', 'Enterprise', 'Free Trial',
                'Wallet Top-up', 'Bill Pay', 'Investment']
    return pd.DataFrame({
        'user_id': np.random.choice(user_ids, n_events),
        'timestamp': [
            pd.Timestamp('2024-01-01') + pd.Timedelta(days=np.random.randint(0, 120))
            for _ in range(n_events)
        ],
        'amount': np.random.uniform(10, 500, n_events),
        'description': np.random.choice(products, n_events),
    })


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
        _results_cache[fname] = _process_dataframe(df)
        logger.info(f"✅ '{fname}' is now READY in {time.time() - t0:.1f}s")
    except Exception as e:
        logger.error(f"❌ Failed to process '{fname}': {e}")


def _warmup_caches():
    global _demo_cache

    logger.info("⏳ Starting Parallel Warmup Engine...")
    
    # 1. Demo data is high priority
    _demo_cache = _process_dataframe(_generate_demo_df())
    logger.info("✅ Demo data ready.")

    if not os.path.exists(DATASET_DIR):
        os.makedirs(DATASET_DIR, exist_ok=True)
        return

    files = [f for f in os.listdir(DATASET_DIR) if f.endswith(('.csv', '.xlsx'))]
    
    # 2. Process all datasets in parallel
    with ThreadPoolExecutor(max_workers=4) as executor:
        executor.map(_warmup_dataset, files)

    # 3. Combined dataset (Last, as it depends on others being ready or is largest)
    if len(files) > 1:
        logger.info("⏳ Processing combined dataset in background...")
        try:
            t0 = time.time()
            all_dfs = []
            for f in files:
                try:
                    d = _read_file(os.path.join(DATASET_DIR, f))
                    d = _prepare_retail_df(d)
                    all_dfs.append(d)
                except: pass
            if all_dfs:
                combined = pd.concat(all_dfs, ignore_index=True)
                _results_cache["all"] = _process_dataframe(combined)
                logger.info(f"✅ All datasets (combined) ready in {time.time() - t0:.1f}s")
        except Exception as e:
            logger.error(f"❌ Combined failed: {e}")

    logger.info("🚀 All local datasets are now cached and ready for instant access.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start warmup in the background so API is responsive immediately
    thread = threading.Thread(target=_warmup_caches, daemon=True)
    thread.start()
    yield


# ──────────────────────────────────────
#  App
# ──────────────────────────────────────
app = FastAPI(title="FinSight API", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "FinSight Analytics Engine v2 is running"}


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

    result = _process_dataframe(df)
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
    result = _process_dataframe(combined)
    _results_cache["all"] = result
    return result


@app.get("/demo-data")
async def get_demo_data():
    global _demo_cache
    if _demo_cache:
        logger.info("⚡ Serving demo data from cache")
        return _demo_cache
    _demo_cache = _process_dataframe(_generate_demo_df())
    return _demo_cache


@app.post("/analyze")
async def analyze_data(file: UploadFile = File(...)):
    if not file.filename.endswith(('.csv', '.xlsx')):
        raise HTTPException(status_code=400, detail="Only CSV or XLSX files")
    contents = await file.read()
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents), encoding='ISO-8859-1')
    else:
        df = pd.read_excel(io.BytesIO(contents))
    df = _prepare_retail_df(df)
    required = ['user_id', 'timestamp', 'amount']
    if not all(c in df.columns for c in required):
        raise HTTPException(status_code=400, detail=f"Missing columns. Found: {list(df.columns)}")
    return _process_dataframe(df)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
