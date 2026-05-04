"""
Real-Time Data Stream Simulator.
Generates synthetic fintech events (transactions, logins, failures) 
to demonstrate live ingestion and real-time churn recalculation.
"""
import random
import time
import uuid
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)

# Simulated user pool
_USER_POOL = [f"USR_{i:03d}" for i in range(200)]
_PRODUCTS = ['Premium Plan', 'Basic Plan', 'Add-on Pack', 'Enterprise', 'Wallet Top-up', 'Bill Pay', 'Investment', 'Insurance']

EVENT_TYPES = {
    'transaction': {'weight': 0.40, 'has_amount': True},
    'login': {'weight': 0.25, 'has_amount': False},
    'logout': {'weight': 0.15, 'has_amount': False},
    'transaction_fail': {'weight': 0.12, 'has_amount': True},
    'support_ticket': {'weight': 0.05, 'has_amount': False},
    'plan_downgrade': {'weight': 0.03, 'has_amount': False},
}

# Pre-assign risk profiles to users
_USER_PROFILES = {}
for uid in _USER_POOL:
    _USER_PROFILES[uid] = {
        'risk_level': random.choice(['low', 'low', 'medium', 'medium', 'high']),
        'avg_amount': random.uniform(20, 500),
        'fail_rate': random.uniform(0.02, 0.25),
    }


def generate_event():
    """Generate a single synthetic fintech event."""
    user_id = random.choice(_USER_POOL)
    profile = _USER_PROFILES[user_id]

    # Weighted event type selection — high-risk users get more failures
    weights = []
    types = []
    for etype, config in EVENT_TYPES.items():
        w = config['weight']
        if etype == 'transaction_fail' and profile['risk_level'] == 'high':
            w *= 3
        if etype == 'plan_downgrade' and profile['risk_level'] == 'high':
            w *= 4
        weights.append(w)
        types.append(etype)

    event_type = random.choices(types, weights=weights, k=1)[0]

    event = {
        'event_id': str(uuid.uuid4())[:8],
        'user_id': user_id,
        'event_type': event_type,
        'timestamp': datetime.now().isoformat(),
        'status': 'success',
    }

    if EVENT_TYPES[event_type]['has_amount']:
        base = profile['avg_amount']
        event['amount'] = round(random.gauss(base, base * 0.3), 2)
        if event['amount'] < 0:
            event['amount'] = round(abs(event['amount']), 2)
    else:
        event['amount'] = None

    if event_type == 'transaction_fail':
        event['status'] = 'failed'
        # Simulate churn impact
        event['churn_delta'] = round(random.uniform(0.01, 0.05), 3)
    elif event_type == 'plan_downgrade':
        event['status'] = 'downgrade'
        event['churn_delta'] = round(random.uniform(0.03, 0.08), 3)
    elif event_type == 'transaction':
        event['churn_delta'] = round(random.uniform(-0.02, -0.005), 3)
    else:
        event['churn_delta'] = 0.0

    event['product'] = random.choice(_PRODUCTS)
    event['risk_level'] = profile['risk_level']

    return event


def generate_batch(n=5):
    """Generate a batch of events."""
    return [generate_event() for _ in range(n)]
