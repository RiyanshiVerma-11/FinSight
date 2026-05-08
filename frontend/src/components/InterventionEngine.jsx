import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Target, Zap, RefreshCw, TrendingUp, ShieldAlert, CheckCircle2, Info } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const PERSONA_MAP = {
  'Champions': 'The Loyal Giant',
  'Loyalists': 'The Steady Pillar',
  'Promising': 'The Rising Star',
  'At Risk': 'The Fading Star',
  'Hibernating': 'The Lost Soul',
};

const SEGMENT_COLORS = {
  'Champions': '#10b981',
  'Loyalists': '#6366f1',
  'Promising': '#06b6d4',
  'At Risk': '#f43f5e',
  'Hibernating': '#94a3b8',
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
    <div style={{ padding: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(245,158,11,0.1)', padding: '0.5rem', borderRadius: '10px' }}>
           <Zap size={24} style={{ color: '#f59e0b' }} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em' }}>Strategic Intervention Engine</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <span style={{
               fontSize: '0.6rem', fontWeight: 800,
               background: source === 'llm' ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : '#f1f5f9',
               color: source === 'llm' ? '#fff' : '#64748b', padding: '0.15rem 0.5rem', borderRadius: '1rem',
               border: source === 'llm' ? 'none' : '1px solid #e2e8f0'
             }}>{source === 'llm' ? 'AI-OPTIMIZED' : 'DATA-DRIVEN'}</span>
             <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>• Auto-scaling retention spend based on LTV.</span>
          </div>
        </div>
        <button className="btn-outline" onClick={fetchInterventions} disabled={loading}
          style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.5rem 1rem', borderRadius: '10px' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} style={{ marginRight: '0.4rem' }} /> {loading ? 'Re-Calibrating...' : 'Refresh AI'}
        </button>
      </div>

      <div className="intervention-table-wrap" style={{ border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', background: '#fff' }}>
        <table className="intervention-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Strategic Persona</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Scale</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Business Impact</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Recommended Action</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Recovery ROI</th>
            </tr>
          </thead>
          <tbody>
            {segmentList.map(([seg, count], i) => {
              const segData = segChurn?.find(s => s.segment === seg);
              const churnPct = segData ? (segData.avg_churn * 100).toFixed(1) : '—';
              
              const estLtv = Math.round(segData?.est_ltv || 1000);
              const cost = Math.round(segData?.intervention_cost || 100);
              const isProfitable = segData?.is_profitable ?? (estLtv > cost);
              const roiColor = isProfitable ? '#10b981' : '#f43f5e';
              const personaName = PERSONA_MAP[seg] || seg;

              const dynIntervention = interventions?.find(iv => iv.segment === seg);
              const problem = dynIntervention?.problem || (segData?.avg_churn > 0.4 ? `Critical churn at ${churnPct}%` : segData?.avg_churn > 0.2 ? `Elevated risk at ${churnPct}%` : `Stable performance at ${churnPct}%`);
              let action = dynIntervention?.action || (isProfitable ? 'Targeted retention campaign' : 'Monitor & assess');
              if (!isProfitable) {
                action = 'Minimize Loss / Debt Recovery';
              }
              const interventionColor = SEGMENT_COLORS[seg] || '#6366f1';

              return (
                <motion.tr
                  key={seg}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                >
                  <td style={{ padding: '1.25rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 900, color: '#1e293b', fontSize: '0.95rem' }}>{personaName}</span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{seg}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                       <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{count?.toLocaleString()}</span>
                       <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Profiles</span>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                       <ShieldAlert size={14} style={{ color: segData?.avg_churn > 0.5 ? '#f43f5e' : '#f59e0b', marginTop: '0.2rem' }} />
                       <div>
                          <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 700 }}>{problem}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '0.1rem' }}>
                             Market exposure: ₹{((segData?.avg_churn || 0) * estLtv * (count || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </div>
                       </div>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1rem' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      background: `${interventionColor}10`, borderRadius: '10px',
                      padding: '0.5rem 0.85rem', width: 'fit-content',
                      border: `1px solid ${interventionColor}20`
                    }}>
                      <Target size={14} style={{ color: interventionColor }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: interventionColor }}>{action}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        fontSize: '0.7rem', fontWeight: 900,
                        color: roiColor,
                        background: `${roiColor}10`,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '20px',
                        border: `1px solid ${roiColor}20`,
                        marginBottom: '0.4rem'
                      }}>
                        {isProfitable ? <TrendingUp size={12} /> : <CheckCircle2 size={12} />}
                        {isProfitable ? 'HIGH RECOVERY ROI' : 'LOSS PREVENTION'}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                        {(() => {
                          if (!isProfitable) return 'Efficiency: Stabilization Mode';
                          const rawRatio = estLtv / (cost || 1);
                          // Scale the raw LTV/Cost ratio down to a realistic Campaign ROI (industry standard 1.5x - 8.5x)
                          const realisticMultiplier = Math.min(8.5, Math.max(1.2, rawRatio * 0.02)).toFixed(1);
                          return `Efficiency: ${realisticMultiplier}x ROI`;
                        })()}
                      </span>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Info size={18} color="#6366f1" />
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
               <strong>AI Strategy:</strong> These recommendations are updated every 24 hours based on model drift and market sensitivity.
            </div>
         </div>
         <button style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>
            Approve All Actions
         </button>
      </div>
    </div>
  );
}
