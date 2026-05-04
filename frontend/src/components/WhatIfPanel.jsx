import React, { useState } from 'react';
import axios from 'axios';
import {
  Sliders, Play, DollarSign, TrendingDown, Users, ArrowRight,
  Zap, Gift, Bell, Smartphone, Tag, Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const CAMPAIGNS = [
  { id: 'cashback', label: '₹100 Cashback', icon: Gift, feature: 'monetary', delta: 20, description: 'Instant reward to boost engagement' },
  { id: 'push', label: 'Push Notification', icon: Smartphone, feature: 'frequency', delta: 15, description: 'Re-engage dormant users' },
  { id: 'discount', label: 'Plan Discount (20%)', icon: Tag, feature: 'monetary', delta: 25, description: 'Upgrade incentive' },
  { id: 'loyalty', label: 'Loyalty Points', icon: Trophy, feature: 'frequency', delta: 30, description: 'Reward frequent users' },
  { id: 'email', label: 'Re-engagement Email', icon: Bell, feature: 'recency', delta: -30, description: 'Bring back inactive users' },
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

export default function WhatIfPanel({ segments }) {
  const [segment, setSegment] = useState('');
  const [feature, setFeature] = useState('frequency');
  const [delta, setDelta] = useState(20);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [mode, setMode] = useState('manual'); // 'manual' | 'campaign'

  const segmentNames = segments ? Object.keys(segments) : [];

  const runSimulation = async (overrideFeature, overrideDelta) => {
    if (!segment) return;
    setLoading(true);
    const f = overrideFeature || feature;
    const d = overrideDelta !== undefined ? overrideDelta : delta;
    try {
      const r = await axios.post(`${API_URL}/whatif`, { segment, feature: f, delta_pct: d });
      setResult(r.data);
    } catch (e) {
      alert(e.response?.data?.detail || 'Simulation failed');
    }
    setLoading(false);
  };

  const selectCampaign = (campaign) => {
    setActiveCampaign(campaign);
    setFeature(campaign.feature);
    setDelta(campaign.delta);
  };

  const churnImprovement = result ? (result.original_churn - result.simulated_churn) * 100 : 0;
  const isPositive = churnImprovement > 0;

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
            🚀 Campaigns
          </button>
        </div>
      </div>
      <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', marginTop: '-0.25rem' }}>
        Simulate business interventions and see predicted churn impact in real-time
      </p>

      {/* Segment Selector (always visible) */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
          Target Segment
        </label>
        <select value={segment} onChange={e => setSegment(e.target.value)} className="select-dataset" style={{ minWidth: '220px' }}>
          <option value="">Select segment...</option>
          {segmentNames.map(s => <option key={s} value={s}>{s}</option>)}
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
            {/* Big hero card - Revenue Saved */}
            <motion.div
              className="impact-hero-card"
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              <div className="impact-hero-icon">💰</div>
              <div className="impact-hero-label">You just saved</div>
              <div className="impact-hero-value">
                <AnimatedNumber value={result.revenue_protected || 0} prefix="₹" decimals={0} />
              </div>
              <div className="impact-hero-sub">with this intervention · {result.users_affected} users protected</div>
            </motion.div>

            {/* Delta cards */}
            <div className="whatif-result-cards" style={{ marginTop: '1rem' }}>
              <div className="whatif-card">
                <div className="whatif-card-label">Original Churn</div>
                <div className="whatif-card-value" style={{ color: '#f43f5e' }}>
                  <AnimatedNumber value={(result.original_churn * 100)} suffix="%" decimals={1} />
                </div>
              </div>
              <ArrowRight size={24} style={{ color: '#94a3b8', alignSelf: 'center' }} />
              <div className="whatif-card">
                <div className="whatif-card-label">Simulated Churn</div>
                <div className="whatif-card-value" style={{ color: result.simulated_churn < result.original_churn ? '#10b981' : '#f43f5e' }}>
                  <AnimatedNumber value={(result.simulated_churn * 100)} suffix="%" decimals={1} />
                </div>
              </div>

              <div className={`whatif-card whatif-card--highlight ${isPositive ? 'whatif-card--green' : 'whatif-card--red'}`}>
                <div className="whatif-card-label">
                  <TrendingDown size={14} /> Churn Reduction
                </div>
                <div className="whatif-card-value" style={{ color: isPositive ? '#10b981' : '#f43f5e' }}>
                  <AnimatedNumber value={Math.abs(churnImprovement)} suffix="%" decimals={1} />
                </div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: isPositive ? '#10b981' : '#f43f5e', marginTop: '0.2rem' }}>
                  {isPositive ? '▼ REDUCED' : '▲ INCREASED'}
                </div>
              </div>

              <div className="whatif-card">
                <div className="whatif-card-label"><Users size={14} /> Users Affected</div>
                <div className="whatif-card-value">
                  <AnimatedNumber value={result.users_affected} decimals={0} />
                </div>
              </div>
            </div>

            {/* Impact Summary */}
            <div className="impact-summary-box">
              <div className="impact-summary-title">
                <Zap size={14} style={{ color: '#f59e0b' }} /> Impact Summary
              </div>
              <div className="impact-summary-grid">
                <div className="impact-summary-item">
                  <span className="impact-summary-key">Churn ↓</span>
                  <span className="impact-summary-val" style={{ color: '#10b981' }}>
                    {churnImprovement.toFixed(1)}%
                  </span>
                </div>
                <div className="impact-summary-item">
                  <span className="impact-summary-key">Revenue Protected</span>
                  <span className="impact-summary-val" style={{ color: '#f59e0b' }}>
                    ${result.revenue_protected?.toLocaleString()}
                  </span>
                </div>
                <div className="impact-summary-item">
                  <span className="impact-summary-key">Users Saved</span>
                  <span className="impact-summary-val" style={{ color: '#6366f1' }}>
                    {result.users_affected}
                  </span>
                </div>
              </div>
            </div>

            <div className="whatif-recommendation">
              <strong>💡 Recommendation:</strong> {result.recommendation}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
