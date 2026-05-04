import React, { useState } from 'react';
import axios from 'axios';
import { Sliders, Play, DollarSign, TrendingDown, Users, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function WhatIfPanel({ segments }) {
  const [segment, setSegment] = useState('');
  const [feature, setFeature] = useState('frequency');
  const [delta, setDelta] = useState(20);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const segmentNames = segments ? Object.keys(segments) : [];

  const runSimulation = async () => {
    if (!segment) return;
    setLoading(true);
    try {
      const r = await axios.post(`${API_URL}/whatif`, { segment, feature, delta_pct: delta });
      setResult(r.data);
    } catch (e) {
      alert(e.response?.data?.detail || 'Simulation failed');
    }
    setLoading(false);
  };

  return (
    <div>
      <h2><Sliders size={20} style={{ color: '#8b5cf6' }} /> What-If Simulation Engine</h2>
      <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', marginTop: '-0.5rem' }}>
        Simulate business interventions and see predicted churn impact in real-time
      </p>

      <div className="whatif-controls">
        <div className="whatif-control-group">
          <label>Target Segment</label>
          <select value={segment} onChange={e => setSegment(e.target.value)} className="select-dataset">
            <option value="">Select segment...</option>
            {segmentNames.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
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
        <button className="btn-primary" onClick={runSimulation} disabled={loading || !segment}
          style={{ height: 'fit-content', alignSelf: 'flex-end' }}>
          <Play size={16} />{loading ? 'Simulating...' : 'Run Simulation'}
        </button>
      </div>

      {result && (
        <motion.div className="whatif-results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="whatif-result-cards">
            <div className="whatif-card">
              <div className="whatif-card-label">Original Churn</div>
              <div className="whatif-card-value" style={{ color: '#f43f5e' }}>
                {(result.original_churn * 100).toFixed(1)}%
              </div>
            </div>
            <ArrowRight size={24} style={{ color: '#94a3b8', alignSelf: 'center' }} />
            <div className="whatif-card">
              <div className="whatif-card-label">Simulated Churn</div>
              <div className="whatif-card-value" style={{ color: result.simulated_churn < result.original_churn ? '#10b981' : '#f43f5e' }}>
                {(result.simulated_churn * 100).toFixed(1)}%
              </div>
            </div>
            <div className="whatif-card whatif-card--highlight">
              <div className="whatif-card-label"><TrendingDown size={14} /> Churn Reduction</div>
              <div className="whatif-card-value" style={{ color: '#10b981' }}>
                {result.churn_reduction_pct > 0 ? '' : '+'}{result.churn_reduction_pct.toFixed(1)}%
              </div>
            </div>
            <div className="whatif-card whatif-card--highlight">
              <div className="whatif-card-label"><DollarSign size={14} /> Revenue Protected</div>
              <div className="whatif-card-value" style={{ color: '#f59e0b' }}>
                ${result.revenue_protected?.toLocaleString()}
              </div>
            </div>
            <div className="whatif-card">
              <div className="whatif-card-label"><Users size={14} /> Users Affected</div>
              <div className="whatif-card-value">{result.users_affected}</div>
            </div>
          </div>
          <div className="whatif-recommendation">
            <strong>💡 Recommendation:</strong> {result.recommendation}
          </div>
        </motion.div>
      )}
    </div>
  );
}
