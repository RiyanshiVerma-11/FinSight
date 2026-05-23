from fastapi import APIRouter, HTTPException, Query
import pandas as pd
import os
import asyncio
import logging
import time
import numpy as np
import difflib
from concurrent.futures import ThreadPoolExecutor

from services.analytics import AnalyticsEngine
from services.data_generator import set_user_pool
import state

logger = logging.getLogger(__name__)

router = APIRouter()

# Thread pool for offloading CPU-heavy ML work (model tuning, training, SHAP)
# so the async event loop stays responsive for other requests and WebSockets.
_ml_executor = ThreadPoolExecutor(max_workers=4)

# ──────────────────────────────────────
#  Domain-aware Mapping Engines
# ──────────────────────────────────────

def _fuzzy_match(target: str, candidates: list, threshold: float = 0.8) -> str | None:
    t_norm = target.lower().replace(' ', '').replace('_', '')
    best_match = None
    best_score = 0
    for cand in candidates:
        c_norm = cand.lower().replace(' ', '').replace('_', '')
        if t_norm == c_norm:
            return cand
        score = difflib.SequenceMatcher(None, t_norm, c_norm).ratio()
        if score > best_score:
            best_score = score
            best_match = cand
        if len(t_norm) > 3 and (t_norm in c_norm or c_norm in t_norm):
            if best_score < 0.9:
                best_score = 0.9
                best_match = cand
    return best_match if best_score >= threshold else None

def _detect_domain(df: pd.DataFrame) -> str:
    cols_raw = [str(c).lower().strip() for c in df.columns]
    cols_norm = [c.replace('_', '').replace(' ', '') for c in cols_raw]
    all_sigs = set(cols_norm) | set(cols_raw)
    
    upi_sigs = [
        'txnid', 'txn_id', 'sendervpa', 'sender_vpa', 'receivervpa', 'receiver_vpa',
        'rrn', 'upiid', 'upi_id', 'vpa', 'responsecode', 'response_code',
        'payername', 'payer_name', 'payeename', 'payee_name', 'senderupiid',
        'payervpa', 'payer_vpa', 'payeevpa', 'payee_vpa', 'payeruserid',
        'payer_user_id', 'mcc', 'failurereason', 'failure_reason',
    ]
    if sum(1 for s in upi_sigs if s in all_sigs) >= 2: return "upi"
    
    tax_sigs = [
        'pan', 'fy', 'incomehead', 'income_head', 'tdsamountinr', 'tds_amount_inr',
        'deductortan', 'deductor_tan', 'section', 'grossamount', 'gross_amount',
        'dateofcredit', 'date_of_credit', 'taxableincome', 'taxable_income',
        'grossamountinr', 'gross_amount_inr', 'deductorname', 'deductor_name',
    ]
    if sum(1 for s in tax_sigs if s in all_sigs) >= 2: return "tax"
    
    churn_sigs = [
        'exited', 'creditscore', 'credit_score', 'estimatedsalary', 'estimated_salary',
        'numofproducts', 'num_of_products', 'hascrcard', 'has_cr_card',
        'isactivemember', 'is_active_member', 'tenure', 'balance', 'churnflag',
        'churn_flag', 'churn', 'churned', 'attrition',
    ]
    if sum(1 for s in churn_sigs if s in all_sigs) >= 2: return "bank_churn"
    
    retail_sigs = [
        'invoice', 'invoiceno', 'invoice_no', 'stockcode', 'stock_code',
        'invoicedate', 'invoice_date', 'customerid', 'customer_id',
        'unitprice', 'unit_price', 'quantity',
    ]
    if sum(1 for s in retail_sigs if s in all_sigs) >= 2: return "retail"
        
    return "generic"

def _prepare_data_df(df: pd.DataFrame) -> pd.DataFrame:
    domain = _detect_domain(df)
    logger.info(f"🔍 Domain detected: {domain.upper()}")
    if domain == "upi":
        return _prepare_upi_df(df)
    elif domain == "tax":
        return _prepare_tax_df(df)
    elif domain == "bank_churn":
        return _prepare_bank_churn_df(df)
    elif domain == "retail":
        return _prepare_retail_df(df)
    else:
        return _prepare_generic_df(df)

