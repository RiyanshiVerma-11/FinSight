import React from 'react';
import { motion } from 'framer-motion';
import { Users, AlertTriangle, Target, DollarSign, Zap } from 'lucide-react';
import FormulaTooltip from '../ui/FormulaTooltip';

const formatCurrency = (val) => {
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

export default function MetricCards({ totalUsers, churnPct, revenueWeightedPct, revAtRisk, potentialSaved, onNavigate, domain = 'generic' }) {
  const isTax = domain === 'tax';
  const projectionDays = isTax ? 365 : 90;

  return (
    <div className="exec-kpi-row" style={{ padding: '2rem 2.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
      {[
        { 
          id: 'market',
          icon: Users, label: 'Market Footprint', value: totalUsers.toLocaleString(), 
          sub: 'Total Profiles', color: '#6366f1', bg: 'rgba(99,102,241,0.08)',
          desc: 'Overall customer base being monitored.',
          logic: `Computed from: Count of unique User IDs in the active dataset (${totalUsers.toLocaleString()} profiles).`
        },
        { 
          id: 'risk',
          icon: AlertTriangle, label: 'Baseline Churn Risk', value: `${churnPct}%`, 
          sub: 'Unweighted Mean', color: '#f43f5e', bg: 'rgba(244,63,94,0.08)',
          desc: `Average churn probability across all ${totalUsers} users. Revenue-weighted: ${revenueWeightedPct}%.`,
          logic: `[WHY THIS MATTERS]: This is the primary indicator of your overall churn rate. It represents the probability that any given customer will leave in the next 30-180 days. [CALCULATION]: Mean(All User Churn Probabilities).`
        },
        { 
          id: 'exposure',
          icon: DollarSign, label: 'Revenue Exposure', value: formatCurrency(revAtRisk), 
          sub: `${projectionDays}-Day Forward Projection`, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',
          desc: `Total estimated revenue at risk over a ${projectionDays}-day forecast horizon.`,
          logic: `[WHY THIS MATTERS]: This turns "risk percentages" into real money. It helps you prioritize high-value users who are at risk. [CALCULATION]: Σ(Spending Velocity × ${projectionDays}-Day Forward Projection × Churn Prob).`
        },
        { 
          id: 'capture',
          icon: Target, label: 'Recovery Capture', value: formatCurrency(potentialSaved), 
          sub: 'Actionable ROI', color: '#10b981', bg: 'rgba(16,185,129,0.08)', 
          action: 'simulation',
          desc: 'Revenue we can save via AI-driven interventions.',
          logic: `[WHY THIS MATTERS]: This is your goal. It represents how much money you can "claw back" by running the recommended campaigns. [CALCULATION]: (Revenue Exposure) × (AI Model Accuracy × 0.5).`
        },
      ].map(({ id, icon: Icon, label, value, sub, color, bg, action, desc, logic }, i) => (
        <FormulaTooltip 
          key={i} 
          formula={logic} 
          color={color}
          align={i === 0 ? 'left' : i === 3 ? 'right' : 'center'}
        >
          <motion.div 
            whileHover={{ y: -5 }}
            style={{ 
              background: 'var(--bg-input)', padding: '1.5rem', borderRadius: '24px', 
              border: '1px solid var(--border)', 
              transition: 'all 0.3s', 
              position: 'relative', overflow: 'hidden',
              cursor: 'help',
              height: '100%'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ color, background: bg, width: 44, height: 44, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={22} />
              </div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{sub}</div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.2rem' }}>{label}</div>
            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{value}</div>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.4 }}>{desc}</p>
            {action && onNavigate && (
              <div 
                onClick={(e) => { e.stopPropagation(); onNavigate(action); }}
                style={{ 
                  marginTop: '1.25rem', padding: '0.6rem', background: bg, color: color, 
                  borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, 
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                  cursor: 'pointer', border: `1px solid ${color}30`,
                  transition: 'all 0.2s',
                  boxShadow: `0 4px 12px ${color}15`
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = `${color}25`; }}
                onMouseOut={(e) => { e.currentTarget.style.background = bg; }}
              >
                <Zap size={14} /> Open Decision Tuner &rarr;
              </div>
            )}
          </motion.div>
        </FormulaTooltip>
      ))}
    </div>
  );
}
