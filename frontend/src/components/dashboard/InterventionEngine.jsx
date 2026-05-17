import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Target, Zap, RefreshCw, TrendingUp, ShieldAlert, CheckCircle2, Info } from 'lucide-react';
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
  }
};

const SEGMENT_COLORS = {
  'Champions': '#10b981',
  'Loyalists': '#6366f1',
  'Promising': '#06b6d4',
  'At Risk': '#f43f5e',
  'Hibernating': '#94a3b8',
  'Needs Attention': '#f59e0b',
  'New': '#8b5cf6',
};

export default function InterventionEngine({ segments, segChurn, metrics, domain }) {
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
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                <FormulaTooltip formula="Σ(Segment Churn % × Segment LTV × Segment Population)" color="#f59e0b">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'help' }}>
                    Business Impact <Info size={12} />
                  </div>
                </FormulaTooltip>
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Recommended Action</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                <FormulaTooltip formula="(LTV / Cost) × (Model Accuracy Multiplier)" color="#10b981">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'help' }}>
                    Recovery ROI <Info size={12} />
                  </div>
                </FormulaTooltip>
              </th>
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
              const personaName = PERSONA_DEFINITIONS[seg]?.label || seg;

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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontWeight: 900, color: '#1e293b', fontSize: '0.95rem' }}>{personaName}</span>
                        <FormulaTooltip formula={PERSONA_DEFINITIONS[seg]?.[domain] || PERSONA_DEFINITIONS[seg]?.description || "Strategic segment based on user behavior."}>
                          <Info size={12} style={{ color: '#94a3b8', cursor: 'help' }} />
                        </FormulaTooltip>
                      </div>
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
                          const auc = metrics?.roc_auc || 0.75;
                          const rawRatio = estLtv / (cost || 1);
                          // Grounded Campaign ROI: Based on LTV/Cost ratio and model precision (AUC)
                          // Accurate models yield higher targeting efficiency (fewer false positives)
                          const realisticMultiplier = Math.min(8.5, Math.max(1.2, rawRatio * (auc * 0.08))).toFixed(1);
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
               <strong>AI Strategy:</strong> These recommendations are generated dynamically based on real-time model analysis and market sensitivity.
            </div>
         </div>
         <button style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>
            Approve All Actions
         </button>
      </div>
    </div>
  );
}
