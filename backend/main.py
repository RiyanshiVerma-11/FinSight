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
from services.llm_engine import generate_llm_hypotheses, generate_llm_interventions
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
_processing_status: dict = {} # Track currently processing files to prevent duplicate work
_active_dataset_key: str | None = None # Track the dataset currently being viewed
_cache_lock = threading.Lock() # Lock for cache and status updates

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "datasets")

# ── Configuration Constants ──
# Render/Cloud has strict 512MB RAM limits, local machine usually has more.
IS_CLOUD = os.environ.get('RENDER') is not None or os.environ.get('IS_CLOUD') == '1'
MAX_ROWS = 65000 if IS_CLOUD else 1_000_000 
MIN_USERS_TO_KEEP = 100

if IS_CLOUD:
    logger.info("☁️ Cloud environment detected. Memory Guard active (65k rows).")
else:
    logger.info("💻 Local environment detected. Memory Guard relaxed (1M rows).")


# ──────────────────────────────────────
#  Helpers
# ──────────────────────────────────────
def _read_file(path: str) -> pd.DataFrame:
    if path.endswith('.csv'):
        # PRODUCTION FIX: Use robust multi-encoding detection for local files 
        # to match the upload logic and handle BOM/special characters consistently.
        for enc in ['utf-8-sig', 'utf-8', 'ISO-8859-1']:
            try:
                # Use engine='python' and sep=None to auto-detect delimiters
                return pd.read_csv(path, encoding=enc, sep=None, engine='python')
            except Exception:
                continue
        raise ValueError(f"Could not read CSV '{path}' with any encoding.")
    elif path.endswith('.xlsx'):
        return pd.read_excel(path)
    raise ValueError(f"Unsupported format: {path}")


import difflib

def _fuzzy_match(target: str, candidates: list, threshold: float = 0.8) -> str | None:
    """Enhanced fuzzy matcher using SequenceMatcher and normalized overlap."""
    t_norm = target.lower().replace(' ', '').replace('_', '')
    
    best_match = None
    best_score = 0
    
    for cand in candidates:
        c_norm = cand.lower().replace(' ', '').replace('_', '')
        
        # 1. Exact normalized match (highest priority)
        if t_norm == c_norm:
            return cand
            
        # 2. Sequence Similarity
        score = difflib.SequenceMatcher(None, t_norm, c_norm).ratio()
        if score > best_score:
            best_score = score
            best_match = cand
            
        # 3. Substring match for clear terms
        if len(t_norm) > 3 and (t_norm in c_norm or c_norm in t_norm):
            if best_score < 0.9: # Boost substring matches
                best_score = 0.9
                best_match = cand

    return best_match if best_score >= threshold else None


def _detect_domain(df: pd.DataFrame) -> str:
    """Detect the business domain of the dataset based on column signatures.
    
    Uses normalized column names (lowercase, no underscores/spaces) to match
    against known domain fingerprints. Checks are ordered from most specific
    to least specific to avoid false positives.
    """
    cols_raw = [str(c).lower().strip() for c in df.columns]
    cols_norm = [c.replace('_', '').replace(' ', '') for c in cols_raw]
    # Also check raw (with underscores) for exact matches like 'payer_vpa'
    all_sigs = set(cols_norm) | set(cols_raw)
    
    # 1. UPI / Fintech Transactional — very specific signals
    upi_sigs = [
        'txnid', 'txn_id', 'sendervpa', 'sender_vpa', 'receivervpa', 'receiver_vpa',
        'rrn', 'upiid', 'upi_id', 'vpa', 'responsecode', 'response_code',
        'payername', 'payer_name', 'payeename', 'payee_name', 'senderupiid',
        'payervpa', 'payer_vpa', 'payeevpa', 'payee_vpa', 'payeruserid',
        'payer_user_id', 'mcc', 'failurereason', 'failure_reason',
    ]
    if sum(1 for s in upi_sigs if s in all_sigs) >= 2:
        return "upi"
    
    # 2. Tax / Compliance (Form 26AS)
    tax_sigs = [
        'pan', 'fy', 'incomehead', 'income_head', 'tdsamountinr', 'tds_amount_inr',
        'deductortan', 'deductor_tan', 'section', 'grossamount', 'gross_amount',
        'dateofcredit', 'date_of_credit', 'taxableincome', 'taxable_income',
        'grossamountinr', 'gross_amount_inr', 'deductorname', 'deductor_name',
    ]
    if sum(1 for s in tax_sigs if s in all_sigs) >= 2:
        return "tax"
    
    # 3. Bank Churn (Summary / Kaggle style)
    churn_sigs = [
        'exited', 'creditscore', 'credit_score', 'estimatedsalary', 'estimated_salary',
        'numofproducts', 'num_of_products', 'hascrcard', 'has_cr_card',
        'isactivemember', 'is_active_member', 'tenure', 'balance', 'churnflag',
        'churn_flag', 'churn', 'churned', 'attrition',
    ]
    if sum(1 for s in churn_sigs if s in all_sigs) >= 2:
        return "bank_churn"
    
    # 4. Retail / E-commerce Transactional
    retail_sigs = [
        'invoice', 'invoiceno', 'invoice_no', 'stockcode', 'stock_code',
        'invoicedate', 'invoice_date', 'customerid', 'customer_id',
        'unitprice', 'unit_price', 'quantity',
    ]
    if sum(1 for s in retail_sigs if s in all_sigs) >= 2:
        return "retail"
        
    return "generic"