def normalize_col(c: str) -> str:
    return str(c).lower().strip().replace(' ', '').replace('_', '').replace('-', '')

# ──────────────────────────────────────
#  Domain-Specific Mapping Dictionaries
# ──────────────────────────────────────

UPI_MAPPING = {
    'user_id': ['payer_user_id', 'user_id', 'sender_vpa', 'vpa', 'upi_id', 'customer_id', 'payer_vpa'],
    'timestamp': ['ts', 'txn_date', 'timestamp', 'txn_time', 'date', 'created_at', 'time_stamp'],
    'amount': ['amount_inr', 'amount', 'txn_amount', 'transaction_amount', 'value'],
    'description': ['payee_name', 'receiver_name', 'merchant', 'description', 'txn_type', 'remarks'],
    'status': ['status', 'response_code', 'result', 'txn_status', 'transaction_status']
}

TAX_MAPPING = {
    'user_id': ['user_id', 'pan', 'tan', 'customer_id'],
    'timestamp': ['date_of_credit', 'date_of_payment', 'timestamp', 'date', 'credit_date', 'payment_date'],
    'amount': ['gross_amount_inr', 'gross_amount', 'amount', 'income', 'taxable_income'],
    'description': ['deductor_name', 'income_head', 'description', 'section']
}

BANK_CHURN_MAPPING = {
    'user_id': ['customerid', 'customer_id', 'user_id', 'id'],
    'target_churn': ['exited', 'churn', 'churned', 'churn_flag', 'is_churn', 'attrition'],
    'credit_score': ['creditscore', 'credit_score'],
    'estimated_salary': ['estimatedsalary', 'estimated_salary'],
    'is_active': ['isactivemember', 'is_active_member'],
    'has_cr_card': ['hascrcard', 'has_cr_card'],
    'age': ['age'],
    'geography': ['geography'],
    'gender': ['gender'],
    'tenure_months': ['tenure', 'tenure_months'],
    'frequency': ['numofproducts', 'num_of_products', 'products', 'total_transactions'],
    'monetary': ['balance', 'monetary', 'amount']
}

RETAIL_MAPPING = {
    'user_id': ['userid', 'customerid', 'clientid', 'customer_id'],
    'timestamp': ['InvoiceDate', 'Date', 'timestamp', 'time', 'Order Date', 'date', 'Invoice Date'],
    'amount': ['Price', 'Total', 'Amount', 'revenue', 'sum', 'amount', 'Total Price', 'TotalPrice'],
    'unit_price': ['Price', 'UnitPrice', 'Unit Price', 'price', 'unit_price', 'rate'],
    'quantity': ['Quantity', 'Qty', 'quantity', 'count', 'units'],
    'description': ['Description', 'description', 'Product', 'product', 'ProductDescription']
}

