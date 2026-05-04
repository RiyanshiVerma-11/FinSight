import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ShieldAlert, DollarSign, TrendingUp, TrendingDown,
  Target, Zap, CheckCircle, X, LayoutDashboard
} from 'lucide-react';

const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981'];

export default function ExecutiveDashboard({ data, onClose }) {
  const s = data?.summary;
  const rar = s?.revenue_at_risk;
  const segChurn = s?.segment_churn || [];
  const totalUsers = s?.total_users || 0;
  const churnPct = ((s?.avg_churn_risk || 0) * 100).toFixed(1);
  const revAtRisk = rar?.total || 0;
  const highRiskUsers = data?.users?.filter(u => u.churn_probability > 0.7).length || 0;

  // Estimated revenue saved if top risk segment is fixed
  const topSegChurn = segChurn[0];
  const potentialSaved = topSegChurn
    ? Math.round((topSegChurn.avg_churn || 0) * 0.3 * revAtRisk)
    : Math.round(revAtRisk * 0.28);

  const topDriver = s?.top_drivers?.[0];
  const topAction = topDriver
    ? `Reduce ${topDriver.feature} deviation → Send targeted campaign`
    : 'Launch re-engagement campaign for high-risk segment';

  const beforeAfter = [
    { label: 'Segmentation', before: '❌ None', after: '✅ Dynamic RFM' },
    { label: 'Campaigns', before: '🎯 Blind', after: '🎯 Targeted' },
    { label: 'Churn Visibility', before: '❌ Unknown', after: `✅ ${churnPct}% tracked` },
    { label: 'Revenue Loss', before: '💸 Unmeasured', after: `💰 $${revAtRisk.toLocaleString()} mapped` },
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="exec-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="exec-modal"
          initial={{ scale: 0.92, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        >
          {/* Header */}
          <div className="exec-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="exec-logo-icon"><LayoutDashboard size={20} /></div>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  Executive Dashboard
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                  FinSight v3.0 · Real-time Intelligence
                </div>
              </div>
            </div>
            <button className="exec-close-btn" onClick={onClose}><X size={18} /></button>
          </div>

          {/* KPI Row */}
          <div className="exec-kpi-row">
            {[
              { icon: Users, label: 'Total Users', value: totalUsers.toLocaleString(), color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
              { icon: ShieldAlert, label: 'Avg Churn Risk', value: `${churnPct}%`, color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
              { icon: DollarSign, label: 'Revenue at Risk', value: `$${revAtRisk.toLocaleString()}`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
              { icon: TrendingUp, label: 'Potential Saved', value: `$${potentialSaved.toLocaleString()}`, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
            ].map(({ icon: Icon, label, value, color, bg }, i) => (
              <motion.div
                key={i}
                className="exec-kpi-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="exec-kpi-icon" style={{ background: bg, color }}><Icon size={20} /></div>
                <div className="exec-kpi-label">{label}</div>
                <div className="exec-kpi-value" style={{ color }}>{value}</div>
              </motion.div>
            ))}
          </div>

          <div className="exec-body">
            {/* Before vs After */}
            <div className="exec-section">
              <div className="exec-section-title">Without vs With FinSight</div>
              <div className="exec-bva-grid">
                {beforeAfter.map((row, i) => (
                  <motion.div
                    key={i}
                    className="exec-bva-row"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.06 }}
                  >
                    <div className="exec-bva-label">{row.label}</div>
                    <div className="exec-bva-before">{row.before}</div>
                    <div className="exec-bva-arrow">→</div>
                    <div className="exec-bva-after">{row.after}</div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Top Action */}
            <div className="exec-section">
              <div className="exec-section-title">🔥 Top Priority Action</div>
              <div className="exec-action-card">
                <Zap size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{topAction}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Estimated impact: <strong style={{ color: '#10b981' }}>${potentialSaved.toLocaleString()} saved</strong> · {highRiskUsers} critical users
                  </div>
                </div>
              </div>
            </div>

            {/* Churn by segment mini */}
            <div className="exec-section">
              <div className="exec-section-title">⚡ Churn by Segment</div>
              <div className="exec-seg-list">
                {segChurn.slice(0, 5).map((seg, i) => (
                  <div key={i} className="exec-seg-row">
                    <span className="exec-seg-name">{seg.segment}</span>
                    <div className="exec-seg-track">
                      <motion.div
                        className="exec-seg-fill"
                        style={{ background: COLORS[i % COLORS.length] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(seg.avg_churn * 100).toFixed(0)}%` }}
                        transition={{ delay: 0.3 + i * 0.07, duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="exec-seg-val">{(seg.avg_churn * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