def _prepare_data_df(df: pd.DataFrame) -> pd.DataFrame:
    """Entry point for data preparation. Detects domain and routes to specific logic."""
    domain = _detect_domain(df)
    logger.info(f"🔍 Domain detected: {domain.upper()}")
    
    if domain == "upi":
        return _prepare_upi_df(df)
    elif domain == "tax":
        return _prepare_tax_df(df)
    elif domain == "bank_churn":
        return _prepare_bank_churn_df(df)
    else:
        # Default to retail logic as it's the most flexible for transactional data
        return _prepare_retail_df(df)


def _prepare_upi_df(df: pd.DataFrame) -> pd.DataFrame:
    """Specialized preparation for UPI/Fintech transaction data.
    
    Uses direct column-name lookups (case-insensitive) instead of fuzzy
    matching so that uploads from the browser produce identical results
    to reading from the local datasets/ folder.
    """
    # Direct, deterministic mapping: {target_name: [possible_source_names]}
    # We check lowercase versions of actual column names for reliability.
    col_lower_map = {str(c).lower().strip(): c for c in df.columns}
    
    rename = {}
    # user_id
    for candidate in ['payer_user_id', 'user_id', 'sender_vpa', 'vpa', 'upi_id', 'customer_id', 'payer_vpa']:
        if candidate in col_lower_map and 'user_id' not in rename.values():
            rename[col_lower_map[candidate]] = 'user_id'
            break
    # timestamp
    for candidate in ['ts', 'txn_date', 'timestamp', 'txn_time', 'date', 'created_at', 'time_stamp']:
        if candidate in col_lower_map and 'timestamp' not in rename.values():
            rename[col_lower_map[candidate]] = 'timestamp'
            break
    # amount
    for candidate in ['amount_inr', 'amount', 'txn_amount', 'transaction_amount', 'value']:
        if candidate in col_lower_map and 'amount' not in rename.values():
            rename[col_lower_map[candidate]] = 'amount'
            break
    # description
    for candidate in ['payee_name', 'receiver_name', 'merchant', 'description', 'txn_type', 'remarks']:
        if candidate in col_lower_map and 'description' not in rename.values():
            rename[col_lower_map[candidate]] = 'description'
            break
    # status
    for candidate in ['status', 'response_code', 'result']:
        if candidate in col_lower_map and 'status' not in rename.values():
            rename[col_lower_map[candidate]] = 'status'
            break
    
    logger.info(f"UPI column mapping: {rename}")
    df = df.rename(columns=rename)
    
    # UPI Specific: Churn is often defined by 'FAILURE' patterns or drop in successful txns
    if 'status' in df.columns:
        df['is_failure'] = df['status'].astype(str).str.upper().isin(['FAILURE', 'FAILED', 'ERR', '0']).astype(int)
        
    df['domain'] = 'upi'
    return _prepare_retail_df(df) # Reuse common cleaning logic


def _prepare_tax_df(df: pd.DataFrame) -> pd.DataFrame:
    """Specialized preparation for Tax/Income data (Form 26AS).
    
    Uses direct column-name lookups for reliable mapping.
    """
    col_lower_map = {str(c).lower().strip(): c for c in df.columns}
    
    rename = {}
    for candidate in ['user_id', 'pan', 'tan', 'customer_id']:
        if candidate in col_lower_map and 'user_id' not in rename.values():
            rename[col_lower_map[candidate]] = 'user_id'
            break
    for candidate in ['date_of_credit', 'date_of_payment', 'timestamp', 'date', 'credit_date', 'payment_date']:
        if candidate in col_lower_map and 'timestamp' not in rename.values():
            rename[col_lower_map[candidate]] = 'timestamp'
            break
    for candidate in ['gross_amount_inr', 'gross_amount', 'amount', 'income', 'taxable_income']:
        if candidate in col_lower_map and 'amount' not in rename.values():
            rename[col_lower_map[candidate]] = 'amount'
            break
    for candidate in ['deductor_name', 'income_head', 'description', 'section']:
        if candidate in col_lower_map and 'description' not in rename.values():
            rename[col_lower_map[candidate]] = 'description'
            break
    
    logger.info(f"TAX column mapping: {rename}")
    df = df.rename(columns=rename)
    
    # Tax Specific: Frequency is usually low (quarterly/monthly)
    # We mark it so the analytics engine doesn't penalize low frequency
    df['domain'] = 'tax'
    return _prepare_retail_df(df)