GENERIC_MAPPING = {
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

def _map_domain_columns(df: pd.DataFrame, mapping_dict: dict) -> pd.DataFrame:
    df = df.copy()
    current_cols = list(df.columns)
    found_mapping = {}
    used_raw_cols = set()
    
    col_norm_map = {normalize_col(c): c for c in current_cols}
    
    # Priority 1: Core fields (user_id, timestamp, amount)
    core_fields = ['user_id', 'timestamp', 'amount']
    for target in core_fields:
        if target in mapping_dict:
            candidates = mapping_dict[target]
            matched = False
            for cand in [target] + candidates:
                cand_norm = normalize_col(cand)
                if cand_norm in col_norm_map:
                    raw_col = col_norm_map[cand_norm]
                    if raw_col not in used_raw_cols:
                        found_mapping[raw_col] = target
                        used_raw_cols.add(raw_col)
                        matched = True
                        break
            if not matched:
                for cand in [target] + candidates:
                    match = _fuzzy_match(cand, [c for c in current_cols if c not in used_raw_cols], threshold=0.95)
                    if match:
                        found_mapping[match] = target
                        used_raw_cols.add(match)
                        break
                        
    # Priority 2: Other fields
    for target, candidates in mapping_dict.items():
        if target in core_fields:
            continue
        matched = False
        for cand in candidates:
            cand_norm = normalize_col(cand)
            if cand_norm in col_norm_map:
                raw_col = col_norm_map[cand_norm]
                if raw_col not in used_raw_cols:
                    found_mapping[raw_col] = target
                    used_raw_cols.add(raw_col)
                    matched = True
                    break
        if not matched:
            for cand in candidates:
                match = _fuzzy_match(cand, [c for c in current_cols if c not in used_raw_cols], threshold=0.8)
                if match:
                    found_mapping[match] = target
                    used_raw_cols.add(match)
                    break
                    
    # Rename columns based on mapping
    df = df.rename(columns={k: v for k, v in found_mapping.items() if k != v})
    # Store column mapping in attrs and custom property
    df.attrs['column_mapping'] = found_mapping
    df._column_mapping = found_mapping
    return df

def _clean_and_post_process_df(df: pd.DataFrame, domain: str) -> pd.DataFrame:
    # 1. Standardize types and fill NaNs for numeric targets
    numeric_targets = ['monetary', 'unit_price', 'quantity', 'frequency', 'tenure_months', 'is_active', 'credit_score', 'monetary_velocity', 'estimated_salary']
    for target in numeric_targets:
        if target in df.columns:
            df[target] = pd.to_numeric(df[target], errors='coerce').fillna(0)
            
    # 2. Align monetary and amount
    if 'monetary' in df.columns and 'amount' not in df.columns:
        df['transaction_amount'] = df['monetary']
        df['amount'] = df['monetary'].copy()
    elif 'amount' in df.columns and 'monetary' not in df.columns:
        df['monetary'] = df['amount'].copy()
        
    # 3. Align user_id and customer_id
    if 'user_id' in df.columns and 'customer_id' not in df.columns:
        df['customer_id'] = df['user_id'].copy()
    elif 'customer_id' in df.columns and 'user_id' not in df.columns:
        df['user_id'] = df['customer_id'].copy()
        
    # 4. Standardize target_churn
    if 'target_churn' in df.columns:
        if df['target_churn'].dtype == object or df['target_churn'].dtype == bool:
            pos_labels = ['yes', 'true', '1', 'exited', 'churned', 'churn', 'left', 'attrition', '1.0']
            df['target_churn'] = df['target_churn'].astype(str).str.lower().str.strip().isin(pos_labels).astype(int)
        else:
            df['target_churn'] = pd.to_numeric(df['target_churn'], errors='coerce').fillna(0).astype(int)
            
    # 5. Fallback description mapping (strictly avoided for bank_churn)
    if domain != 'bank_churn':
        desc_cols = ['Description', 'description', 'Product', 'product', 'ProductDescription', 'payee_name', 'merchant', 'receiver_name']
        for c in desc_cols:
            if c in df.columns and c != 'description':
                df = df.rename(columns={c: 'description'})
                break
                
    # 6. Deduplicate columns
    df = df.loc[:, ~df.columns.duplicated()]
    
    # 7. Clean user_id
    if 'user_id' in df.columns:
        df['user_id'] = df['user_id'].astype(str).str.strip()
        df = df[df['user_id'].str.len() > 0]
        df = df[~df['user_id'].isin(['0', 'nan', 'None', 'null'])]
        
    # 8. Standardize timestamp
    if 'timestamp' in df.columns:
        try:
            df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
            if df['timestamp'].isna().mean() > 0.5:
                numeric_ts = pd.to_numeric(df['timestamp'], errors='coerce')
                if not numeric_ts.isna().all():
                    max_val = numeric_ts.max()
                    unit = 'ms' if max_val > 1e11 else 's'
                    df['timestamp'] = pd.to_datetime(numeric_ts, unit=unit, errors='coerce')
        except Exception as e:
            logger.warning(f"Datetime conversion fallback: {e}")
            df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        if df['timestamp'].notna().any():
            df = df.dropna(subset=['timestamp'])
        else:
            df = df.drop(columns=['timestamp'])
            
    # 9. Handle unit_price / quantity fallback for amount
    if 'amount' not in df.columns and 'unit_price' in df.columns and 'quantity' in df.columns:
        df['unit_price'] = pd.to_numeric(df['unit_price'], errors='coerce').fillna(0)
        df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
        df['amount'] = df['unit_price'] * df['quantity']
    elif 'amount' in df.columns:
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0)
        
    # 10. Summary expansion logic
    _is_summary_data = ('timestamp' not in df.columns and 'tenure_months' in df.columns) or ('_is_summary' in df.columns and bool(df['_is_summary'].any()))
    if _is_summary_data and not ('_is_summary' in df.columns and bool(df['_is_summary'].any())):
        now = pd.Timestamp('2024-05-10')
        raw_tenure = pd.to_numeric(df['tenure_months'], errors='coerce').fillna(1)
        actual_months = (raw_tenure * 12).clip(lower=6) if raw_tenure.max() <= 25 else raw_tenure.clip(lower=6)
        df['tenure_months'] = actual_months
        if 'amount' not in df.columns:
            balance = pd.to_numeric(df.get('monetary', pd.Series(dtype=float)), errors='coerce').fillna(0)
            salary = pd.to_numeric(df.get('monetary_velocity', pd.Series(dtype=float)), errors='coerce').fillna(0)
            df['amount'] = balance.where(balance > 0, salary / 12).clip(lower=100)
        freq_col = df.get('frequency', pd.Series([1]*len(df), index=df.index))
        freq_vals = pd.to_numeric(freq_col, errors='coerce').fillna(1).clip(lower=1, upper=10).astype(int)
        
        expanded_rows = []
        for idx, row in df.iterrows():
            n_txns = int(freq_vals.get(idx, 1))
            tenure_days = max(int(actual_months.get(idx, 6) * 30), 30)
            for t in range(n_txns):
                new_row = row.copy()
                offset = int(tenure_days * (t + 1) / (n_txns + 1))
                new_row['timestamp'] = now - pd.Timedelta(days=offset)
                new_row['amount'] = float(row['amount']) / max(n_txns, 1)
                expanded_rows.append(new_row)
        df = pd.DataFrame(expanded_rows)
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(100)
        df['_is_summary'] = True
        
    # 11. Invoice Cancellation filter
    if 'Invoice' in df.columns:
        df = df[~df['Invoice'].astype(str).str.startswith('C', na=False)]
        
    # 12. Non-positive amount filtering
    if 'amount' in df.columns and not _is_summary_data:
        df = df[df['amount'] > 0]
        
    # 13. Drop rows missing key fields
    required = ['user_id', 'timestamp', 'amount']
    df = df.dropna(subset=[c for c in required if c in df.columns])
    
    # 14. Row limit sampling
    if len(df) > state.MAX_ROWS:
        unique_users = df['user_id'].unique()
        keep_ratio = state.MAX_ROWS / len(df)
        num_users_to_keep = max(state.MIN_USERS_TO_KEEP, int(len(unique_users) * keep_ratio))
        rng = np.random.default_rng(seed=42)
        keep_users = rng.choice(unique_users, num_users_to_keep, replace=False)
        df = df[df['user_id'].isin(keep_users)]
        
    # 15. Final monetary alignment
    if 'amount' in df.columns and 'monetary' not in df.columns:
        df['monetary'] = df['amount'].copy()
        
    return df

