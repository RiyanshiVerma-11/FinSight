from fastapi import APIRouter, HTTPException
import os
import logging

import state
from schemas import WhatIfRequest, ROIExplainRequest
from services.llm_engine import generate_llm_hypotheses, generate_llm_interventions, generate_roi_explanation
from routers.v1.datasets import get_default_data

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/user-shap/{user_id}")
async def get_user_shap(user_id: str):
    if not state._engine_cache:
        logger.warning("⚠️ Engine cache is empty (likely due to restart).")
        raise HTTPException(status_code=503, detail="Server restarted. Please re-select or re-upload the dataset to activate SHAP explainer.")
        
    if state._active_dataset_key and state._active_dataset_key in state._engine_cache:
        cache = state._engine_cache[state._active_dataset_key]
        eng = cache['engine']
        rfm_df = cache['rfm_df']
        result = eng.compute_user_shap(user_id, rfm_df)
        if result: return result
            
    for key, cache in state._engine_cache.items():
        if key == state._active_dataset_key: continue
        eng = cache['engine']
        rfm_df = cache['rfm_df']
        result = eng.compute_user_shap(user_id, rfm_df)
        if result: return result
    raise HTTPException(status_code=404, detail=f"User '{user_id}' not found. Please ensure the dataset is fully loaded.")

@router.post("/whatif")
async def whatif_simulation(req: WhatIfRequest):
    if not state._engine_cache or not state._active_dataset_key or state._active_dataset_key not in state._engine_cache:
        if not state._engine_cache: raise HTTPException(status_code=400, detail="No data loaded yet. Load data first.")
        key = list(state._engine_cache.keys())[-1]
    else: key = state._active_dataset_key
    
    eng = state._engine_cache[key]['engine']
    rfm_df = state._engine_cache[key]['rfm_df']
    
    result = eng.simulate_whatif(rfm_df, req.segment, req.feature, req.delta_pct)
    if 'error' in result: raise HTTPException(status_code=400, detail=result['error'])
    return result

@router.get("/llm-hypotheses")
async def get_hypotheses():
    if not state._engine_cache: await get_default_data()
    if not state._engine_cache: raise HTTPException(status_code=503, detail="No data loaded yet. Please load a dataset first.")
    
    if state._active_dataset_key and state._active_dataset_key in state._engine_cache:
        key = state._active_dataset_key
    else: key = list(state._engine_cache.keys())[-1]
        
    eng = state._engine_cache[key]['engine']
    rfm_df = state._engine_cache[key]['rfm_df']
    
    segment_stats = eng.get_segment_churn(rfm_df)
    drivers = [{"feature": name, "importance": float(imp)} for name, imp in zip(
        eng._feature_names or ['Recency', 'Frequency', 'Monetary'], 
        getattr(eng._raw_model, 'feature_importances_', getattr(eng.model, 'feature_importances_', []))
    )]
    drivers.sort(key=lambda x: x['importance'], reverse=True)
    shap_data = state._engine_cache[key].get('shap_data') or []
    
    hypotheses = await generate_llm_hypotheses(segment_stats, drivers, shap_data)
    return {"hypotheses": hypotheses, "source": "llm" if os.environ.get('GROQ_API_KEY') else "rule_based"}

@router.post("/explain-roi")
async def explain_roi(req: ROIExplainRequest):
    explanation = await generate_roi_explanation(req.dict())
    return {"explanation": explanation}

@router.get("/interventions")
async def get_interventions():
    if not state._engine_cache: raise HTTPException(status_code=400, detail="No data loaded yet.")
    if state._active_dataset_key and state._active_dataset_key in state._engine_cache:
        key = state._active_dataset_key
    else: key = list(state._engine_cache.keys())[-1]
        
    eng = state._engine_cache[key]['engine']
    rfm_df = state._engine_cache[key]['rfm_df']

    segment_stats = eng.get_segment_churn(rfm_df)
    drivers = [{"feature": name, "importance": float(imp), "direction": "unknown"} for name, imp in zip(
        eng._feature_names or ['Recency', 'Frequency', 'Monetary'],
        getattr(eng._raw_model, 'feature_importances_', getattr(eng.model, 'feature_importances_', []))
    )]
    drivers.sort(key=lambda x: x['importance'], reverse=True)

    interventions = await generate_llm_interventions(segment_stats, drivers)
    return {"interventions": interventions, "source": "llm" if os.environ.get('GROQ_API_KEY') else "rule_based"}
