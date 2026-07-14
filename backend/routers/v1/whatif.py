from fastapi import APIRouter, HTTPException
import os
import logging

import state
from schemas import WhatIfRequest, ROIExplainRequest, WhatIfResponse, UserShapResponse
from services.llm_engine import generate_llm_hypotheses, generate_llm_interventions, generate_roi_explanation
from routers.v1.datasets import get_default_data

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/user-shap/{user_id}", response_model=UserShapResponse)
async def get_user_shap(user_id: str):
    if not state._engine_cache:
        logger.warning("⚠️ Engine cache is empty (likely due to restart).")
        raise HTTPException(status_code=503, detail="Server restarted. Please re-select or re-upload the dataset to activate SHAP explainer.")
        
    active_key = state.get_active_key()
    if active_key and active_key in state._engine_cache:
        cache = state._engine_cache[active_key]
        eng = cache['engine']
        rfm_df = cache['rfm_df']
        result = eng.compute_user_shap(user_id, rfm_df)
        if result: return result
            
    for key, cache in state._engine_cache.items():
        if key == active_key: continue
        eng = cache['engine']
        rfm_df = cache['rfm_df']
        result = eng.compute_user_shap(user_id, rfm_df)
        if result: return result
    raise HTTPException(status_code=404, detail=f"User '{user_id}' not found. Please ensure the dataset is fully loaded.")

@router.post("/whatif", response_model=WhatIfResponse)
async def whatif_simulation(req: WhatIfRequest):
    active_key = state.get_active_key()
    if not state._engine_cache or not active_key or active_key not in state._engine_cache:
        if not state._engine_cache: raise HTTPException(status_code=400, detail="No data loaded yet. Load data first.")
        key = list(state._engine_cache.keys())[-1]
    else: key = active_key
    
    eng = state._engine_cache[key]['engine']
    rfm_df = state._engine_cache[key]['rfm_df']
    
    result = eng.simulate_whatif(rfm_df, req.segment, req.feature, req.delta_pct)
    if 'error' in result: raise HTTPException(status_code=400, detail=result['error'])
    return result

@router.get("/llm-hypotheses")
async def get_hypotheses():
    if not state._engine_cache: await get_default_data()
    if not state._engine_cache: raise HTTPException(status_code=503, detail="No data loaded yet. Please load a dataset first.")
    
    active_key = state.get_active_key()
    if active_key and active_key in state._engine_cache:
        key = active_key
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
    explanation = await generate_roi_explanation(req.model_dump())
    return {"explanation": explanation}

@router.get("/interventions")
async def get_interventions():
    if not state._engine_cache: raise HTTPException(status_code=400, detail="No data loaded yet.")
    
    active_key = state.get_active_key()
    if active_key and active_key in state._engine_cache:
        key = active_key
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