def _prepare_upi_df(df: pd.DataFrame) -> pd.DataFrame:
    df = _map_domain_columns(df, UPI_MAPPING)
    if 'status' in df.columns:
        df['is_failure'] = df['status'].astype(str).str.upper().isin(['FAILURE', 'FAILED', 'ERR', '0']).astype(int)
    df['domain'] = 'upi'
    return _clean_and_post_process_df(df, 'upi')

def _prepare_tax_df(df: pd.DataFrame) -> pd.DataFrame:
    col_norm_map = {normalize_col(c): c for c in df.columns}
    
    # Identify user_id column first (e.g. pan, customer_id, user_id)
    user_col = None
    for cand in ['user_id', 'pan', 'tan', 'customer_id']:
        cand_norm = normalize_col(cand)
        if cand_norm in col_norm_map:
            user_col = col_norm_map[cand_norm]
            break

    # Calculate tax diversity/count features using the original user column name BEFORE renaming/merging
    if user_col:
        ih_col = col_norm_map.get(normalize_col('income_head'))
        if ih_col and ih_col in df.columns:
            income_diversity = df.groupby(user_col)[ih_col].nunique().rename('income_diversity')
            df = df.merge(income_diversity, on=user_col, how='left')
            
        sec_col = col_norm_map.get(normalize_col('section'))
        if sec_col and sec_col in df.columns:
            section_count = df.groupby(user_col)[sec_col].nunique().rename('section_count')
            df = df.merge(section_count, on=user_col, how='left')
            
        q_col = col_norm_map.get(normalize_col('quarter'))
        if q_col and q_col in df.columns:
            quarter_activity = df.groupby(user_col)[q_col].nunique().rename('quarters_active')
            df = df.merge(quarter_activity, on=user_col, how='left')

    df = _map_domain_columns(df, TAX_MAPPING)
    
    # Calculate TDS rate using the normalized amount column
    tds_col = col_norm_map.get(normalize_col('tds_amount_inr'))
    if tds_col and tds_col in df.columns:
        df['tds_amount'] = pd.to_numeric(df[tds_col], errors='coerce').fillna(0)
        if 'amount' in df.columns:
            df['tds_rate'] = df['tds_amount'] / (pd.to_numeric(df['amount'], errors='coerce').fillna(1).clip(lower=1))
            
    df['domain'] = 'tax'
    return _clean_and_post_process_df(df, 'tax')

