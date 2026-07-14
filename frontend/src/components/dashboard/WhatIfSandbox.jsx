import React, { useState } from 'react';
import axios from 'axios';
import confetti from 'canvas-confetti';
import {
  Sliders, Play, DollarSign, TrendingDown, Users, ArrowRight,
  Zap, Gift, Bell, Smartphone, Tag, Trophy, FlaskConical, Info, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FormulaTooltip from '../ui/FormulaTooltip';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const PERSONA_DEFINITIONS = {
  'Champions': {
    label: 'The Loyal Giant',
    description: 'Power users with the highest frequency and spend.',
    upi: 'Frequent daily transactions with high wallet share. These are your most valuable users who use UPI for everything.',
    tax: 'High-income individuals with complex, multi-section filings. High LTV but sensitive to service quality.',
    retail: 'Big spenders who shop weekly and have the highest average order value.',
    bank_churn: 'High-net-worth individuals with multiple active products (Savings, Credit, Loan). High balance stability.'
  },
  'Loyalists': {
    label: 'The Steady Pillar',
    description: 'Consistent, regular users who are the backbone of your revenue.',
    upi: 'Regular users who use UPI for routine daily/weekly payments. Reliable and predictable.',
    tax: 'Consistent salaried filers who return every season. Low maintenance and high retention.',
    retail: 'Repeat customers with a steady purchase cadence. They trust the brand but are price-conscious.',
    bank_churn: 'Long-tenure customers with steady salary deposits and consistent card usage. High reliability.'
  },
  'Promising': {
    label: 'The Rising Star',
    description: 'New or growing users showing strong signals of becoming loyalists.',
    upi: 'Newer users who are rapidly increasing their transaction count. Great potential for wallet-share growth.',
    tax: 'Recent users who have just started exploring premium filing services.',
    retail: 'Recent first-time buyers who have returned for a second purchase within a short window.',
    bank_churn: 'New account holders with rapidly increasing balances or recently added secondary products.'
  },
  'At Risk': {
    label: 'The Fading Star',
    description: 'Previously loyal users whose activity has recently dropped. High churn risk.',
    upi: 'Users who used to be active but haven\'t made a transaction in 7-14 days. Switching risk is high.',
    tax: 'Previous filers who haven\'t logged in as the deadline approaches. Potential loss of premium revenue.',
    retail: 'Frequent shoppers who haven\'t placed an order in over 30 days. Likely exploring competitors.',
    bank_churn: 'Customers with significant balance depletion or those who have recently cancelled credit cards/SIPs.'
  },
  'Hibernating': {
    label: 'The Lost Soul',
    description: 'Inactive users with very low activity. Requires major re-engagement.',
    upi: 'Dormant users who have nearly abandoned the wallet. Needs a big incentive to return.',
    tax: 'Historical users who haven\'t filed through the platform in the last 2 cycles.',
    retail: 'One-time shoppers from over 6 months ago. Low probability of return without major push.',
    bank_churn: 'Minimum balance accounts with no transactions for 90+ days. Likely already using another primary bank.'
  },
  'Needs Attention': {
    label: 'The Drifting User',
    description: 'Users with irregular usage patterns and inconsistent engagement.',
    upi: 'Occasional users with high transaction failure rates or low balance issues.',
    tax: 'Users who started their tax filing but stopped halfway. Likely facing UX friction.',
    retail: 'Users who browse frequently and add to cart but rarely complete the checkout.',
    bank_churn: 'Customers with declining credit scores or those showing erratic spending patterns.'
  },
  'New': {
    label: 'The Fresh Face',
    description: 'Recently acquired users exploring the platform. High potential for loyalty.',
    upi: 'Newly registered users making their first few UPI transactions. Needs habit formation.',
    tax: 'First-time filers who recently signed up. High need for guidance.',
    retail: 'Recent first-time buyers. Needs a strong second-purchase incentive.',
    bank_churn: 'New account holders acquired within the last 30 days.'
  }
};

const DOMAIN_CONFIG = {
  upi: {
    features: [
      { id: 'frequency', label: 'Frequency (Daily Usage)' },
      { id: 'recency', label: 'Recency (Days Since Last UPI)' },
      { id: 'monetary', label: 'Monetary (Wallet Share)' },
      { id: 'failure_rate', label: 'Failure Rate (Technical Friction)' },
    ],
    campaigns: [
      { id: 'cashback', label: '₹100 Cashback', icon: Gift, feature: 'monetary', delta: 15, description: 'Direct spend incentive', costPerUser: 100 },
      { id: 'failure_fix', label: 'Server Optimization', icon: Zap, feature: 'failure_rate', delta: -50, description: 'Reduce txn failures by 50%', costPerUser: 25 },
      { id: 'loyalty', label: 'UPI Reward Points', icon: Trophy, feature: 'frequency', delta: 25, description: 'Boost daily usage', costPerUser: 40 },
    ]
  },
  tax: {
    features: [
      { id: 'frequency', label: 'Filing Frequency' },
      { id: 'monetary', label: 'Total Taxable Income' },
      { id: 'section_count', label: 'Tax Section Diversity' },
      { id: 'recency', label: 'Days Since Last Credit' },
    ],
    campaigns: [
      { id: 'bundle', label: 'Multi-Section Bundle', icon: Tag, feature: 'section_count', delta: 40, description: 'Encourage multi-section filing', costPerUser: 150 },
      { id: 'reminders', label: 'Automated Reminders', icon: Bell, feature: 'recency', delta: -25, description: 'Reduce credit delay', costPerUser: 30 },
      { id: 'advisory', label: 'VIP Tax Advisory', icon: Users, feature: 'monetary', delta: 20, description: 'Upsell premium filing', costPerUser: 500 },
    ]
  },
  retail: {
    features: [
      { id: 'frequency', label: 'Purchase Frequency' },
      { id: 'recency', label: 'Days Since Last Order' },
      { id: 'monetary', label: 'Average Order Value' },
    ],
    campaigns: [
      { id: 'cashback', label: '₹200 Cashback', icon: Gift, feature: 'monetary', delta: 20, description: 'Direct incentive', costPerUser: 200 },
      { id: 'push', label: 'Push & SMS', icon: Smartphone, feature: 'frequency', delta: 15, description: 'Re-engage users', costPerUser: 50 },
      { id: 'loyalty', label: 'Loyalty Program', icon: Trophy, feature: 'frequency', delta: 30, description: 'Reward pillars', costPerUser: 100 },
    ]
  }
};

const DEFAULT_CAMPAIGNS = [
  { id: 'cashback', label: '₹200 Cashback', icon: Gift, feature: 'monetary', delta: 20, description: 'Direct incentive for Fading Stars', costPerUser: 200 },
  { id: 'push', label: 'Push & SMS', icon: Smartphone, feature: 'frequency', delta: 15, description: 'Re-engage Hibernators', costPerUser: 50 },
  { id: 'discount', label: 'Plan Upgrade (20%)', icon: Tag, feature: 'monetary', delta: 25, description: 'Boost Rising Stars', costPerUser: 150 },
  { id: 'loyalty', label: 'Loyalty Program', icon: Trophy, feature: 'frequency', delta: 30, description: 'Reward Steady Pillars', costPerUser: 100 },
  { id: 'email', label: 'VIP Concierge', icon: Bell, feature: 'recency', delta: -30, description: 'Nurture Loyal Giants', costPerUser: 500 },
];

const STRATEGIC_PRESETS = {
  upi: [
    {
      id: 'strat_upi_champions',
      title: "Reward Frequency Boost",
      segment: "Champions",
      feature: "frequency",
      delta: 25,
      description: "Supercharge your most valuable users ('The Loyal Giant') by offering 2x reward points for frequent daily UPI payments.",
      icon: Trophy,
      badge: "High LTV Lock-in",
      costPerUser: 40
    },
    {
      id: 'strat_upi_fading',
      title: "Direct Monetary Nudge",
      segment: "At Risk",
      feature: "monetary",
      delta: 15,
      description: "Send ₹100 cashbacks specifically to 'At Risk' users showing declining wallet share. Restores transaction activity.",
      icon: Gift,
      badge: "Urgent Recovery",
      costPerUser: 100
    },
    {
      id: 'strat_upi_drifting',
      title: "Reduce Payment Friction",
      segment: "Needs Attention",
      feature: "failure_rate",
      delta: -50,
      description: "Resolve technical errors for drifting 'Needs Attention' users. Cuts failure rate by 50% through direct server optimization.",
      icon: Zap,
      badge: "Friction Reduction",
      costPerUser: 25
    }
  ],
  tax: [
    {
      id: 'strat_tax_champions',
      title: "VIP Advisory Upsell",
      segment: "Champions",
      feature: "monetary",
      delta: 20,
      description: "Upsell direct VIP Tax Advisory (+20% spend) to high-net-worth individuals ('The Loyal Giant') sensitive to service quality.",
      icon: Users,
      badge: "Premium Upsell",
      costPerUser: 500
    },
    {
      id: 'strat_tax_drifting',
      title: "Multi-Section Bundling",
      segment: "Needs Attention",
      feature: "section_count",
      delta: 40,
      description: "Offer multi-section packages to drifting users who face friction halfway, encouraging diverse section entries.",
      icon: Tag,
      badge: "Complexity Nudge",
      costPerUser: 150
    },
    {
      id: 'strat_tax_atrisk',
      title: "Late Filer Auto-Reminders",
      segment: "At Risk",
      feature: "recency",
      delta: -25,
      description: "Send automated credit/deadline reminders to at-risk users who haven't logged in recently, cutting activity delay by 25%.",
      icon: Bell,
      badge: "Loss Prevention",
      costPerUser: 30
    }
  ],
  retail: [
    {
      id: 'strat_retail_champions',
      title: "VIP Loyalty Expansion",
      segment: "Champions",
      feature: "frequency",
      delta: 30,
      description: "Enroll 'Champions' in premium loyalty program to boost purchase frequency by 30%. Deepens high-value wallet share.",
      icon: Trophy,
      badge: "LTV Expansion",
      costPerUser: 100
    },
    {
      id: 'strat_retail_fading',
      title: "Win-back Monetary Coupon",
      segment: "At Risk",
      feature: "monetary",
      delta: 20,
      description: "Provide high-value ₹200 coupons to 'At Risk' fading stars to boost average order value by 20% and trigger repeat spend.",
      icon: Gift,
      badge: "Win-Back Offer",
      costPerUser: 200
    },
    {
      id: 'strat_retail_lost',
      title: "Re-engagement Push Campaign",
      segment: "Hibernating",
      feature: "frequency",
      delta: 15,
      description: "Launch direct push notification sequences targeting dormant 'Lost Souls' (Hibernating) to recover basic purchase rhythm.",
      icon: Smartphone,
      badge: "Dormant Recovery",
      costPerUser: 50
    }
  ]
};

const parseHypothesisToPreset = (h, domain) => {
  const title = h.title || h.driver || "AI Hypothesis";
  const text = `${h.hypothesis || ''} ${h.action || ''} ${h.expected_impact || ''}`.toLowerCase();

  let targetSegment = "At Risk";
  if (text.includes("champion")) targetSegment = "Champions";
  else if (text.includes("loyalist") || text.includes("steady pillar")) targetSegment = "Loyalists";
  else if (text.includes("promising") || text.includes("rising star")) targetSegment = "Promising";
  else if (text.includes("at risk") || text.includes("fading star")) targetSegment = "At Risk";
  else if (text.includes("hibernating") || text.includes("lost soul") || text.includes("dormant")) targetSegment = "Hibernating";
  else if (text.includes("attention") || text.includes("drifting")) targetSegment = "Needs Attention";

  let targetFeature = "frequency";
  if (domain === 'tax') {
    if (text.includes("income") || text.includes("monetary") || text.includes("spend") || text.includes("advisory") || text.includes("premium")) targetFeature = "monetary";
    else if (text.includes("diversity") || text.includes("section") || text.includes("bundle")) targetFeature = "section_count";
    else if (text.includes("reminders") || text.includes("recency") || text.includes("delay") || text.includes("active")) targetFeature = "recency";
    else if (text.includes("frequency") || text.includes("filing count") || text.includes("regular")) targetFeature = "frequency";
  } else if (domain === 'upi') {
    if (text.includes("failure") || text.includes("friction") || text.includes("error") || text.includes("server") || text.includes("optimization")) targetFeature = "failure_rate";
    else if (text.includes("monetary") || text.includes("spend") || text.includes("wallet") || text.includes("cashback")) targetFeature = "monetary";
    else if (text.includes("recency") || text.includes("inactive") || text.includes("active")) targetFeature = "recency";
    else if (text.includes("frequency") || text.includes("daily") || text.includes("usage") || text.includes("points")) targetFeature = "frequency";
  } else if (domain === 'retail') {
    if (text.includes("monetary") || text.includes("spend") || text.includes("basket") || text.includes("order value") || text.includes("coupon")) targetFeature = "monetary";
    else if (text.includes("recency") || text.includes("last order") || text.includes("active")) targetFeature = "recency";
    else if (text.includes("frequency") || text.includes("loyalty") || text.includes("purchase count") || text.includes("regular")) targetFeature = "frequency";
  }

  let targetDelta = 20;
  if (targetFeature === 'recency') targetDelta = -25;
  if (targetFeature === 'failure_rate') targetDelta = -50;

  const pctMatch = text.match(/(-?\d+)\s*%/);
  if (pctMatch) {
    const val = parseInt(pctMatch[1]);
    if (val !== 0) targetDelta = val;
  }

  let Icon = Sparkles;
  if (targetFeature === 'monetary') Icon = DollarSign;
  else if (targetFeature === 'frequency') Icon = Trophy;
  else if (targetFeature === 'recency') Icon = Bell;
  else if (targetFeature === 'failure_rate') Icon = Zap;

  return {
    id: `dynamic_${Math.random().toString(36).substr(2, 9)}`,
    title: title,
    segment: targetSegment,
    feature: targetFeature,
    delta: targetDelta,
    description: h.hypothesis || h.action || "AI recommended intervention preset.",
    icon: Icon,
    badge: h.confidence ? `${h.confidence} Confidence` : "AI Suggested",
    costPerUser: targetFeature === 'monetary' ? 250 : targetFeature === 'frequency' ? 80 : 35
  };
};

function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 1 }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{ display: 'inline-block' }}
    >
      {prefix}{typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : value}{suffix}
    </motion.span>
  );
}

