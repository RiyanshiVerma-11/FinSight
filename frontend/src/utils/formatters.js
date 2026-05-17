export const formatCurrency = (val) => {
  try {
    if (val === undefined || val === null) return '₹0';
    let num;
    if (typeof val === 'object' && val !== null) {
      num = Number(val.value ?? val.amount ?? val.total ?? 0);
    } else {
      num = Number(val);
    }
    if (isNaN(num) || !isFinite(num)) return '₹0';
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  } catch (e) {
    return '₹0';
  }
};

export const formatMetricPct = (val) => {
  if (val === undefined || val === null) return '0%';
  const num = Number(val);
  return isNaN(num) ? '0%' : `${(num * 100).toFixed(1)}%`;
};

export const getRiskThresholds = (s) => {
  // The model's optimal_threshold is calibrated on the test split and can be very low
  // (e.g. 0.03) when overall churn rates are low, which causes ALL users to appear as
  // "High Risk". We instead anchor to the population's baseline (mean) churn rate so
  // thresholds are meaningful relative to the actual user distribution.
  const rawThreshold = s?.metrics?.optimal_threshold ?? 0.5;
  const baseline = s?.baseline_churn_rate ?? s?.avg_churn_risk ?? rawThreshold;

  // "High Risk" = users materially above the population average (1.5× baseline).
  // "Critical"  = users at double the population average (2× baseline).
  // If baseline itself is high (>0.35), fall back to raw threshold logic.
  let high, critical;
  if (baseline > 0 && baseline <= 0.35) {
    high = Math.min(baseline * 1.5, 0.9);
    critical = Math.min(baseline * 2.0, 0.95);
  } else {
    high = rawThreshold;
    critical = Math.min(rawThreshold + 0.2, 0.95);
  }

  return { high, critical };
};

export const segmentToPersona = (seg) => {
  const personas = {
    'Champions': 'The Loyal Giant',
    'Loyalists': 'The Steady Pillar',
    'Promising': 'The Rising Star',
    'At Risk': 'The Fading Star',
    'Hibernating': 'The Lost Soul',
    'Needs Attention': 'The Drifting User',
    'New': 'Onboarding'
  };
  return personas[seg] || seg;
};

export const getPersona = (u) => {
  if (!u) return '';
  return segmentToPersona(u.segment);
};

export const retentionColor = (val) => {
  if (val >= 80) return '#dcfce7';
  if (val >= 60) return '#bbf7d0';
  if (val >= 40) return '#fef9c3';
  if (val >= 20) return '#fed7aa';
  if (val > 0) return '#fecaca';
  return '#f1f5f9';
};

export const getROIStatus = (u) => {
  if (!u) return { status: 'N/A', cost: 0, color: '#94a3b8', bg: 'transparent' };

  // Real ROI logic: Use centralized backend LTV and Cost
  const isProfitable = u.is_profitable !== undefined ? u.is_profitable : (u.predicted_ltv > (u.monetary + (u.intervention_cost || 15)));
  const cost = u.intervention_cost || 15;

  if (isProfitable) {
    return { status: 'Profitable', cost, color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
  }
  return { status: 'At Risk / Non-Profitable', cost, color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' };
};
