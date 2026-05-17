from fastapi import APIRouter, HTTPException, Query
import pandas as pd
import os
import asyncio
import logging
import time
import numpy as np
import difflib

from services.analytics import AnalyticsEngine
from services.data_generator import set_user_pool
import state

logger = logging.getLogger(__name__)

router = APIRouter()

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
    if domain == "upi": return _prepare_upi_df(df)
    elif domain == "tax": return _prepare_tax_df(df)
    elif domain == "bank_churn": return _prepare_bank_churn_df(df)
    else: return _prepare_retail_df(df)

def _prepare_upi_df(df: pd.DataFrame) -> pd.DataFrame:
    col_lower_map = {str(c).lower().strip(): c for c in df.columns}
    rename = {}
    for candidate in ['payer_user_id', 'user_id', 'sender_vpa', 'vpa', 'upi_id', 'customer_id', 'payer_vpa']:
        if candidate in col_lower_map and 'user_id' not in rename.values():
            rename[col_lower_map[candidate]] = 'user_id'; break
    for candidate in ['ts', 'txn_date', 'timestamp', 'txn_time', 'date', 'created_at', 'time_stamp']:
        if candidate in col_lower_map and 'timestamp' not in rename.values():
            rename[col_lower_map[candidate]] = 'timestamp'; break
    for candidate in ['amount_inr', 'amount', 'txn_amount', 'transaction_amount', 'value']:
        if candidate in col_lower_map and 'amount' not in rename.values():
            rename[col_lower_map[candidate]] = 'amount'; break
    for candidate in ['payee_name', 'receiver_name', 'merchant', 'description', 'txn_type', 'remarks']:
        if candidate in col_lower_map and 'description' not in rename.values():
            rename[col_lower_map[candidate]] = 'description'; break
    for candidate in ['status', 'response_code', 'result']:
        if candidate in col_lower_map and 'status' not in rename.values():
            rename[col_lower_map[candidate]] = 'status'; break
            
    df = df.rename(columns=rename)
    if 'status' in df.columns:
        df['is_failure'] = df['status'].astype(str).str.upper().isin(['FAILURE', 'FAILED', 'ERR', '0']).astype(int)
    df['domain'] = 'upi'
    return _prepare_retail_df(df)

def _prepare_tax_df(df: pd.DataFrame) -> pd.DataFrame:
    col_lower_map = {str(c).lower().strip(): c for c in df.columns}
    rename = {}
    for candidate in ['user_id', 'pan', 'tan', 'customer_id']:
        if candidate in col_lower_map and 'user_id' not in rename.values():
            rename[col_lower_map[candidate]] = 'user_id'; break
    for candidate in ['date_of_credit', 'date_of_payment', 'timestamp', 'date', 'credit_date', 'payment_date']:
        if candidate in col_lower_map and 'timestamp' not in rename.values():
            rename[col_lower_map[candidate]] = 'timestamp'; break
    for candidate in ['gross_amount_inr', 'gross_amount', 'amount', 'income', 'taxable_income']:
        if candidate in col_lower_map and 'amount' not in rename.values():
            rename[col_lower_map[candidate]] = 'amount'; break
    for candidate in ['deductor_name', 'income_head', 'description', 'section']:
        if candidate in col_lower_map and 'description' not in rename.values():
            rename[col_lower_map[candidate]] = 'description'; break
            
    df = df.rename(columns=rename)
    if 'tds_amount_inr' in col_lower_map:
        tds_col = col_lower_map['tds_amount_inr']
        if tds_col in df.columns:
            df['tds_amount'] = pd.to_numeric(df[tds_col], errors='coerce').fillna(0)
            if 'amount' in df.columns:
                df['tds_rate'] = df['tds_amount'] / (pd.to_numeric(df['amount'], errors='coerce').fillna(1).clip(lower=1))
    if 'income_head' in col_lower_map:
        ih_col = col_lower_map['income_head']
        if ih_col in df.columns and 'user_id' in df.columns:
            income_diversity = df.groupby('user_id')[ih_col].nunique().rename('income_diversity')
            df = df.merge(income_diversity, on='user_id', how='left')
    if 'section' in col_lower_map:
        sec_col = col_lower_map['section']
        if sec_col in df.columns and 'user_id' in df.columns:
            section_count = df.groupby('user_id')[sec_col].nunique().rename('section_count')
            df = df.merge(section_count, on='user_id', how='left')
    if 'quarter' in col_lower_map:
        q_col = col_lower_map['quarter']
        if q_col in df.columns and 'user_id' in df.columns:
            quarter_activity = df.groupby('user_id')[q_col].nunique().rename('quarters_active')
            df = df.merge(quarter_activity, on='user_id', how='left')
    df['domain'] = 'tax'
    return _prepare_retail_df(df)