export default function WhatIfSandbox({ segments, segChurn, domain, onSimulationResult, hypotheses, isSummaryData }) {
  const campaigns = DOMAIN_CONFIG[domain]?.campaigns || DEFAULT_CAMPAIGNS;
  const features = DOMAIN_CONFIG[domain]?.features || [
    { id: 'frequency', label: 'Frequency (+engagement)' },
    { id: 'recency', label: 'Recency (−days since last)' },
    { id: 'monetary', label: 'Monetary (+spend)' },
  ];

  const [segment, setSegment] = useState('');
  const [feature, setFeature] = useState('frequency');
  const [delta, setDelta] = useState(20);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [activePreset, setActivePreset] = useState(null);
  const [mode, setMode] = useState('presets'); // 'presets' | 'manual' | 'campaign'
  const [abTest, setAbTest] = useState(null);
  const [roiExplanation, setRoiExplanation] = useState(null);

  const segmentNames = segments ? Object.keys(segments) : [];

  const staticPresets = STRATEGIC_PRESETS[domain] || STRATEGIC_PRESETS['retail'];
  const dynamicPresets = React.useMemo(() => {
    if (!hypotheses || !Array.isArray(hypotheses)) return [];
    return hypotheses.map(h => parseHypothesisToPreset(h, domain));
  }, [hypotheses, domain]);
  
  const allPresets = React.useMemo(() => {
    let combined = [...dynamicPresets, ...staticPresets];
    // Sort by assumed segment LTV value to show most profitable first
    const ltvTier = { 'Champions': 10, 'Loyalists': 8, 'Promising': 6, 'New': 5, 'At Risk': 4, 'Needs Attention': 3, 'Hibernating': 1 };
    combined.sort((a, b) => (ltvTier[b.segment] || 0) - (ltvTier[a.segment] || 0));
    return combined.slice(0, 5); // Just show 5 examples as requested
  }, [dynamicPresets, staticPresets]);

  const selectPreset = (preset) => {
    setActivePreset(preset);
    setActiveCampaign(null);
    setSegment(preset.segment);
    setFeature(preset.feature);
    setDelta(preset.delta);
    // Instant simulation execution
    runSimulation(preset.feature, preset.delta, preset.segment);
  };

  const runSimulation = async (overrideFeature, overrideDelta, overrideSegment) => {
    const sName = overrideSegment !== undefined ? overrideSegment : segment;
    if (!sName) return;
    setLoading(true);
    setRoiExplanation(null);
    const f = overrideFeature || feature;
    const d = overrideDelta !== undefined ? overrideDelta : delta;
    try {
      const r = await axios.post(`${API_URL}/whatif`, { segment: sName, feature: f, delta_pct: d });
      const resData = r.data;
      setResult(resData);
      if (onSimulationResult) onSimulationResult(resData);
      setAbTest(null);

      // Compute local ROI for LLM
      const churnImprov = (resData.original_churn - resData.simulated_churn) * 100;
      const sData = segChurn?.find(s => s.segment === sName);
      const ltv = Math.round(sData?.est_ltv || 1000);
      const backendCost = sData?.intervention_cost || 15;

      const activeC = campaigns.find(c => c.feature === f && c.delta === d) || activePreset;
      const cost = activeC ? activeC.costPerUser * resData.users_affected : backendCost * resData.users_affected;
      const ltvGained = ltv * (churnImprov / 100) * resData.users_affected;
      const profitable = ltvGained > (cost * 0.85);

      try {
        const explainR = await axios.post(`${API_URL}/explain-roi`, {
          segment: sName,
          feature: f,
          delta_pct: d,
          original_churn: resData.original_churn,
          simulated_churn: resData.simulated_churn,
          users_affected: resData.users_affected,
          cost: cost,
          ltv_gained: ltvGained,
          is_profitable: profitable
        });
        setRoiExplanation(explainR.data.explanation);
        if (profitable) {
          confetti({
            particleCount: 100,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#10b981', '#34d399', '#fcd34d']
          });
        }
      } catch (ex) {
        console.error('LLM Explanation error', ex);
      }

    } catch (e) {
      alert(e.response?.data?.detail || 'Simulation failed');
    }
    setLoading(false);
  };

  const generateAbTest = () => {
    if (!result) return;
    const sampleSize = Math.max(100, Math.ceil(result.users_affected * 0.2));
    const duration = result.recommended_duration_days || 14;
    setAbTest({
      sampleSize,
      duration,
      confidence: result.recommended_confidence_pct || 95
    });
  };

  const selectCampaign = (campaign) => {
    setActiveCampaign(campaign);
    setActivePreset(null);
    setFeature(campaign.feature);
    setDelta(campaign.delta);
  };

  const churnImprovement = result ? (result.original_churn - result.simulated_churn) * 100 : 0;
  const churnOutcome = Math.abs(churnImprovement) < 0.001 
    ? 'neutral' 
    : (churnImprovement > 0 ? 'positive' : 'negative');
  const isPositive = churnOutcome === 'positive';

  // Real ROI logic: Use centralized backend LTV and Cost
  const segData = segChurn?.find(s => s.segment === segment);
  const avgLTV = Math.round(segData?.est_ltv || 1000);
  const backendCostPerUser = segData?.intervention_cost || 15; // Balanced fallback

  const activePresetOrCampaign = activeCampaign || activePreset;
  const interventionCost = activePresetOrCampaign 
    ? activePresetOrCampaign.costPerUser * (result?.users_affected || 0)
    : backendCostPerUser * (result?.users_affected || 0);
  const predictedLTVGained = result ? (result.ltv_saved !== undefined ? result.ltv_saved : (avgLTV * (churnImprovement / 100) * result.users_affected)) : 0;
  const isProfitable = predictedLTVGained > (interventionCost * 0.85); // Professional margin

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sliders size={20} style={{ color: '#8b5cf6' }} />
          <h2 style={{ margin: 0 }}>What-If Simulation Engine</h2>
        </div>
        <div className="whatif-mode-toggle">
          <button
            className={`whatif-mode-btn ${mode === 'presets' ? 'active' : ''}`}
            onClick={() => setMode('presets')}
          >
            AI Strategic Presets
          </button>
          <button
            className={`whatif-mode-btn ${mode === 'campaign' ? 'active' : ''}`}
            onClick={() => setMode('campaign')}
          >
            Campaigns
          </button>
          <button
            className={`whatif-mode-btn ${mode === 'manual' ? 'active' : ''}`}
            onClick={() => setMode('manual')}
          >
            Manual
          </button>
        </div>
      </div>
      <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', marginTop: '-0.25rem' }}>
        Simulate business interventions and see predicted churn impact in real-time
      </p>

      {/* Segment Selector (always visible) */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
          Target Segment Persona
        </label>
        <select value={segment} onChange={e => setSegment(e.target.value)} className="select-dataset" style={{ minWidth: '220px' }}>
          <option value="">Select Persona...</option>
          {segmentNames.map(s => <option key={s} value={s}>{PERSONA_DEFINITIONS[s]?.label || s} ({s})</option>)}
        </select>
      </div>

      {/* Persona Description Box */}
      {segment && PERSONA_DEFINITIONS[segment] && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem',
            background: 'rgba(99,102,241,0.04)',
            borderLeft: '4px solid var(--primary)',
            borderRadius: '0 8px 8px 0',
            fontSize: '0.85rem'
          }}
        >
          <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Users size={14} /> {PERSONA_DEFINITIONS[segment].label}
          </div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {PERSONA_DEFINITIONS[segment][domain] || PERSONA_DEFINITIONS[segment].description}
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {mode === 'presets' ? (
          <motion.div key="presets" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem', marginTop: '-0.5rem', lineHeight: 1.4 }}>
              <Sparkles size={13} style={{ color: 'var(--primary)', display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />
              <strong>AI Strategic Recommendations:</strong> Pre-configured business interventions aligned with Finsight's active churn hypotheses. Click any card to automatically target the segment and simulate predicted revenue recovery in real-time.
            </p>
            <div className="campaign-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {allPresets.map((p) => {
                const Icon = p.icon || Sparkles;
                const isActive = activePreset?.id === p.id;
                return (
                  <motion.button
                    key={p.id}
                    className={`campaign-card ${isActive ? 'campaign-card--active' : ''}`}
                    onClick={() => selectPreset(p)}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      textAlign: 'left',
                      alignItems: 'flex-start',
                      padding: '1.25rem',
                      minHeight: '170px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderWidth: '2px',
                      borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                      background: isActive ? 'rgba(99, 102, 241, 0.03)' : 'var(--bg-card)'
                    }}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
                        <div className="campaign-card-icon" style={{ margin: 0 }}><Icon size={16} /></div>
                        <span className="badge" style={{
                          background: isActive ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)',
                          color: 'var(--primary)',
                          fontSize: '0.62rem',
                          padding: '0.15rem 0.45rem',
                          textTransform: 'uppercase',
                          fontWeight: 800
                        }}>
                          {p.badge}
                        </span>
                      </div>
                      <div className="campaign-card-label" style={{ fontSize: '0.88rem', fontWeight: 800, marginBottom: '0.25rem' }}>{p.title}</div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', margin: '0.4rem 0 0.5rem' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(245,158,11,0.08)', color: '#d97706', border: '1px solid rgba(245,158,11,0.15)' }}>
                          Target: {PERSONA_DEFINITIONS[p.segment]?.label || p.segment}
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.15)' }}>
                          {features.find(f => f.id === p.feature)?.label || p.feature} {p.delta > 0 ? '+' : ''}{p.delta}%
                        </span>
                      </div>

                      <div className="campaign-card-desc" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '0.25rem' }}>
                        {p.description}
                      </div>
                    </div>

                    {isActive && <div className="campaign-card-check" style={{ top: '1.25rem', right: '1.25rem' }}>✓</div>}
                  </motion.button>
                );
              })}
            </div>
            {activePreset && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', alignItems: 'center' }}>
                <button
                  className="btn-primary"
                  onClick={() => selectPreset(activePreset)}
                  disabled={loading}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <Play size={16} />{loading ? 'Running Simulation...' : `Re-run "${activePreset.title}" Preset`}
                </button>
              </div>
            )}
          </motion.div>
        ) : mode === 'campaign' ? (
          <motion.div key="campaign" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="campaign-grid">
              {campaigns.map((c) => {
                const Icon = c.icon;
                const isActive = activeCampaign?.id === c.id;
                return (
                  <motion.button
                    key={c.id}
                    className={`campaign-card ${isActive ? 'campaign-card--active' : ''}`}
                    onClick={() => selectCampaign(c)}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="campaign-card-icon"><Icon size={18} /></div>
                    <div className="campaign-card-label">{c.label}</div>
                    <div className="campaign-card-desc">{c.description}</div>
                    {isActive && <div className="campaign-card-check">✓</div>}
                  </motion.button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
              <button
                className="btn-primary"
                onClick={() => activeCampaign && runSimulation(activeCampaign.feature, activeCampaign.delta)}
                disabled={loading || !segment || !activeCampaign}
                style={{ flex: 1 }}
              >
                <Play size={16} />{loading ? 'Simulating...' : `Run "${activeCampaign?.label || 'Campaign'}"`}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="manual" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="whatif-controls">
              <div className="whatif-control-group">
                <label>Feature to Modify</label>
                <select value={feature} onChange={e => setFeature(e.target.value)} className="select-dataset">
                  {features.map(f => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="whatif-control-group">
                <label>Change: <strong>{delta > 0 ? '+' : ''}{delta}%</strong></label>
                <input type="range" min={-50} max={100} value={delta} onChange={e => setDelta(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#6366f1' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8' }}>
                  <span>-50%</span><span>0%</span><span>+100%</span>
                </div>
              </div>
              <button className="btn-primary" onClick={() => runSimulation()} disabled={loading || !segment}
                style={{ height: 'fit-content', alignSelf: 'flex-end' }}>
                <Play size={16} />{loading ? 'Simulating...' : 'Run Simulation'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div
            className="whatif-results"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Big hero card - Revenue Saved / Lost */}
            <FormulaTooltip 
              formula={isSummaryData 
                ? "(Original Churn - Simulated Churn) × Total Segment Spend" 
                : "(Original Churn - Simulated Churn) × Segment 90-Day Spend (Monetary Velocity × 90)"} 
              color="#ffffff" 
              title="Revenue Computation"
            >
              <motion.div
                className="impact-hero-card"
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                style={{ 
                  background: churnOutcome === 'positive' 
                    ? 'linear-gradient(135deg, #10b981, #059669)' 
                    : (churnOutcome === 'negative' 
                      ? 'linear-gradient(135deg, #f43f5e, #e11d48)' 
                      : 'linear-gradient(135deg, #64748b, #475569)'), 
                  boxShadow: churnOutcome === 'positive'
                    ? '0 8px 32px rgba(16, 185, 129, 0.35)'
                    : (churnOutcome === 'negative'
                      ? '0 8px 32px rgba(244, 63, 94, 0.35)'
                      : '0 8px 32px rgba(100, 116, 139, 0.35)'),
                  cursor: 'help' 
                }}
              >
                <div className="impact-hero-icon">₹</div>
                <div className="impact-hero-label">
                  {churnOutcome === 'positive' 
                    ? 'Predicted Revenue Saved' 
                    : (churnOutcome === 'negative' ? 'Potential Revenue Loss' : 'No Revenue Impact')}
                </div>
                <div className="impact-hero-value">
                  <AnimatedNumber value={result.revenue_saved || 0} prefix="₹" decimals={0} />
                </div>
                <div className="impact-hero-sub">
                  {churnOutcome === 'positive'
                    ? `with this intervention · ${result.users_affected} users protected`
                    : (churnOutcome === 'negative'
                      ? `due to churn increase · ${result.users_affected} users at higher risk`
                      : `no predicted change in churn for ${result.users_affected} users`
                    )}
                </div>
              </motion.div>
            </FormulaTooltip>

            {/* Delta cards */}
            <div className="whatif-result-cards" style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr auto 1fr 1.2fr 1fr', gap: '0.75rem', alignItems: 'stretch' }}>
              <FormulaTooltip formula="Base churn rate for this segment before any modification.">
                <div className="whatif-card" style={{ cursor: 'help', height: '100%' }}>
                  <div className="whatif-card-label">Original Churn</div>
                  <div className="whatif-card-value" style={{ color: '#f43f5e' }}>
                    <AnimatedNumber value={(result.original_churn * 100)} suffix="%" decimals={1} />
                  </div>
                </div>
              </FormulaTooltip>
              <ArrowRight size={24} style={{ color: '#94a3b8', alignSelf: 'center' }} />
              <FormulaTooltip formula="New churn rate predicted after applying the feature delta.">
                <div className="whatif-card" style={{ cursor: 'help', height: '100%' }}>
                  <div className="whatif-card-label">Simulated Churn</div>
                  <div className="whatif-card-value" style={{ color: result.simulated_churn < result.original_churn ? '#10b981' : '#f43f5e' }}>
                    <AnimatedNumber value={(result.simulated_churn * 100)} suffix="%" decimals={1} />
                  </div>
                </div>
              </FormulaTooltip>

              <FormulaTooltip 
                formula="Absolute difference between Original and Simulated churn rates." 
                color={churnOutcome === 'positive' ? '#10b981' : (churnOutcome === 'negative' ? '#f43f5e' : '#64748b')}
              >
                <div 
                  className={`whatif-card whatif-card--highlight ${
                    churnOutcome === 'positive' 
                      ? 'whatif-card--green' 
                      : (churnOutcome === 'negative' ? 'whatif-card--red' : '')
                  }`} 
                  style={{ 
                    cursor: 'help', 
                    height: '100%',
                    border: churnOutcome === 'neutral' ? '1px solid rgba(100, 116, 139, 0.2)' : undefined,
                    background: churnOutcome === 'neutral' ? 'rgba(100, 116, 139, 0.05)' : undefined
                  }}
                >
                  <div className="whatif-card-label">
                    <TrendingDown size={14} /> Absolute Churn Impact
                  </div>
                  <div className="whatif-card-value" style={{ color: churnOutcome === 'positive' ? '#10b981' : (churnOutcome === 'negative' ? '#f43f5e' : '#64748b') }}>
                    <AnimatedNumber value={Math.abs(result.absolute_reduction || churnImprovement)} suffix="%" decimals={1} />
                  </div>
                  <div style={{ 
                    fontSize: '0.65rem', 
                    fontWeight: 800, 
                    color: churnOutcome === 'positive' ? '#10b981' : (churnOutcome === 'negative' ? '#f43f5e' : '#64748b'), 
                    marginTop: '0.2rem', 
                    textTransform: 'uppercase' 
                  }}>
                    {churnOutcome === 'positive' 
                      ? '▼ Drop (Improved)' 
                      : (churnOutcome === 'negative' ? '▲ Increase (Worsened)' : '▶ No Change (Neutral)')}
                  </div>
                </div>
              </FormulaTooltip>

              <FormulaTooltip formula="Total unique users belonging to the selected segment.">
                <div className="whatif-card" style={{ cursor: 'help', height: '100%' }}>
                  <div className="whatif-card-label"><Users size={14} /> Users Affected</div>
                  <div className="whatif-card-value">
                    <AnimatedNumber value={result.users_affected} decimals={0} />
                  </div>
                </div>
              </FormulaTooltip>
            </div>

            {/* CAC vs LTV Dashboard */}
            <FormulaTooltip 
              formula={isSummaryData 
                ? "Net ROI = LTV Saved - Campaign Cost. LTV Saved = Churn Drop × Segment Spend" 
                : "Net ROI = LTV Saved - Campaign Cost. LTV Saved = Churn Drop × Segment 365-Day Spend (Monetary Velocity × 365)"} 
              color={isProfitable ? '#10b981' : '#f43f5e'}
            >
              <div style={{ marginTop: '1rem', background: 'var(--bg-input)', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${isProfitable ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`, cursor: 'help' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                    <DollarSign size={16} style={{ color: isProfitable ? '#10b981' : '#f43f5e' }} /> Retention ROI (CAC vs LTV)
                  </strong>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isProfitable ? '#10b981' : '#f43f5e', background: isProfitable ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>
                    {isProfitable ? 'HIGH ROI' : 'LOW ROI / NON-PROFITABLE'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>Total Campaign Cost: <strong style={{ color: '#f43f5e' }}>₹{interventionCost.toLocaleString()}</strong></span>
                  <span>Net LTV Saved: <strong style={{ color: '#10b981' }}>₹{predictedLTVGained.toLocaleString()}</strong></span>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: isProfitable ? '#059669' : '#e11d48' }}>
                  {isProfitable
                    ? 'System Action: Profitable to retain. The value of users saved exceeds intervention cost.'
                    : 'System Action: Flagged. The cost of this intervention is higher than the expected LTV recovery.'}
                </div>
              </div>
            </FormulaTooltip>

            {roiExplanation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                style={{ marginTop: '1rem', background: 'rgba(99,102,241,0.05)', border: '1px dashed rgba(99,102,241,0.3)', padding: '0.85rem 1rem', borderRadius: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}
              >
                <div style={{ background: 'var(--primary)', padding: '0.25rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={14} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>AI Strategic Analysis</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontWeight: 500 }}>
                    {roiExplanation}
                  </div>
                </div>
              </motion.div>
            )}

            <div className="whatif-recommendation" style={{ marginTop: '1rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong>Prescriptive Insight:</strong>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)', background: 'rgba(99,102,241,0.1)', padding: '0.15rem 0.5rem', borderRadius: '1rem' }}>
                  MODEL EVIDENCE: {(result.feature_importance * 100).toFixed(1)}%
                </span>
              </div>
              {result.recommendation}
              <div style={{ marginTop: '0.75rem', height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${result.feature_importance * 100}%` }}
                  style={{ height: '100%', background: 'var(--primary)', borderRadius: '2px' }}
                />
              </div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.35rem', fontStyle: 'italic' }}>
                *This simulation is grounded in features that contribute {(result.feature_importance * 100).toFixed(1)}% to the model's decision-making logic.
              </div>
            </div>

            {/* Model Transparency Note — shown when model shows no effect for a positive intervention */}
            {result.model_limitation_note && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: '0.75rem',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start'
                }}
              >
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                    Model Transparency Note
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {result.model_limitation_note}
                  </div>
                </div>
              </motion.div>
            )}

            {/* A/B Test Simulator */}
            <div style={{ marginTop: '1.25rem' }}>
              {!abTest ? (
                <button className="btn-outline" onClick={generateAbTest} style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}>
                  <FlaskConical size={16} /> Design A/B Test for this Hypothesis
                </button>
              ) : (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(16,185,129,0.05))', border: '1px solid rgba(99,102,241,0.2)', padding: '1rem', borderRadius: '0.5rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6366f1' }}>
                    <FlaskConical size={16} /> Recommended A/B Test Design
                  </h4>
                  <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    To achieve <strong>{abTest.confidence}% statistical significance</strong>, test this intervention on a random holdout group of <strong>{abTest.sampleSize.toLocaleString()} users</strong> (Control) vs <strong>{abTest.sampleSize.toLocaleString()} users</strong> (Variant). Run the experiment for <strong>{abTest.duration} days</strong> to account for weekly seasonality.
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