def _prepare_bank_churn_df(df: pd.DataFrame) -> pd.DataFrame:
    col_norm_map = {normalize_col(c): c for c in df.columns}
    
    # 1. Map columns using BANK_CHURN_MAPPING
    df = _map_domain_columns(df, BANK_CHURN_MAPPING)
    
    # Convert tenure (years) to months if raw max is low (<= 25)
    if 'tenure_months' in df.columns:
        raw_tenure = pd.to_numeric(df['tenure_months'], errors='coerce').fillna(6.0).astype(float)
        if raw_tenure.max() <= 25:
            df['tenure_months'] = raw_tenure * 12.0
        else:
            df['tenure_months'] = raw_tenure
    
    # 2. Standardize types and fill NaNs for key numeric columns
    for col in ['credit_score', 'estimated_salary', 'is_active', 'has_cr_card', 'age']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
            
    # 3. Compute recency & timestamp
    now = pd.Timestamp('2024-05-10')
    date_col = None
    for cand in ['latest_transaction_date', 'latest_transaction', 'last_transaction_date', 'transaction_date']:
        cand_norm = normalize_col(cand)
        if cand_norm in col_norm_map:
            date_col = col_norm_map[cand_norm]
            break
            
    if date_col:
        df['Latest_Transaction_Date'] = pd.to_datetime(df[date_col], errors='coerce')
        max_date = df['Latest_Transaction_Date'].max()
        if pd.isnull(max_date):
            max_date = now
        df['recency'] = (max_date - df['Latest_Transaction_Date']).dt.days.fillna(30.0).astype(float)
        df['timestamp'] = df['Latest_Transaction_Date'].fillna(now)
    else:
        # Fallback to tenure * 30 or default 180
        if 'tenure_months' in df.columns:
            tenure_val = pd.to_numeric(df['tenure_months'], errors='coerce').fillna(72.0).astype(float)
            df['recency'] = tenure_val * 30.0
        else:
            df['recency'] = 180.0
        df['timestamp'] = now - pd.to_timedelta(df['recency'], unit='D')
        
    # 4. Compute frequency
    if 'frequency' in df.columns:
        df['frequency'] = pd.to_numeric(df['frequency'], errors='coerce').fillna(1.0).astype(float)
    else:
        df['frequency'] = 2.0
        
    # 5. Compute monetary & amount
    if 'monetary' in df.columns:
        df['monetary'] = pd.to_numeric(df['monetary'], errors='coerce').fillna(100.0).astype(float)
    else:
        df['monetary'] = 500.0
    df['amount'] = df['monetary']
    
    # 6. Compute tenure & tenure_months
    if 'tenure_months' in df.columns:
        df['tenure'] = pd.to_numeric(df['tenure_months'], errors='coerce').fillna(72.0).astype(float)
        df['tenure_months'] = df['tenure']
    else:
        df['tenure'] = 72.0
        df['tenure_months'] = 72.0
        
    df['_is_summary'] = True
    df['domain'] = 'bank_churn'
    
    result = _clean_and_post_process_df(df, 'bank_churn')
    result['_is_summary'] = True
    result['tenure'] = result.get('tenure_months', 72.0)
    return result

