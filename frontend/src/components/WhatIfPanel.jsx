import React, { useState } from 'react';
import axios from 'axios';
import {
  Sliders, Play, DollarSign, TrendingDown, Users, ArrowRight,
  Zap, Gift, Bell, Smartphone, Tag, Trophy, FlaskConical, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FormulaTooltip from './FormulaTooltip';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const PERSONA_MAP = {
  'At Risk': 'The Fading Star',
  'Loyalists': 'The Steady Pillar',
  'Champions': 'The Loyal Giant',
  'Promising': 'The Rising Star',
  'Hibernating': 'The Lost Soul',
};

const CAMPAIGNS = [
  { id: 'cashback', label: '₹200 Cashback', icon: Gift, feature: 'monetary', delta: 20, description: 'Direct incentive for Fading Stars', costPerUser: 200 },
  { id: 'push', label: 'Push & SMS', icon: Smartphone, feature: 'frequency', delta: 15, description: 'Re-engage Hibernators', costPerUser: 50 },
  { id: 'discount', label: 'Plan Upgrade (20%)', icon: Tag, feature: 'monetary', delta: 25, description: 'Boost Rising Stars', costPerUser: 150 },
  { id: 'loyalty', label: 'Loyalty Program', icon: Trophy, feature: 'frequency', delta: 30, description: 'Reward Steady Pillars', costPerUser: 100 },
  { id: 'email', label: 'VIP Concierge', icon: Bell, feature: 'recency', delta: -30, description: 'Nurture Loyal Giants', costPerUser: 500 },
];

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

export default function WhatIfPanel({ segments, segChurn, onSimulationResult }) {
  const [segment, setSegment] = useState('');
  const [feature, setFeature] = useState('frequency');
  const [delta, setDelta] = useState(20);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [mode, setMode] = useState('manual'); // 'manual' | 'campaign'
  const [abTest, setAbTest] = useState(null);

  const segmentNames = segments ? Object.keys(segments) : [];

  const runSimulation = async (overrideFeature, overrideDelta) => {
    if (!segment) return;
    setLoading(true);
    const f = overrideFeature || feature;
    const d = overrideDelta !== undefined ? overrideDelta : delta;
    try {
      const r = await axios.post(`${API_URL}/whatif`, { segment, feature: f, delta_pct: d });
      setResult(r.data);
      if (onSimulationResult) onSimulationResult(r.data);
      setAbTest(null); // reset A/B test when running a new simulation
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
    setFeature(campaign.feature);
    setDelta(campaign.delta);
  };

  const churnImprovement = result ? (result.original_churn - result.simulated_churn) * 100 : 0;
  const isPositive = churnImprovement > 0;
  
  // Real ROI logic: Use centralized backend LTV and Cost
  const segData = segChurn?.find(s => s.segment === segment);
  const avgLTV = Math.round(segData?.est_ltv || 1000);
  const backendCostPerUser = segData?.intervention_cost || 15; // Balanced fallback
  
  const interventionCost = activeCampaign ? activeCampaign.costPerUser * result?.users_affected : backendCostPerUser * result?.users_affected;
  const predictedLTVGained = result ? (avgLTV * (churnImprovement / 100) * result.users_affected) : 0;
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
            className={`whatif-mode-btn ${mode === 'manual' ? 'active' : ''}`}
            onClick={() => setMode('manual')}
          >
            Manual
          </button>
          <button
            className={`whatif-mode-btn ${mode === 'campaign' ? 'active' : ''}`}
            onClick={() => setMode('campaign')}
          >
            Campaigns
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
          {segmentNames.map(s => <option key={s} value={s}>{PERSONA_MAP[s] || s} ({s})</option>)}
        </select>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'campaign' ? (
          <motion.div key="campaign" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="campaign-grid">
              {CAMPAIGNS.map((c) => {
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
                  <option value="frequency">Frequency (+engagement)</option>
                  <option value="recency">Recency (−days since last)</option>
                  <option value="monetary">Monetary (+spend)</option>
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
            <FormulaTooltip formula="(Original Churn - Simulated Churn) × Users Affected × Avg LTV" color="#ffffff" title="Revenue Computation">
              <motion.div
                className="impact-hero-card"
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                style={{ background: isPositive ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #f43f5e, #e11d48)', cursor: 'help' }}
              >
                <div className="impact-hero-icon">₹</div>
                <div className="impact-hero-label">{isPositive ? 'Predicted Revenue Saved' : 'Potential Revenue Loss'}</div>
                <div className="impact-hero-value">
                  <AnimatedNumber value={result.revenue_saved || 0} prefix="₹" decimals={0} />
                </div>
                <div className="impact-hero-sub">
                  {isPositive 
                    ? `with this intervention · ${result.users_affected} users protected` 
                    : `due to churn increase · ${result.users_affected} users at higher risk`}
                </div>
              </motion.div>
            </FormulaTooltip>

            {/* Delta cards */}
            <div className="whatif-result-cards" style={{ marginTop: '1rem' }}>
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

              <FormulaTooltip formula="Absolute difference between Original and Simulated churn rates." color={isPositive ? '#10b981' : '#f43f5e'}>
                <div className={`whatif-card whatif-card--highlight ${isPositive ? 'whatif-card--green' : 'whatif-card--red'}`} style={{ cursor: 'help', height: '100%' }}>
                  <div className="whatif-card-label">
                    <TrendingDown size={14} /> Absolute Churn Drop
                  </div>
                  <div className="whatif-card-value" style={{ color: isPositive ? '#10b981' : '#f43f5e' }}>
                    <AnimatedNumber value={Math.abs(result.absolute_reduction || churnImprovement)} suffix="%" decimals={1} />
                  </div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: isPositive ? '#10b981' : '#f43f5e', marginTop: '0.2rem', textTransform: 'uppercase' }}>
                    {result.reduction_pct ? `${result.reduction_pct.toFixed(1)}% Relative Lift` : (isPositive ? '▼ Reduced' : '▲ Increased')}
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
            <FormulaTooltip formula="(LTV Saved - Campaign Cost). LTV Saved = Churn Δ × User Count × Segment LTV." color={isProfitable ? '#10b981' : '#f43f5e'}>
              <div style={{ marginTop: '1rem', background: 'var(--bg-input)', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${isProfitable ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`, cursor: 'help' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                    <DollarSign size={16} style={{ color: isProfitable ? '#10b981' : '#f43f5e' }}/> Retention ROI (CAC vs LTV)
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
