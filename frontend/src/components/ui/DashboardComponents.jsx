import React from 'react';
import { motion } from 'framer-motion';
import FormulaTooltip from './FormulaTooltip';

export const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  
  const formatCurrency = (val) => {
    try {
      if (val === undefined || val === null) return '₹0';
      let num = typeof val === 'object' && val !== null ? Number(val.value ?? val.total ?? val.amount ?? 0) : Number(val);
      if (isNaN(num) || !isFinite(num)) return '₹0';
      if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
      else if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
      else if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
      return `₹${Math.round(num).toLocaleString('en-IN')}`;
    } catch (e) {
      return '₹0';
    }
  };

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '0.75rem 1rem',
      boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
      fontSize: '0.85rem'
    }}>
      <p style={{ fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontSize: '10px', marginBottom: 6, letterSpacing: '0.05em' }}>{label}</p>
      {payload.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color }} />
          <p style={{ color: '#fff', fontWeight: 700 }}>
            {e.name}: {typeof e.value === 'number' && (e.name?.toLowerCase().includes('revenue') || e.name?.toLowerCase().includes('amount') || e.name?.toLowerCase().includes('risk') && e.value > 100) ? formatCurrency(e.value) : (e.value?.toLocaleString() ?? '0')}
          </p>
        </div>
      ))}
      {payload[0]?.payload?.risk_insight && (
        <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, color: payload[0].payload.risk_level === 'High' ? '#f43f5e' : payload[0].payload.risk_level === 'Low' ? '#10b981' : '#94a3b8' }}>
            {payload[0].payload.risk_insight}
          </p>
        </div>
      )}
    </div>
  );
};

export const StatCard = ({ icon: Icon, iconClass, cardClass = '', label, value, trend, trendClass, trendIcon: TrendIcon, delay = 0, className = "", logic }) => (
  <FormulaTooltip formula={logic} color={cardClass.includes('indigo') ? '#6366f1' : cardClass.includes('rose') ? '#f43f5e' : cardClass.includes('cyan') ? '#06b6d4' : '#f59e0b'}>
    <motion.div className={`card stat-card ${cardClass} ${className}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.4 }}
      style={{ position: 'relative', cursor: logic ? 'help' : 'default', height: '100%' }}
    >
      <div className={`stat-icon ${iconClass}`}><Icon size={22} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className={`stat-trend ${trendClass}`}><TrendIcon size={14} />{trend}</div>
    </motion.div>
  </FormulaTooltip>
);

export const Section = ({ children, span = 12, delay = 0, style = {}, className = "", initial = { opacity: 0 } }) => (
  <motion.div className={`card ${className}`} style={{ gridColumn: `span ${span}`, ...style }}
    initial={initial} animate={{ opacity: 1 }} transition={{ delay, duration: 0.4 }}>
    {children}
  </motion.div>
);
