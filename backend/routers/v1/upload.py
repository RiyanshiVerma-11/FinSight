from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
import io
import time
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor

import state
from routers.v1.datasets import _detect_domain, _prepare_data_df, _process_dataframe

logger = logging.getLogger(__name__)

router = APIRouter()

# Reuse a dedicated thread pool for CPU-heavy ML analysis during uploads.
_ml_executor = ThreadPoolExecutor(max_workers=4)

@router.post("/analyze")
async def analyze_data(file: UploadFile = File(...)):
    if not file.filename.endswith(('.csv', '.xlsx')):
        raise HTTPException(status_code=400, detail="Only CSV or XLSX files are supported.")
    
    contents = await file.read()
    df = None
    if file.filename.endswith('.csv'):
        for enc in ['utf-8-sig', 'utf-8', 'ISO-8859-1']:
            try:
                df = pd.read_csv(io.BytesIO(contents), encoding=enc, sep=None, engine='python')
                logger.info(f"CSV parsed OK with encoding={enc}, shape={df.shape}")
                break
            except Exception:
                continue
        if df is None:
            raise HTTPException(status_code=400, detail="Could not read CSV with any encoding.")
    else:
        try:
            df = pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")
    
    logger.info(f"Upload '{file.filename}' raw columns: {list(df.columns)}")
    domain = _detect_domain(df)
    logger.info(f"Upload '{file.filename}' detected domain: {domain.upper()}")
    df = _prepare_data_df(df)
    logger.info(f"Upload '{file.filename}' after prep columns: {sorted(list(df.columns))}")
    
    required = ['user_id', 'timestamp', 'amount']
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing required data columns: {missing}. Found: {list(df.columns)}. "
                   f"Detected domain: {domain}. "
                   "Please ensure your file has Customer ID, Date, and Amount/Price columns."
        )
    
    cache_key = f"upload_{file.filename}_{int(time.time())}"
    
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            _ml_executor, _process_dataframe, df, cache_key
        )
        state.set_active_key(cache_key)
        with state._cache_lock:
            state._engine_cache["upload"] = state._engine_cache.get(cache_key, {})
        return result
    except Exception as e:
        logger.error(f"Analysis failed for uploaded file '{file.filename}': {e}")
        import traceback
        traceback.print_exc()
        detail = str(e)
        if "MemoryError" in detail:
            detail = "The dataset is too large for the server's RAM. Please try uploading a smaller CSV file."
        raise HTTPException(status_code=500, detail=f"Analytics engine failed: {detail}")