def _prepare_retail_df(df: pd.DataFrame) -> pd.DataFrame:
    df = _map_domain_columns(df, RETAIL_MAPPING)
    df['domain'] = 'retail'
    return _clean_and_post_process_df(df, 'retail')

def _prepare_generic_df(df: pd.DataFrame) -> pd.DataFrame:
    df = _map_domain_columns(df, GENERIC_MAPPING)
    df['domain'] = 'generic'
    return _clean_and_post_process_df(df, 'generic')

def _process_dataframe(df: pd.DataFrame, cache_key: str = "_default") -> dict:
    eng = AnalyticsEngine()
    rfm_results, silhouette = eng.calculate_rfm(df)
    model_id = cache_key if cache_key != "_default" else None
    churn_results, drivers, metrics, shap_data = eng.predict_churn(df, rfm_results, model_id=model_id)
    lifecycle = eng.get_lifecycle_stages(df)
    segment_churn = eng.get_segment_churn(churn_results)
    product_mix = eng.analyze_product_mix(df, churn_results)
    
    try: cohort_data = eng.build_cohort_matrix(df)
    except Exception as e:
        logger.error(f"Cohort analysis error: {e}")
        cohort_data = []

    revenue_at_risk = eng.get_revenue_at_risk(churn_results)
    potential_recovery = eng.get_potential_recovery(churn_results, metrics)

    churn_results = churn_results.loc[:, ~churn_results.columns.duplicated()]
    lifecycle = lifecycle.loc[:, ~lifecycle.columns.duplicated()]
    overlap = [c for c in lifecycle.columns if c in churn_results.columns and c != 'user_id']
    if overlap: lifecycle = lifecycle.drop(columns=overlap)
    
    final_df = churn_results.merge(lifecycle, on='user_id', how='left')
    final_df = final_df.loc[:, ~final_df.columns.duplicated()]

    hypotheses = eng.generate_hypotheses(drivers, final_df, metrics)

    try: forecast_data = eng.compute_churn_forecast(final_df, cohort_data, metrics)
    except Exception as e:
        logger.error(f"Forecast computation error: {e}")
        forecast_data = []

    if 'segment' in final_df.columns:
        segment_series = final_df['segment']
        if isinstance(segment_series, pd.DataFrame): segment_series = segment_series.iloc[:, 0]
        segments_dict = segment_series.value_counts().to_dict()
    else: segments_dict = {}

    best_model = metrics.get('primary_model', 'Random Forest')

    column_mapping = getattr(df, '_column_mapping', getattr(df, 'attrs', {}).get('column_mapping', {}))
    clean_mapping = {str(k): str(v) for k, v in column_mapping.items()} if column_mapping else {}

    summary = {
        "total_users": int(final_df['user_id'].nunique()),
        "avg_churn_risk": float((final_df['churn_probability'] * final_df['monetary']).sum() / max(final_df['monetary'].sum(), 1)),
        "baseline_churn_rate": float(final_df['churn_probability'].mean()),
        "data_health": eng._calculate_data_health(df),
        "is_summary_data": bool('_is_summary' in df.columns and df['_is_summary'].any()),
        "column_mapping": clean_mapping,
        "segments": segments_dict,
        "lifecycle_stages": final_df['lifecycle'].value_counts().to_dict(),
        "top_drivers": drivers,
        "hypotheses": hypotheses,
        "metrics": {
        "silhouette_score": float(silhouette),
            # ── Calibrated Risk Thresholds ──
            # The model's optimal_threshold is tuned on the test split for F1/balanced accuracy.
            # For population-level UI segmentation we anchor to the actual baseline churn rate
            # so that "High Risk" and "Critical" thresholds are meaningful percentiles.
            #   High Risk    = above 1.5× baseline (top ~25% of risky users)
            #   Critical     = above 2.0× baseline (top ~10%)
            # When baseline > 35% we fall back to raw optimal_threshold.
            "total_high_risk_users": int(len(final_df[final_df['churn_probability'] >= float(final_df['churn_probability'].quantile(0.75))])),
            "onboarding_risk_users": int(len(final_df[
                (final_df['lifecycle'] == 'New') &
                (final_df['churn_probability'] >= float(final_df['churn_probability'].quantile(0.75)))
            ])),
            "critical_threshold_users": int(len(final_df[final_df['churn_probability'] >= float(final_df['churn_probability'].quantile(0.90))])),
            **metrics,
        },
        "shap_data": shap_data,
        "segment_churn": segment_churn,
        "product_mix": product_mix,
        "cohort_data": cohort_data,
        "revenue_at_risk": revenue_at_risk,
        "potential_recovery": potential_recovery,
        "forecast": forecast_data,
        "domain": eng._domain or "generic",
        "model_info": {
            "name": best_model,
            "n_estimators": getattr(eng._raw_model, 'n_estimators', 100),
            "features_used": eng._feature_names,
            "optimal_threshold": metrics.get('optimal_threshold', 0.5),
        },
    }

    new_users = final_df[final_df['lifecycle'] == 'New']
    other_users = final_df[final_df['lifecycle'] != 'New'].sort_values('churn_probability', ascending=False)
    combined_sample = pd.concat([new_users, other_users]).head(1000)
    user_data = combined_sample.to_dict(orient='records')

    with state._cache_lock:
        state._engine_cache[cache_key] = {'engine': eng, 'rfm_df': churn_results, 'shap_data': shap_data}

    try: set_user_pool(final_df['user_id'].tolist())
    except Exception as e: logger.warning(f"Could not update LiveTicker pool: {e}")

    return {"summary": summary, "users": user_data}