def _prepare_bank_churn_df(df: pd.DataFrame) -> pd.DataFrame:
    if 'Latest_Transaction_Date' in df.columns:
        df = df.copy()
        df['Latest_Transaction_Date'] = pd.to_datetime(df['Latest_Transaction_Date'])
        df['recency'] = (df['Latest_Transaction_Date'].max() - df['Latest_Transaction_Date']).dt.days
        df['frequency'] = df['Total_Transactions']
        df['monetary'] = df['Estimated_Salary'] * 0.15
        df['tenure'] = df['Tenure'].fillna(0).astype(int)
        df['ipi_consistency'] = 1.0
        return df

    col_lower_map = {str(c).lower().strip(): c for c in df.columns}
    rename = {}
    for candidate in ['customerid', 'customer_id', 'user_id', 'id']:
        if candidate in col_lower_map and 'user_id' not in rename.values():
            rename[col_lower_map[candidate]] = 'user_id'; break
    for candidate in ['exited', 'churn', 'churned', 'churn_flag', 'is_churn', 'attrition']:
        if candidate in col_lower_map and 'target_churn' not in rename.values():
            rename[col_lower_map[candidate]] = 'target_churn'; break
    for candidate in ['tenure', 'tenure_months']:
        if candidate in col_lower_map and 'tenure_months' not in rename.values():
            rename[col_lower_map[candidate]] = 'tenure_months'; break
    for candidate in ['balance']:
        if candidate in col_lower_map and 'amount' not in rename.values():
            rename[col_lower_map[candidate]] = 'amount'; break
    for candidate in ['numofproducts', 'num_of_products']:
        if candidate in col_lower_map and 'frequency' not in rename.values():
            rename[col_lower_map[candidate]] = 'frequency'; break
            
    preserve_map = {
        'creditscore': 'credit_score', 'credit_score': 'credit_score',
        'estimatedsalary': 'estimated_salary', 'estimated_salary': 'estimated_salary',
        'isactivemember': 'is_active', 'is_active_member': 'is_active',
        'hascrcard': 'has_cr_card', 'has_cr_card': 'has_cr_card',
        'age': 'age', 'geography': 'geography', 'gender': 'gender',
    }
    for lower_name, target in preserve_map.items():
        if lower_name in col_lower_map and target not in rename.values():
            orig_col = col_lower_map[lower_name]
            if orig_col not in rename:
                rename[orig_col] = target
    
    df = df.rename(columns=rename)
    for col in ['credit_score', 'estimated_salary', 'is_active', 'has_cr_card', 'age', 'amount']:
        if col in df.columns: df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    if 'amount' in df.columns and 'estimated_salary' in df.columns:
        df['amount'] = df['amount'].where(df['amount'] > 0, df['estimated_salary'] / 12).clip(lower=100)
    
    now = pd.Timestamp('2024-05-10')
    rng = np.random.default_rng(42)
    raw_tenure = pd.to_numeric(df.get('tenure_months', pd.Series([6]*len(df), index=df.index)), errors='coerce').fillna(6)
    actual_months = (raw_tenure * 12).clip(lower=6) if raw_tenure.max() <= 25 else raw_tenure.clip(lower=6)
    df['tenure_months'] = actual_months
    
    is_churned = df.get('target_churn', pd.Series([0]*len(df), index=df.index)).astype(int)
    expanded_rows = []
    for idx, row in df.iterrows():
        tenure_days = max(int(actual_months.get(idx, 6) * 30), 60)
        n_txns = rng.integers(8, 16)
        churned = int(is_churned.get(idx, 0))
        base_amount = float(row.get('amount', 100))
        for t in range(n_txns):
            new_row = row.copy()
            offset = rng.integers(tenure_days // 2, tenure_days) if churned and t >= n_txns // 2 else rng.integers(1, tenure_days)
            new_row['timestamp'] = now - pd.Timedelta(days=int(offset))
            new_row['amount'] = max(10.0, base_amount / n_txns * rng.uniform(0.5, 2.0))
            expanded_rows.append(new_row)
            
    df = pd.DataFrame(expanded_rows).reset_index(drop=True)
    df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(100)
    df['_is_summary'] = True
    df['domain'] = 'bank_churn'
    
    _saved_tenure = df['tenure_months'].copy()
    df = df.drop(columns=['tenure_months'])
    result = _prepare_retail_df(df)
    result['tenure_months'] = _saved_tenure.loc[result.index].fillna(0)
    result['tenure'] = result['tenure_months']
    return result

def _prepare_retail_df(df: pd.DataFrame) -> pd.DataFrame:
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
    already_mapped = {'user_id', 'timestamp', 'amount', 'description', 'status',
                      'target_churn', 'credit_score', 'estimated_salary', 'is_active',
                      'has_cr_card', 'age', 'tenure_months', 'frequency', 'domain',
                      'geography', 'gender', 'customer_id'}
    for col in already_mapped:
        if col in current_cols: used_candidates.add(col)
        
    for target in ['user_id', 'timestamp', 'amount']:
        if target in current_cols: continue
        variations = [target] + mapping_dictionary.get(target, [])
        for var in variations:
            match = _fuzzy_match(var, current_cols, threshold=0.95)
            if match and match not in used_candidates:
                found_mapping[match] = target
                used_candidates.add(match)
                break

    for target, variations in mapping_dictionary.items():
        if target in found_mapping.values(): continue
        if target in current_cols: continue
        all_vars = [target] + variations
        best_cand = None
        best_score = 0
        for var in all_vars:
            match = _fuzzy_match(var, current_cols, threshold=0.8)
            if match and match not in used_candidates:
                score = difflib.SequenceMatcher(None, var.lower(), match.lower()).ratio()
                if score > best_score:
                    best_score = score
                    best_cand = match
        if best_cand:
            found_mapping[best_cand] = target
            used_candidates.add(best_cand)
            
    if found_mapping:
        df = df.rename(columns=found_mapping)
        numeric_targets = ['monetary', 'unit_price', 'quantity', 'frequency', 'tenure_months', 'is_active', 'credit_score', 'monetary_velocity']
        for target in numeric_targets:
            if target in df.columns:
                df[target] = pd.to_numeric(df[target], errors='coerce').fillna(0)
        if 'monetary' in df.columns and 'amount' not in df.columns:
            df['transaction_amount'] = df['monetary']
            df['amount'] = df['monetary'].copy()
        elif 'amount' in df.columns and 'monetary' not in df.columns:
            df['monetary'] = df['amount'].copy()
        if 'user_id' in df.columns and 'customer_id' not in df.columns: df['customer_id'] = df['user_id'].copy()
        elif 'customer_id' in df.columns and 'user_id' not in df.columns: df['user_id'] = df['customer_id'].copy()

    if 'target_churn' in df.columns:
        if df['target_churn'].dtype == object or df['target_churn'].dtype == bool:
            pos_labels = ['yes', 'true', '1', 'exited', 'churned', 'churn', 'left', 'attrition', '1.0']
            df['target_churn'] = df['target_churn'].astype(str).str.lower().str.strip().isin(pos_labels).astype(int)
        else:
            df['target_churn'] = pd.to_numeric(df['target_churn'], errors='coerce').fillna(0).astype(int)

    desc_cols = ['Description', 'description', 'Product', 'product', 'ProductDescription', 'payee_name', 'merchant', 'receiver_name']
    for c in desc_cols:
        if c in df.columns and c != 'description':
            df = df.rename(columns={c: 'description'})
            break

    df = df.loc[:, ~df.columns.duplicated()]

    if 'user_id' in df.columns:
        df['user_id'] = df['user_id'].astype(str).str.strip()
        df = df[df['user_id'].str.len() > 0]
        df = df[~df['user_id'].isin(['0', 'nan', 'None', 'null'])]

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
        if df['timestamp'].notna().any(): df = df.dropna(subset=['timestamp'])
        else: df = df.drop(columns=['timestamp'])

    if 'amount' not in df.columns and 'unit_price' in df.columns and 'quantity' in df.columns:
        df['unit_price'] = pd.to_numeric(df['unit_price'], errors='coerce').fillna(0)
        df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
        df['amount'] = df['unit_price'] * df['quantity']
    elif 'amount' in df.columns:
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0)

    _is_summary_data = 'timestamp' not in df.columns and 'tenure_months' in df.columns
    if _is_summary_data:
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

    if 'Invoice' in df.columns: df = df[~df['Invoice'].astype(str).str.startswith('C', na=False)]
    if 'amount' in df.columns and not _is_summary_data: df = df[df['amount'] > 0]

    required = ['user_id', 'timestamp', 'amount']
    df = df.dropna(subset=[c for c in required if c in df.columns])
    
    if len(df) > state.MAX_ROWS:
        unique_users = df['user_id'].unique()
        keep_ratio = state.MAX_ROWS / len(df)
        num_users_to_keep = max(state.MIN_USERS_TO_KEEP, int(len(unique_users) * keep_ratio))
        rng = np.random.default_rng(seed=42)
        keep_users = rng.choice(unique_users, num_users_to_keep, replace=False)
        df = df[df['user_id'].isin(keep_users)]
        
    if 'amount' in df.columns and 'monetary' not in df.columns:
        df['monetary'] = df['amount'].copy()
        
    return df

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

    hypotheses = eng.generate_hypotheses(drivers, final_df)

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

    summary = {
        "total_users": int(final_df['user_id'].nunique()),
        "avg_churn_risk": float((final_df['churn_probability'] * final_df['monetary']).sum() / max(final_df['monetary'].sum(), 1)),
        "baseline_churn_rate": float(final_df['churn_probability'].mean()),
        "data_health": eng._calculate_data_health(df),
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
    result = _process_dataframe(combined, cache_key="all")
    state._results_cache["all"] = result
    state._active_dataset_key = "all"
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
        state._active_dataset_key = filename
        return state._results_cache[filename]
    if filename == "all": return await _analyze_all_live()
    file_path = os.path.join(state.DATASET_DIR, filename)
    if not os.path.exists(file_path): raise HTTPException(status_code=404, detail=f"Not found: {filename}")
    df = _read_file(file_path)
    df = _prepare_data_df(df)
    required = ['user_id', 'timestamp', 'amount']
    if not all(c in df.columns for c in required): raise HTTPException(status_code=400, detail=f"Missing columns. Found: {list(df.columns)}")
    result = _process_dataframe(df, cache_key=filename)
    state._results_cache[filename] = result
    state._active_dataset_key = filename
    return result

@router.get("/demo-data")
async def get_default_data():
    with state._cache_lock:
        ready_keys = [k for k, v in state._processing_status.items() if v == "ready" and k in state._results_cache]
        if ready_keys:
            ready_keys.sort(key=lambda x: 0 if 'upi' in x.lower() else 1)
            first_key = ready_keys[0]
            logger.info(f"⚡ Serving ready dataset '{first_key}' from cache")
            state._active_dataset_key = first_key
            return state._results_cache[first_key]
    files = [f for f in os.listdir(state.DATASET_DIR) if f.endswith(('.csv', '.xlsx'))]
    files.sort(key=lambda x: 0 if 'upi' in x.lower() else 1)
    if files:
        fname = files[0]
        for _ in range(2):
            with state._cache_lock:
                if fname in state._results_cache and state._processing_status.get(fname) == "ready":
                    state._active_dataset_key = fname
                    return state._results_cache[fname]
            await asyncio.sleep(1)
    synthetic_key = "synthetic_demo"
    if synthetic_key in state._results_cache:
        state._active_dataset_key = synthetic_key
        return state._results_cache[synthetic_key]
    logger.warning("⚠️ Real datasets not ready. Serving deterministic synthetic demo dataset.")
    demo_df = _build_synthetic_demo_df()
    result = _process_dataframe(demo_df, cache_key=synthetic_key)
    result["summary"]["is_synthetic_demo"] = True
    result["summary"]["source_note"] = "Serving fallback synthetic data while background engine warms up."
    with state._cache_lock: state._results_cache[synthetic_key] = result
    state._active_dataset_key = synthetic_key
    return result
