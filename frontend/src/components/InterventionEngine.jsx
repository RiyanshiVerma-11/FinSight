import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Target, Zap, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const PERSONA_MAP = {
  'At Risk': 'The Fading Star',
  'Loyal': 'The Steady Pillar',
  'Champions': 'The Loyal Giant',
  'Promising': 'The Rising Star',
  'Hibernating': 'The Hibernator',
  'Lost': 'The Lost Soul',
  'Potential Loyalist': 'The Rising Star',
};

export default function InterventionEngine({ segments, segChurn }) {
  const segmentList = segments ? Object.entries(segments) : [];
  const [interventions, setInterventions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('');

  const fetchInterventions = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/interventions`);
      setInterventions(r.data.interventions || []);
      setSource(r.data.source || 'rule_based');
    } catch (e) {
      console.error('Interventions fetch failed:', e);
      setInterventions(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInterventions();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <Zap size={20} style={{ color: '#f59e0b' }} />
        <h2 style={{ margin: 0 }}>Retention ROI Engine</h2>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700,
          background: source === 'llm' ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : 'linear-gradient(135deg,#f59e0b,#ef4444)',
          color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '1rem'
        }}>{source === 'llm' ? 'AI-POWERED' : 'DATA-DRIVEN'}</span>
        <button className="btn-outline" onClick={fetchInterventions} disabled={loading}
          style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
        Smart spending logic: We only recommend interventions where <strong>ROI &gt; Cost</strong>.
      </p>

      <div className="intervention-table-wrap">
        <table className="intervention-table">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Users</th>
              <th>Problem</th>
              <th>Recommended Action</th>
              <th>Retention ROI</th>
            </tr>
          </thead>
          <tbody>
            {segmentList.map(([seg, count], i) => {
              const segData = segChurn?.find(s => s.segment === seg);
              const churnPct = segData ? (segData.avg_churn * 100).toFixed(1) : '—';
              
              // CENTRALIZED Logic from Backend
              const estLtv = Math.round(segData?.est_ltv || 1000);
              const cost = Math.round(segData?.intervention_cost || 100);
              const isProfitable = segData?.is_profitable ?? (estLtv > cost);
              const roiColor = isProfitable ? '#10b981' : '#f43f5e';
              const personaName = PERSONA_MAP[seg] || seg;

              // Use dynamic intervention from backend if available
              const dynIntervention = interventions?.find(iv => iv.segment === seg);
              const problem = dynIntervention?.problem || (segData?.avg_churn > 0.5 ? `Critical churn at ${churnPct}%` : `Elevated risk at ${churnPct}%`);
              const action = dynIntervention?.action || (isProfitable ? 'Targeted retention campaign' : 'Monitor & assess');
              const interventionColor = segData?.avg_churn > 0.5 ? '#f43f5e' : segData?.avg_churn > 0.3 ? '#f59e0b' : '#6366f1';

              return (
                <motion.tr
                  key={seg}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="intervention-row"
                >
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>{personaName}</span>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{seg}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>{count?.toLocaleString()}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{problem}</span>
                    {churnPct !== '—' && (
                      <div style={{ fontSize: '0.7rem', color: '#f43f5e', fontWeight: 600, marginTop: '0.15rem' }}>
                        {churnPct}% churn rate
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      background: `${interventionColor}12`, borderRadius: '0.5rem',
                      padding: '0.35rem 0.65rem', width: 'fit-content',
                      border: `1px solid ${interventionColor}25`
                    }}>
                      <Target size={12} style={{ color: interventionColor, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: interventionColor }}>{action}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 800,
                        background: `${roiColor}15`,
                        color: roiColor,
                        border: `1px solid ${roiColor}30`,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '1rem',
                        marginBottom: '0.25rem'
                      }}>
                        {isProfitable ? 'PROFITABLE' : 'NON-PROFITABLE'}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                        Cost: ₹{cost} | LTV: ₹{estLtv}
                      </span>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