def _prepare_bank_churn_df(df: pd.DataFrame) -> pd.DataFrame:
    """Specialized preparation for Bank Churn (Summary) data.
    
    Uses direct column-name lookups for reliable mapping.
    """
    col_lower_map = {str(c).lower().strip(): c for c in df.columns}
    
    rename = {}
    for candidate in ['customerid', 'customer_id', 'user_id', 'id']:
        if candidate in col_lower_map and 'user_id' not in rename.values():
            rename[col_lower_map[candidate]] = 'user_id'
            break
    for candidate in ['exited', 'churn', 'churned', 'churn_flag', 'is_churn', 'attrition']:
        if candidate in col_lower_map and 'target_churn' not in rename.values():
            rename[col_lower_map[candidate]] = 'target_churn'
            break
    
    logger.info(f"BANK_CHURN column mapping: {rename}")
    df = df.rename(columns=rename)
    
    df['domain'] = 'bank_churn'
    return _prepare_retail_df(df)

def _prepare_retail_df(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise various retail formats into the standard internal schema."""
    # 1. Flexible Column Mapping (Comprehensive Dictionary)
    mapping_dictionary = {
        'user_id': ['userid', 'customerid', 'clientid', 'id', 'user', 'uid', 'account_number', 'member_id', 'customer_id', 'payer_user_id', 'UID', 'Account', 'VPA', 'UPI ID', 'PAN', 'Payer Name', 'Payer', 'PayerUser_ID', 'sender_vpa', 'upi_id'],
        'timestamp': ['InvoiceDate', 'Date', 'timestamp', 'time', 'Order Date', 'date', 'Invoice Date', 'date_of_credit', 'ts', 'txn_date', 'CreatedAt', 'Date of Payment', 'Payment Date', 'Transaction Date', 'CreditDate', 'date_of_payment', 'txn_time', 'time_stamp'],
        'amount': ['Price', 'Total', 'Amount', 'revenue', 'sum', 'amount', 'Total Price', 'TotalPrice', 'gross_amount_inr', 'amount_inr', 'TransactionAmount', 'Transaction Amount', 'TDS Amount', 'Credit', 'Debit', 'payment_amount', 'net_amount', 'gross_amount', 'txn_amount', 'transaction_amount', 'deposit', 'withdrawal', 'value'],
        'monetary': ['balance', 'amount', 'total_spend', 'revenue', 'monetary', 'value', 'transaction_value', 'spend', 'wallet_balance', 'gross_amount_inr', 'amount_inr', 'net_worth', 'wallet', 'funds', 'capital', 'current_balance'],
        'unit_price': ['Price', 'UnitPrice', 'Unit Price', 'price', 'unit_price', 'rate'],
        'quantity': ['Quantity', 'Qty', 'quantity', 'count', 'units'],
        'frequency': ['frequency', 'orders', 'numofproducts', 'products_number', 'transaction_count', 'purchase_count', 'order_count', 'txn_count', 'NumOfProducts'],
        'tenure_months': ['tenure', 'account_age', 'membership_duration', 'months_active', 'customer_since', 'Tenure'],
        'target_churn': ['exited', 'churn', 'churned', 'is_churn', 'left', 'attrition', 'churn_flag', 'target_churn', 'Exited', 'is_churned'],
        'is_active': ['isactivemember', 'active', 'is_active', 'active_member', 'engagement_flag', 'IsActiveMember'],
        'credit_score': ['creditscore', 'credit_rating', 'score', 'credit_worthiness', 'CreditScore', 'cibil_score'],
        'monetary_velocity': ['estimated_salary', 'income', 'daily_spend', 'velocity', 'EstimatedSalary', 'annual_income'],
        'description': ['Description', 'description', 'Product', 'product', 'ProductDescription', 'payee_name', 'merchant', 'receiver_name', 'txn_type', 'remarks']
    }
    
    current_cols = list(df.columns)
    found_mapping = {}
    used_candidates = set()
    
    # CRITICAL: Skip mapping for columns that domain-specific preparers already mapped.
    # This prevents double-mapping bugs where e.g. 'user_id' gets re-mapped to 'monetary'.
    already_mapped = {'user_id', 'timestamp', 'amount', 'description', 'status'}
    for col in already_mapped:
        if col in current_cols:
            used_candidates.add(col)  # mark as "taken" so fuzzy won't steal it
    
    # Priority 1: Exact/Normalized matches for primary keys (skip if already present)
    for target in ['user_id', 'timestamp', 'amount']:
        if target in current_cols:
            continue  # Already mapped by domain-specific preparer
        variations = [target] + mapping_dictionary.get(target, [])
        for var in variations:
            match = _fuzzy_match(var, current_cols, threshold=0.95)
            if match and match not in used_candidates:
                found_mapping[match] = target
                used_candidates.add(match)
                break

    # Priority 2: Fuzzy matches for everything else (skip already-present targets)
    for target, variations in mapping_dictionary.items():
        if target in found_mapping.values(): continue
        if target in current_cols: continue  # Already present from domain-specific prep
        
        all_vars = [target] + variations
        best_cand = None
        best_score = 0
        
        for var in all_vars:
            match = _fuzzy_match(var, current_cols, threshold=0.8)
            if match and match not in used_candidates:
                # We want the best match among variations
                score = difflib.SequenceMatcher(None, var.lower(), match.lower()).ratio()
                if score > best_score:
                    best_score = score
                    best_cand = match
        
        if best_cand:
            found_mapping[best_cand] = target
            used_candidates.add(best_cand)
    
    if found_mapping:
        df = df.rename(columns=found_mapping)
        
        # PRODUCTION FIX: Explicitly coerce all mapped columns to numeric
        # This ensures that columns like 'credit_score' or 'tenure' are treated 
        # as features by the analytics engine instead of being ignored as 'object' types.
        numeric_targets = [
            'monetary', 'unit_price', 'quantity', 'frequency', 
            'tenure_months', 'is_active', 'credit_score', 'monetary_velocity'
        ]
        for target in numeric_targets:
            if target in df.columns:
                df[target] = pd.to_numeric(df[target], errors='coerce').fillna(0)

        # Ensure semantic aliases are filled if only one exists
        if 'monetary' in df.columns and 'amount' not in df.columns:
            df['amount'] = df['monetary']
        elif 'amount' in df.columns and 'monetary' not in df.columns:
            df['monetary'] = df['amount']
            
        if 'user_id' in df.columns and 'customer_id' not in df.columns:
            df['customer_id'] = df['user_id']
        elif 'customer_id' in df.columns and 'user_id' not in df.columns:
            df['user_id'] = df['customer_id']

    # ── Target Churn Normalization ──
    if 'target_churn' in df.columns:
        # Convert strings/bools to 0/1
        if df['target_churn'].dtype == object or df['target_churn'].dtype == bool:
            # Map common positive labels to 1
            pos_labels = ['yes', 'true', '1', 'exited', 'churned', 'churn', 'left', 'attrition', '1.0']
            df['target_churn'] = df['target_churn'].astype(str).str.lower().str.strip().isin(pos_labels).astype(int)
        else:
            df['target_churn'] = pd.to_numeric(df['target_churn'], errors='coerce').fillna(0).astype(int)


    # 2. Description column for Product Mix
    desc_cols = ['Description', 'description', 'Product', 'product', 'ProductDescription', 'payee_name', 'merchant', 'receiver_name']
    for c in desc_cols:
        if c in df.columns and c != 'description':
            df = df.rename(columns={c: 'description'})
            break

    # 3. Handle required columns
    df = df.loc[:, ~df.columns.duplicated()]

    if 'user_id' in df.columns:
        # PRODUCTION FIX: Handle alphanumeric user_ids (common in UPI/Fintech)
        # We only try numeric conversion if possible, otherwise keep as string.
        df['user_id'] = df['user_id'].astype(str).str.strip()
        df = df[df['user_id'].str.len() > 0]
        df = df[~df['user_id'].isin(['0', 'nan', 'None', 'null'])]

    if 'timestamp' in df.columns:
        try:
            # Try parsing with format inference first
            df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
            
            # Fallback for numeric timestamps
            if df['timestamp'].isna().mean() > 0.5:
                numeric_ts = pd.to_numeric(df['timestamp'], errors='coerce')
                if not numeric_ts.isna().all():
                    max_val = numeric_ts.max()
                    unit = 'ms' if max_val > 1e11 else 's'
                    df['timestamp'] = pd.to_datetime(numeric_ts, unit=unit, errors='coerce')
        except Exception as e:
            logger.warning(f"Datetime conversion fallback: {e}")
            df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')


        # Only drop if we have actual timestamp data to work with
        if df['timestamp'].notna().any():
            df = df.dropna(subset=['timestamp'])
        else:
            # If column exists but is all NaT, treat as if it's not there to allow summary data fallback
            df = df.drop(columns=['timestamp'])

    # 4. Amount normalization
    if 'amount' not in df.columns and 'unit_price' in df.columns and 'quantity' in df.columns:
        df['unit_price'] = pd.to_numeric(df['unit_price'], errors='coerce').fillna(0)
        df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
        df['amount'] = df['unit_price'] * df['quantity']
    elif 'amount' in df.columns:
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0)

    # For Summary Data (Kaggle-style: Churn_Modelling, Bank Churn, etc.)
    # These datasets have ONE ROW PER USER with aggregate fields.
    # We synthesize realistic transaction histories from the summary.
    _is_summary_data = 'timestamp' not in df.columns and 'tenure_months' in df.columns
    if _is_summary_data:
        # Use a fixed reference date for deterministic synthetic generation
        now = pd.Timestamp('2024-05-10')
        raw_tenure = pd.to_numeric(df['tenure_months'], errors='coerce').fillna(1)
        # Tenure normalization: values 0-25 are likely years, else months
        if raw_tenure.max() <= 25:
            actual_months = (raw_tenure * 12).clip(lower=6)
        else:
            actual_months = raw_tenure.clip(lower=6)
        df['tenure_months'] = actual_months

        # Synthesize amount: Use Balance if available, fallback to Salary/12
        if 'amount' not in df.columns:
            balance = pd.to_numeric(df.get('monetary', pd.Series(dtype=float)), errors='coerce').fillna(0)
            salary = pd.to_numeric(df.get('monetary_velocity', pd.Series(dtype=float)), errors='coerce').fillna(0)
            # For users with Balance=0, use monthly salary as proxy
            df['amount'] = balance.where(balance > 0, salary / 12).clip(lower=100)

        # Generate N synthetic transactions per user (N = NumOfProducts or frequency)
        freq_col = df.get('frequency', pd.Series([1]*len(df), index=df.index))
        freq_vals = pd.to_numeric(freq_col, errors='coerce').fillna(1).clip(lower=1, upper=10).astype(int)
        
        expanded_rows = []
        for idx, row in df.iterrows():
            n_txns = int(freq_vals.get(idx, 1))
            tenure_days = max(int(actual_months.get(idx, 6) * 30), 30)
            for t in range(n_txns):
                new_row = row.copy()
                # Spread transactions evenly across tenure
                offset = int(tenure_days * (t + 1) / (n_txns + 1))
                new_row['timestamp'] = now - pd.Timedelta(days=offset)
                new_row['amount'] = float(row['amount']) / max(n_txns, 1)
                expanded_rows.append(new_row)
        df = pd.DataFrame(expanded_rows)
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(100)
        df['_is_summary'] = True
        logger.info(f"📊 Summary data expanded: {len(expanded_rows)} synthetic transactions created")


    # Drop cancellations and retain only positive transactions
    if 'Invoice' in df.columns:
        df = df[~df['Invoice'].astype(str).str.startswith('C', na=False)]
    # Only filter amount>0 for TRANSACTIONAL data, not summary data
    if 'amount' in df.columns and not _is_summary_data:
        df = df[df['amount'] > 0]

    # Final Cleanup
    required = ['user_id', 'timestamp', 'amount']
    df = df.dropna(subset=[c for c in required if c in df.columns])
    
    # ── MEMORY GUARD FOR CLOUD (RENDER/HEROKU) ──
    # To prevent 512MB RAM OOM crashes, we downsample extremely large datasets 
    # while preserving complete histories for the sampled users to keep RFM accurate.
    if len(df) > MAX_ROWS:
        logger.warning(f"⚠️ Memory Guard: Downsampling dataset from {len(df)} to ~{MAX_ROWS} rows to prevent OOM.")
        unique_users = df['user_id'].unique()
        keep_ratio = MAX_ROWS / len(df)
        num_users_to_keep = max(MIN_USERS_TO_KEEP, int(len(unique_users) * keep_ratio))
        
        # Use Generator instead of global seed for isolated randomness
        rng = np.random.default_rng(seed=42)
        keep_users = rng.choice(unique_users, num_users_to_keep, replace=False)
        
        # Track dropped users for audit trail (logging summary)
        dropped_users_count = len(unique_users) - num_users_to_keep
        logger.info(f"📋 Audit Trail: Dropping {dropped_users_count} users to maintain performance. Keeping {num_users_to_keep} users.")
        
        df = df[df['user_id'].isin(keep_users)]
        
    return df
def _process_dataframe(df: pd.DataFrame, cache_key: str = "_default") -> dict:
    """Full pipeline: RFM → Churn → Lifecycle → Product Mix → Cohort → Revenue → JSON."""
    eng = AnalyticsEngine()

    # 1. Dynamic RFM (with IPI + Monetary Velocity)
    rfm_results, silhouette = eng.calculate_rfm(df)

    # 2. Churn (with proper train/test + SHAP + model versioning)
    # Use cache_key as model_id for persistent caching
    model_id = cache_key if cache_key != "_default" else None
    churn_results, drivers, metrics, shap_data = eng.predict_churn(df, rfm_results, model_id=model_id)

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

    # 7. Revenue-at-Risk & Recovery Potential
    revenue_at_risk = eng.get_revenue_at_risk(churn_results)
    potential_recovery = eng.get_potential_recovery(churn_results, metrics)

    # Merge
    # ── PRODUCTION GUARD: Defensive Merge ──
    # Standardize column names and deduplicate to prevent 'columns overlap' errors
    churn_results = churn_results.loc[:, ~churn_results.columns.duplicated()]
    lifecycle = lifecycle.loc[:, ~lifecycle.columns.duplicated()]
    
    # Drop any potential collisions from lifecycle that are already in churn_results
    overlap = [c for c in lifecycle.columns if c in churn_results.columns and c != 'user_id']
    if overlap:
        lifecycle = lifecycle.drop(columns=overlap)
    
    final_df = churn_results.merge(
        lifecycle, 
        on='user_id', 
        how='left'
    )
    # Force de-duplication of any colliding columns (segment_x/y etc)
    final_df = final_df.loc[:, ~final_df.columns.duplicated()]

    # 8. LLM / Rule-based hypotheses
    hypotheses = eng.generate_hypotheses(drivers, final_df)

    # 9. Churn Forecast (Data-Driven)
    try:
        forecast_data = eng.compute_churn_forecast(final_df, cohort_data, metrics)
    except Exception as e:
        logger.error(f"Forecast computation error: {e}")
        forecast_data = []

    # Ensure 'segment' exists and is a single column Series
    if 'segment' in final_df.columns:
        segment_series = final_df['segment']
        if isinstance(segment_series, pd.DataFrame):
            segment_series = segment_series.iloc[:, 0]
        segments_dict = segment_series.value_counts().to_dict()
    else:
        segments_dict = {}

    # 10. Model Info (Dynamic)
    best_model = metrics.get('primary_model', 'Random Forest')

    summary = {
        "total_users": int(final_df['user_id'].nunique()),
        "avg_churn_risk": float((final_df['churn_probability'] * final_df['monetary']).sum() / max(final_df['monetary'].sum(), 1)),
        "data_health": eng._calculate_data_health(df),
        "segments": segments_dict,
        "lifecycle_stages": final_df['lifecycle'].value_counts().to_dict(),
        "top_drivers": drivers,
        "hypotheses": hypotheses,
        "metrics": {
            "silhouette_score": float(silhouette),
            "total_high_risk_users": int(len(final_df[final_df['churn_probability'] >= metrics.get('optimal_threshold', 0.5)])),
            "onboarding_risk_users": int(len(final_df[(final_df['lifecycle'] == 'New') & (final_df['churn_probability'] >= metrics.get('optimal_threshold', 0.5))])),
            "critical_threshold_users": int(len(final_df[(final_df['lifecycle'] == 'New') & (final_df['churn_probability'] >= metrics.get('optimal_threshold', 0.5))])),
            **metrics,
        },
        "shap_data": shap_data,
        "segment_churn": segment_churn,
        "product_mix": product_mix,
        "cohort_data": cohort_data,
        "revenue_at_risk": revenue_at_risk,
        "potential_recovery": potential_recovery,
        "forecast": forecast_data,
        "model_info": {
            "name": best_model,
            "n_estimators": getattr(eng._raw_model, 'n_estimators', 100),
            "features_used": eng._feature_names,
            "optimal_threshold": metrics.get('optimal_threshold', 0.5),
        },
    }

    # Prioritize 'New' lifecycle users for the executive dashboard list
    new_users = final_df[final_df['lifecycle'] == 'New']
    other_users = final_df[final_df['lifecycle'] != 'New'].sort_values('churn_probability', ascending=False)
    
    combined_sample = pd.concat([new_users, other_users]).head(1000)
    user_data = combined_sample.to_dict(orient='records')

    # Cache engine for per-user SHAP & what-if
    _engine_cache[cache_key] = {'engine': eng, 'rfm_df': churn_results, 'shap_data': shap_data}

    return {"summary": summary, "users": user_data}


def _build_synthetic_demo_df(n_users: int = 500, seed: int = 42) -> pd.DataFrame:
    """
    Build a deterministic synthetic retail-like dataset.
    Used only as a resilient fallback when no local dataset exists.
    """
    rng = np.random.default_rng(seed)
    base = pd.Timestamp("2024-01-01")
    rows = []

    for uid in range(1, n_users + 1):
        # Add a subtle behavioral signal: users with even IDs have higher frequency
        # and more recent transactions, making them less likely to churn.
        is_loyal = (uid % 2 == 0)
        n_tx = int(rng.integers(10, 40)) if is_loyal else int(rng.integers(2, 8))
        
        for _ in range(n_tx):
            # Loyal users have transactions spread across the year, including very recent ones.
            # Churn-prone users have transactions clustered in the past.
            if is_loyal:
                days_ago = int(rng.integers(0, 365))
            else:
                days_ago = int(rng.integers(60, 365)) # Not seen in last 60 days
                
            amount = round(float(rng.uniform(10, 5000)), 2)
            rows.append(
                {
                    "user_id": str(uid),
                    "timestamp": (base + pd.Timedelta(days=days_ago)).strftime(
                        "%Y-%m-%d"
                    ),
                    "amount": amount,
                    "description": rng.choice(
                        ["purchase", "transfer", "topup", "withdrawal"]
                    ),
                }
            )

    df = pd.DataFrame(rows)
    return df.dropna(subset=["timestamp"])


# ──────────────────────────────────────
#  Warmup
# ──────────────────────────────────────
def _warmup_dataset(fname):
    """Worker function for parallel warmup."""
    with _cache_lock:
        if fname in _results_cache or _processing_status.get(fname) == "processing":
            return
        _processing_status[fname] = "processing"

    fpath = os.path.join(DATASET_DIR, fname)
    logger.info(f"⏳ Background processing '{fname}'...")
    try:
        t0 = time.time()
        df = _read_file(fpath)
        df = _prepare_data_df(df)
        
        # Memory Guard: Removed sampling to support full dataset analysis
        # Only filtering for required columns now
        required = ['user_id', 'timestamp', 'amount']
        if not all(c in df.columns for c in required):
            logger.warning(f"⚠️  Skipping '{fname}' - missing columns")
            with _cache_lock:
                _processing_status[fname] = "failed"
            return

        result = _process_dataframe(df, cache_key=fname)
        with _cache_lock:
            _results_cache[fname] = result
            _processing_status[fname] = "ready"
        logger.info(f"✅ '{fname}' is now READY in {time.time() - t0:.1f}s")
    except Exception as e:
        logger.error(f"❌ Failed to process '{fname}': {e}")
        with _cache_lock:
            _processing_status[fname] = "failed"


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
    global _active_dataset_key
    if filename in _results_cache:
        logger.info(f"⚡ Serving '{filename}' from cache")
        _active_dataset_key = filename
        return _results_cache[filename]

    if filename == "all":
        return await _analyze_all_live()

    file_path = os.path.join(DATASET_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Not found: {filename}")

    df = _read_file(file_path)
    df = _prepare_data_df(df)
    required = ['user_id', 'timestamp', 'amount']
    if not all(c in df.columns for c in required):
        raise HTTPException(status_code=400, detail=f"Missing columns. Found: {list(df.columns)}")

    result = _process_dataframe(df, cache_key=filename)
    _results_cache[filename] = result
    _active_dataset_key = filename
    return result


async def _analyze_all_live():
    global _active_dataset_key
    if not os.path.exists(DATASET_DIR):
        raise HTTPException(status_code=404, detail="Datasets directory not found")
    files = [f for f in os.listdir(DATASET_DIR) if f.endswith(('.csv', '.xlsx'))]
    if not files:
        raise HTTPException(status_code=404, detail="No datasets found")
    all_dfs = []
    for f in files:
        df = _read_file(os.path.join(DATASET_DIR, f))
        df = _prepare_data_df(df)
        all_dfs.append(df)
    combined = pd.concat(all_dfs, ignore_index=True)
    dedupe_candidates = ['user_id', 'timestamp', 'amount']
    if 'Invoice' in combined.columns:
        dedupe_candidates.insert(0, 'Invoice')
    if 'StockCode' in combined.columns:
        dedupe_candidates.append('StockCode')
    existing_keys = [c for c in dedupe_candidates if c in combined.columns]
    if existing_keys:
        combined = combined.drop_duplicates(subset=existing_keys)
    result = _process_dataframe(combined, cache_key="all")
    _results_cache["all"] = result
    _active_dataset_key = "all"
    return result


@app.get("/demo-data")
async def get_default_data():
    """Returns the first available dataset as the default dashboard data."""
    global _active_dataset_key
    # 1. Check if any real dataset is already cached
    with _cache_lock:
        if _results_cache:
            first_key = list(_results_cache.keys())[0]
            logger.info(f"⚡ Serving '{first_key}' from cache")
            _active_dataset_key = first_key
            return _results_cache[first_key]

    # 2. If nothing cached, check if anything is on disk
    files = [f for f in os.listdir(DATASET_DIR) if f.endswith(('.csv', '.xlsx'))]
    if not files:
        logger.warning("⚠️ No datasets found on disk. Serving deterministic synthetic demo dataset.")
        synthetic_key = "synthetic_demo"
        if synthetic_key in _results_cache:
            return _results_cache[synthetic_key]
        demo_df = _build_synthetic_demo_df()
        result = _process_dataframe(demo_df, cache_key=synthetic_key)
        result["summary"]["is_synthetic_demo"] = True
        result["summary"]["source_note"] = "Generated fallback dataset (no local dataset files found)."
        _results_cache[synthetic_key] = result
        _active_dataset_key = synthetic_key
        return result

    fname = files[0]
    
    # 3. Wait for the background process to finish if it's already working on it
    max_wait = 120  # Increased for full dataset processing (no sampling)
    wait_interval = 3
    for _ in range(0, max_wait, wait_interval):
        with _cache_lock:
            if fname in _results_cache:
                _active_dataset_key = fname
                return _results_cache[fname]
            if _processing_status.get(fname) != "processing":
                # Not being processed yet? Trigger it (shouldn't happen with warmup, but just in case)
                break 
        logger.info(f"⌛ Waiting for '{fname}' to finish processing...")
        await asyncio.sleep(wait_interval)

    # 4. If we reached here and it's still not ready, try to process a SMALL SAMPLE synchronously
    # this is a last-resort fallback to prevent a 504 timeout
    logger.warning(f"⚠️  Wait timeout for '{fname}'. Triggering fast-sample fallback.")
    try:
        fpath = os.path.join(DATASET_DIR, fname)
        # Optimized: Read only first 25k rows to avoid OOM on large files during fallback
        if fname.endswith('.csv'):
            df = pd.read_csv(fpath, encoding='ISO-8859-1', nrows=25000)
        else:
            df = pd.read_excel(fpath) # Excel doesn't support nrows easily
            
        df = _prepare_retail_df(df)
        original_len = 25000 # Approximation for speed
        sampled_rows = len(df)
        
        # We don't need to sample again if we already read only 25k rows
        result = _process_dataframe(df, cache_key=f"demo_{fname}")
        result['summary']['is_sampled'] = True
        result['summary']['sample_size'] = sampled_rows
        result['summary']['total_source_rows'] = "Estimated 100k+" if original_len == 25000 else original_len
        _active_dataset_key = f"demo_{fname}"
        return result
    except Exception as e:
        logger.error(f"Fallback processing failed: {e}")
        raise HTTPException(status_code=503, detail="Server is warming up. Please refresh in a minute.")


@app.post("/analyze")
async def analyze_data(file: UploadFile = File(...)):
    global _active_dataset_key
    if not file.filename.endswith(('.csv', '.xlsx')):
        raise HTTPException(status_code=400, detail="Only CSV or XLSX files are supported.")
    
    contents = await file.read()
    
    # Multi-encoding fallback for real-world files (BOM, UTF-8, Latin-1)
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
    
    # Log raw columns for debugging domain detection
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
    
    # Use a unique cache key per uploaded file to avoid stale engine conflicts
    cache_key = f"upload_{file.filename}_{int(time.time())}"
    
    try:
        result = _process_dataframe(df, cache_key=cache_key)
        # Update active dataset key
        _active_dataset_key = cache_key
        # Also store under generic "upload" key so What-If/SHAP endpoints find the latest (legacy support)
        _engine_cache["upload"] = _engine_cache.get(cache_key, {})
        return result
    except Exception as e:
        logger.error(f"Analysis failed for uploaded file '{file.filename}': {e}")
        import traceback
        traceback.print_exc()
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
    global _active_dataset_key
    # Try all cached engines
    if not _engine_cache:
        logger.warning("⚠️ Engine cache is empty (likely due to restart).")
        raise HTTPException(status_code=503, detail="Server restarted. Please re-select or re-upload the dataset to activate SHAP explainer.")
        
    # Check active dataset first
    if _active_dataset_key and _active_dataset_key in _engine_cache:
        cache = _engine_cache[_active_dataset_key]
        eng = cache['engine']
        rfm_df = cache['rfm_df']
        result = eng.compute_user_shap(user_id, rfm_df)
        if result:
            return result
            
    for key, cache in _engine_cache.items():
        if key == _active_dataset_key:
            continue
        eng = cache['engine']
        rfm_df = cache['rfm_df']
        result = eng.compute_user_shap(user_id, rfm_df)
        if result:
            return result
    raise HTTPException(status_code=404, detail=f"User '{user_id}' not found. Please ensure the dataset is fully loaded.")


# ──────────────────────────────────────
#  What-If Counterfactual Simulation
# ──────────────────────────────────────
@app.post("/whatif")
async def whatif_simulation(req: WhatIfRequest):
    """Run a what-if counterfactual simulation on a segment."""
    global _active_dataset_key
    # Use most recent engine
    if not _engine_cache or not _active_dataset_key or _active_dataset_key not in _engine_cache:
        # Fallback to last if active dataset is somehow not set
        if not _engine_cache:
            raise HTTPException(status_code=400, detail="No data loaded yet. Load data first.")
        key = list(_engine_cache.keys())[-1]
    else:
        key = _active_dataset_key
    
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
    global _active_dataset_key
    if not _engine_cache:
        await get_default_data()
    if not _engine_cache:
        raise HTTPException(status_code=503, detail="No data loaded yet. Please load a dataset first.")
    
    if _active_dataset_key and _active_dataset_key in _engine_cache:
        key = _active_dataset_key
    else:
        key = list(_engine_cache.keys())[-1]
        
    eng = _engine_cache[key]['engine']
    rfm_df = _engine_cache[key]['rfm_df']
    
    segment_stats = eng.get_segment_churn(rfm_df)
    drivers = [
        {"feature": name, "importance": float(imp)}
        for name, imp in zip(
            eng._feature_names or ['Recency', 'Frequency', 'Monetary'], 
            getattr(eng._raw_model, 'feature_importances_', getattr(eng.model, 'feature_importances_', []))
        )
    ]
    drivers.sort(key=lambda x: x['importance'], reverse=True)
    shap_data = _engine_cache[key].get('shap_data') or []
    
    hypotheses = await generate_llm_hypotheses(segment_stats, drivers, shap_data)
    return {"hypotheses": hypotheses, "source": "llm" if os.environ.get('GROQ_API_KEY') else "rule_based"}


@app.get("/interventions")
async def get_interventions():
    """Generate dynamic, data-driven interventions per segment."""
    global _active_dataset_key
    if not _engine_cache:
        raise HTTPException(status_code=400, detail="No data loaded yet.")

    if _active_dataset_key and _active_dataset_key in _engine_cache:
        key = _active_dataset_key
    else:
        key = list(_engine_cache.keys())[-1]
        
    eng = _engine_cache[key]['engine']
    rfm_df = _engine_cache[key]['rfm_df']

    segment_stats = eng.get_segment_churn(rfm_df)
    drivers = [
        {"feature": name, "importance": float(imp), "direction": "unknown"}
        for name, imp in zip(
            eng._feature_names or ['Recency', 'Frequency', 'Monetary'],
            getattr(eng._raw_model, 'feature_importances_', getattr(eng.model, 'feature_importances_', []))
        )
    ]
    drivers.sort(key=lambda x: x['importance'], reverse=True)

    interventions = await generate_llm_interventions(segment_stats, drivers)
    return {"interventions": interventions, "source": "llm" if os.environ.get('GROQ_API_KEY') else "rule_based"}


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