def _build_synthetic_demo_df(n_users: int = 500, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    base = pd.Timestamp("2024-01-01")
    rows = []
    for uid in range(1, n_users + 1):
        is_loyal = (uid % 5 != 0)
        n_tx = int(rng.integers(10, 40)) if is_loyal else int(rng.integers(2, 8))
        for _ in range(n_tx):
            days_ago = int(rng.integers(0, 90)) if is_loyal else int(rng.integers(90, 365))
            amount = round(float(rng.uniform(10, 5000)), 2)
            rows.append({
                "user_id": str(uid),
                "timestamp": (base + pd.Timedelta(days=days_ago)).strftime("%Y-%m-%d"),
                "amount": amount,
                "description": rng.choice(["purchase", "transfer", "topup", "withdrawal"]),
            })
    df = pd.DataFrame(rows)
    return df.dropna(subset=["timestamp"])

def _read_file(path: str) -> pd.DataFrame:
    if path.endswith('.csv'):
        nrows = 200000 if state.IS_CLOUD else None
        for enc in ['utf-8-sig', 'utf-8', 'ISO-8859-1']:
            try: return pd.read_csv(path, encoding=enc, sep=None, engine='python', nrows=nrows)
            except Exception: continue
        raise ValueError(f"Could not read CSV '{path}' with any encoding.")
    elif path.endswith('.xlsx'): return pd.read_excel(path)
    raise ValueError(f"Unsupported format: {path}")

async def _analyze_all_live():
    if not os.path.exists(state.DATASET_DIR): raise HTTPException(status_code=404, detail="Datasets directory not found")
    files = [f for f in os.listdir(state.DATASET_DIR) if f.endswith(('.csv', '.xlsx'))]
    if not files: raise HTTPException(status_code=404, detail="No datasets found")
    all_dfs = []
    for f in files:
        df = _read_file(os.path.join(state.DATASET_DIR, f))
        df = _prepare_data_df(df)
        all_dfs.append(df)
    combined = pd.concat(all_dfs, ignore_index=True)
    dedupe_candidates = ['user_id', 'timestamp', 'amount']
    if 'Invoice' in combined.columns: dedupe_candidates.insert(0, 'Invoice')
    if 'StockCode' in combined.columns: dedupe_candidates.append('StockCode')
    existing_keys = [c for c in dedupe_candidates if c in combined.columns]
    if existing_keys: combined = combined.drop_duplicates(subset=existing_keys)
    result = await asyncio.get_running_loop().run_in_executor(
        _ml_executor, _process_dataframe, combined, "all"
    )
    state._results_cache["all"] = result
    state.set_active_key("all")
    return result

# ──────────────────────────────────────
#  Router Endpoints
# ──────────────────────────────────────

@router.get("/list-datasets")
async def list_datasets():
    if not os.path.exists(state.DATASET_DIR):
        os.makedirs(state.DATASET_DIR, exist_ok=True)
        return {"datasets": []}
    files = [f for f in os.listdir(state.DATASET_DIR) if f.endswith(('.csv', '.xlsx'))]
    return {"datasets": files}

@router.get("/analyze-local")
async def analyze_local(filename: str = Query(...)):
    if filename in state._results_cache:
        logger.info(f"⚡ Serving '{filename}' from cache")
        state.set_active_key(filename)
        return state._results_cache[filename]
    if filename == "all": return await _analyze_all_live()
    file_path = os.path.join(state.DATASET_DIR, filename)
    if not os.path.exists(file_path): raise HTTPException(status_code=404, detail=f"Not found: {filename}")
    df = _read_file(file_path)
    df = _prepare_data_df(df)
    required = ['user_id', 'timestamp', 'amount']
    if not all(c in df.columns for c in required): raise HTTPException(status_code=400, detail=f"Missing columns. Found: {list(df.columns)}")
    result = await asyncio.get_running_loop().run_in_executor(
        _ml_executor, _process_dataframe, df, filename
    )
    state._results_cache[filename] = result
    state.set_active_key(filename)
    return result

@router.get("/demo-data")
async def get_default_data():
    with state._cache_lock:
        ready_keys = [k for k, v in state._processing_status.items() if v == "ready" and k in state._results_cache]
        if ready_keys:
            ready_keys.sort(key=lambda x: 0 if 'upi' in x.lower() else 1)
            first_key = ready_keys[0]
            logger.info(f"⚡ Serving ready dataset '{first_key}' from cache")
            state.set_active_key(first_key)
            return state._results_cache[first_key]
    files = [f for f in os.listdir(state.DATASET_DIR) if f.endswith(('.csv', '.xlsx'))]
    files.sort(key=lambda x: 0 if 'upi' in x.lower() else 1)
    if files:
        fname = files[0]
        for _ in range(2):
            with state._cache_lock:
                if fname in state._results_cache and state._processing_status.get(fname) == "ready":
                    state.set_active_key(fname)
                    return state._results_cache[fname]
            await asyncio.sleep(1)
    synthetic_key = "synthetic_demo"
    if synthetic_key in state._results_cache:
        state.set_active_key(synthetic_key)
        return state._results_cache[synthetic_key]
    logger.warning("⚠️ Real datasets not ready. Serving deterministic synthetic demo dataset.")
    demo_df = _build_synthetic_demo_df()
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(_ml_executor, _process_dataframe, demo_df, synthetic_key)
    result["summary"]["is_synthetic_demo"] = True
    result["summary"]["source_note"] = "Serving fallback synthetic data while background engine warms up."
    with state._cache_lock: state._results_cache[synthetic_key] = result
    state.set_active_key(synthetic_key)
    return result
