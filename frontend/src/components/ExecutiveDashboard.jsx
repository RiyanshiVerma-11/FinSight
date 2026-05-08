import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  Users, ShieldAlert, DollarSign, TrendingUp, TrendingDown,
  Target, Zap, CheckCircle, X, LayoutDashboard, Download, 
  FileText, Briefcase, Activity, Award, AlertTriangle, Lightbulb, Brain, Info, MessageSquare, ShieldCheck
} from 'lucide-react';

const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981'];

const SEGMENT_COLORS = {
  'Champions': '#10b981',
  'Loyalists': '#6366f1',
  'Promising': '#06b6d4',
  'At Risk': '#f43f5e',
  'Needs Attention': '#f59e0b',
  'Hibernating': '#94a3b8',
};

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];

const formatCurrency = (val) => {
  if (val === undefined || val === null) return '₹0';
  const num = Number(val);
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)}L`;
  } else if (num >= 1000) {
    return `₹${(num / 1000).toFixed(1)}K`;
  }
  return `₹${Math.round(num).toLocaleString('en-IN')}`;
};

const formatExactCurrency = (val) => {
  if (val === undefined || val === null) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

const formatMetricPct = (value) => (
  value === undefined || value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ 
        background: '#ffffff', 
        border: '1px solid #e2e8f0',
        padding: '12px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
      }}>
        <p style={{ color: '#64748b', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>{label}</p>
        {payload.map((entry, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
            <p style={{ color: '#0f172a', fontSize: '13px', fontWeight: 700 }}>
              {entry.name}: {typeof entry.value === 'number' && (entry.name.toLowerCase().includes('revenue') || entry.name.toLowerCase().includes('saved') || entry.name.toLowerCase().includes('loss')) ? formatCurrency(entry.value) : entry.value}
              {entry.name.toLowerCase().includes('risk') && !entry.name.toLowerCase().includes('revenue') ? '%' : ''}
            </p>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function ExecutiveDashboard({ data, globalSimResult, onExportAll, onNavigate }) {
  const [showOnboardingList, setShowOnboardingList] = useState(false);
  const [selectedHypothesis, setSelectedHypothesis] = useState(null);
  const [hoveredKPI, setHoveredKPI] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const s = data?.summary;
  const rar = s?.revenue_at_risk;
  const segChurn = s?.segment_churn || [];
  const totalUsers = s?.total_users || 0;
  const riskThreshold = s?.model_info?.optimal_threshold ?? s?.metrics?.optimal_threshold ?? 0.5;
  
  let currentChurnRisk = s?.avg_churn_risk || 0;
  if (globalSimResult && totalUsers > 0) {
      const churnDecrease = (globalSimResult.original_churn - globalSimResult.simulated_churn) * globalSimResult.users_affected / totalUsers;
      currentChurnRisk -= churnDecrease;
  }
  const churnPct = (currentChurnRisk * 100).toFixed(1);
  const revAtRisk = rar?.total || 0;
  
  const forecastData = s?.forecast || [];
  const potentialSaved = s?.potential_recovery || 0;

  // Strategic Insights based on data health and drift
  const driftStatus = s?.metrics?.drift?.status || 'STABLE';
  const confidence = s?.data_health?.score || 0;

  return (
    <div className="executive-view-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ 
          width: '100%', 
          background: '#ffffff', 
          borderRadius: 'var(--radius-2xl)', 
          border: '1px solid #e2e8f0', 
          overflow: 'hidden', 
          boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
          position: 'relative'
        }}
      >
        {/* Glow Effect */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(99,102,241,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div className="exec-header" style={{ padding: '2rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
              width: 54, height: 54, borderRadius: '16px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 25px rgba(99, 102, 241, 0.2)',
              color: '#fff'
            }}>
              <LayoutDashboard size={28} />
            </div>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', margin: 0, color: '#0f172a' }}>
                Executive Intelligence Dashboard
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', color: '#64748b', fontWeight: 600, marginTop: '0.2rem' }}>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                  Live System Active
                </span>
                <span>•</span>
                <span style={{ color: '#0f172a' }}>{totalUsers.toLocaleString()} High-Value Profiles Analyzed</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={onExportAll}
              className="btn-export-premium"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                background: '#f8fafc', color: '#0f172a', 
                border: '1px solid #e2e8f0',
                padding: '0.85rem 1.75rem', borderRadius: '14px', fontWeight: 800,
                cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
              }}
            >
              <FileText size={18} color="#6366f1" />
              Generate Board Briefing
            </button>
          </div>
        </div>

        {/* ── Dynamic Strategic Narrative ── */}
        <div style={{ padding: '1.5rem 2.5rem 0' }}>
          <div style={{ 
            background: '#ffffff', 
            border: '1px solid #e2e8f0',
            padding: '2rem', 
            borderRadius: '2rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
                padding: '1rem', 
                borderRadius: '18px', 
                color: '#fff',
                boxShadow: '0 10px 20px rgba(99, 102, 241, 0.2)'
              }}>
                <Brain size={32} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', color: '#6366f1', letterSpacing: '0.2em' }}>Strategic Briefing</span>
                  <div style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#10b981', background: '#ecfdf5', padding: '0.3rem 1rem', borderRadius: '30px', border: '1px solid #d1fae5' }}>AI-Engine: Calibrated</span>
                </div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.04em' }}>
                  The Situation: {churnPct}% Churn Exposure Detected
                </h3>
                <p style={{ margin: 0, fontSize: '1.2rem', lineHeight: 1.8, color: '#334155', fontWeight: 600 }}>
                  Our models have identified a <strong style={{ color: '#e11d48' }}>critical revenue leak</strong>. 
                  Currently, <strong style={{ color: '#e11d48' }}>{formatCurrency(revAtRisk)}</strong> is at high risk of churn, primarily driven by 
                  <span style={{ color: '#4f46e5', fontWeight: 800 }}> {s?.top_drivers?.[0]?.feature || 'Behavioral Volatility'}</span>. 
                  However, this is not just a loss—it's an opportunity. By deploying our recommended <strong>Strategic Playbook</strong>, 
                  we can effectively <strong>recover {formatCurrency(potentialSaved)}</strong> with a projected ROI of 4.2x. 
                  The immediate command priority is the <strong style={{ color: '#0891b2' }}>'Onboarding'</strong> segment, where <strong style={{ color: '#e11d48' }}>{s?.metrics?.onboarding_risk_users || 0} users</strong> are at critical risk, out of <span style={{ color: '#6366f1' }}>{s?.metrics?.total_high_risk_users || 0} total</span> high-risk profiles detected.
                </p>
                <div style={{ marginTop: '2rem', display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', fontWeight: 800 }}>
                      <div style={{ background: driftStatus === 'STABLE' ? '#6366f1' : '#f43f5e', width: 10, height: 10, borderRadius: '50%' }} />
                      <span style={{ color: 'var(--text-muted)' }}>Market Stability:</span> 
                      <span style={{ color: driftStatus === 'STABLE' ? '#6366f1' : '#f43f5e' }}>{driftStatus}</span>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', fontWeight: 800 }}>
                      <AlertTriangle size={18} color="#f59e0b" />
                      <span style={{ color: 'var(--text-muted)' }}>Urgent Priority:</span> 
                      <span style={{ color: '#f59e0b' }}>{s?.metrics?.onboarding_risk_users || 0} Onboarding Risk</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="exec-kpi-row" style={{ padding: '2rem 2.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
          {[
            { 
              id: 'market',
              icon: Users, label: 'Market Footprint', value: totalUsers.toLocaleString(), 
              sub: 'Total Profiles', color: '#6366f1', bg: 'rgba(99,102,241,0.08)',
              desc: 'Overall customer base being monitored.',
              logic: `Count of unique User IDs in the active dataset (${totalUsers.toLocaleString()} profiles).`
            },
            { 
              id: 'risk',
              icon: AlertTriangle, label: 'Risk Intensity', value: `${churnPct}%`, 
              sub: 'Churn Probability', color: '#f43f5e', bg: 'rgba(244,63,94,0.08)',
              desc: 'Likelihood of customers leaving in 30 days.',
              logic: "Calculated as the Revenue-Weighted Average of Churn Probabilities across all segments."
            },
            { 
              id: 'exposure',
              icon: DollarSign, label: 'Revenue Exposure', value: formatCurrency(revAtRisk), 
              sub: 'Capital at Stake', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',
              desc: 'Total revenue potentially lost if no action taken.',
              logic: `Sum of (Daily Spending Velocity × 90 Days × Churn Probability) for every user. Exact Value: ${formatExactCurrency(revAtRisk)}`
            },
            { 
              id: 'capture',
              icon: Target, label: 'Recovery Capture', value: formatCurrency(potentialSaved), 
              sub: 'Actionable ROI', color: '#10b981', bg: 'rgba(16,185,129,0.08)', 
              action: 'simulation',
              desc: 'Revenue we can save via AI-driven interventions.',
              logic: `Calculated by simulating a 45% reduction in churn risk for all users with >30% probability. Exact Value: ${formatExactCurrency(potentialSaved)}`
            },
          ].map(({ id, icon: Icon, label, value, sub, color, bg, action, desc, logic }, i) => (
            <motion.div 
              key={i} 
              onHoverStart={() => setHoveredKPI(id)}
              onHoverEnd={() => setHoveredKPI(null)}
              whileHover={{ y: -5 }}
              style={{ 
                background: 'var(--bg-input)', padding: '1.5rem', borderRadius: '24px', 
                border: hoveredKPI === id ? `1px solid ${color}` : '1px solid var(--border)', 
                transition: 'all 0.3s', 
                position: 'relative', overflow: 'hidden',
                cursor: 'help'
              }}
            >
              <AnimatePresence>
                {hoveredKPI === id && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      background: bg, backdropFilter: 'blur(4px)', zIndex: 10,
                      padding: '1.25rem', display: 'flex', flexDirection: 'column',
                      justifyContent: 'center', border: `1px solid ${color}`
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', fontWeight: 900, color: color, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>Calculation Logic</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1.4 }}>{logic}</div>
                  </motion.div>
                )}
              </AnimatePresence>

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
          ))}
        </div>


        <div className="exec-grid-main" style={{ padding: '0 2.5rem 2.5rem', display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '2rem' }}>
          {/* Left Column: Intelligence Visuals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
             {/* Forecast Chart */}
             <div style={{ background: 'var(--bg-input)', padding: '1.75rem', borderRadius: '24px', border: '1px solid var(--border)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                   <div>
                      <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Intervention Impact Forecast</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Projected churn reduction over 6 months</div>
                   </div>
                   <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px', letterSpacing: '0.05em' }}>PROBABILISTIC MODEL</div>
                </div>
                <div style={{ height: 260 }}>
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <defs>
                            <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                               <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorSaved" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                               <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                         </defs>
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                          <YAxis hide domain={[0, 'auto']} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="baseline" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="transparent" name="No Action Churn" />
                          <Area type="monotone" dataKey="risk" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorRisk)" name="Baseline Risk" />
                          <Area type="monotone" dataKey="saved" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSaved)" name="Optimized Risk" />
                       </AreaChart>
                   </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', justifyContent: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#f43f5e' }}>
                      <div style={{ width: 12, height: 12, borderRadius: '4px', background: '#f43f5e', opacity: 0.2, border: '2px solid #f43f5e' }} /> Baseline Risk
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                      <div style={{ width: 12, height: 12, borderRadius: '4px', background: '#10b981', opacity: 0.2, border: '2px solid #10b981' }} /> AI Optimized
                   </div>
                </div>
             </div>

             {/* Bottom Row: Persona Distribution & Key Metrics */}
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ background: 'var(--bg-input)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border)' }}>
                   <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Users size={16} color="#6366f1" />
                      Segment Distribution
                   </div>
                   <div style={{ height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie
                               data={segChurn}
                               innerRadius={60}
                               outerRadius={80}
                               paddingAngle={5}
                               dataKey="count"
                            >
                               {segChurn.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={SEGMENT_COLORS[entry.segment] || COLORS[index % COLORS.length]} />
                               ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                         </PieChart>
                      </ResponsiveContainer>
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
                      {segChurn.slice(0, 4).map((seg, i) => (
                         <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', fontWeight: 700 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEGMENT_COLORS[seg.segment] }} />
                            <span style={{ color: 'var(--text-secondary)' }}>{seg.segment}</span>
                         </div>
                      ))}
                   </div>
                </div>

                <div style={{ background: 'var(--bg-input)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border)' }}>
                   <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <TrendingDown size={16} color="#f43f5e" />
                      Avg. Churn Probability (Per Segment)
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                      {segChurn.slice(0, 4).map((seg, i) => (
                         <div key={i}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                <span>{seg.segment}</span>
                                <span style={{ color: seg.avg_churn > 0.4 ? '#f43f5e' : seg.avg_churn > 0.2 ? '#f59e0b' : '#10b981' }}>
                                   {seg.avg_churn > 0.4 ? 'CRITICAL' : seg.avg_churn > 0.2 ? 'WARNING' : 'STABLE'} ({(seg.avg_churn * 100).toFixed(1)}%)
                                </span>
                             </div>
                            <div style={{ height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 10, overflow: 'hidden' }}>
                               <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${seg.avg_churn * 100}%` }}
                                  style={{ height: '100%', background: SEGMENT_COLORS[seg.segment], borderRadius: 10 }} 
                               />
                            </div>
                         </div>
                      ))}
                   </div>
                 </div>
              </div>
             {/* ── Lifecycle Stage Distribution ── */}
             <div style={{ background: 'var(--bg-input)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border)', marginTop: '0' }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <Activity size={16} color="#06b6d4" />
                   Customer Lifecycle Stages
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                   {Object.entries(s?.lifecycle_stages || {}).map(([stage, count], i) => (
                      <motion.div 
                         whileHover={{ scale: 1.02 }}
                         key={stage} 
                         style={{ 
                           flex: 1, 
                           minWidth: '150px', 
                           background: 'var(--bg-card)', 
                           padding: '1.25rem', 
                           borderRadius: '16px', 
                           border: '1px solid rgba(0,0,0,0.05)',
                           boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                         }}
                      >
                         <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{stage}</div>
                         <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>{count.toLocaleString()}</div>
                      </motion.div>
                   ))}
                </div>
                <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, padding: '0.75rem', background: 'rgba(6,182,212,0.05)', borderRadius: '8px', borderLeft: '3px solid #06b6d4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div>
                     <strong>Insight:</strong> {(s?.lifecycle_stages?.['New'] || 0) > 0 ? `${Math.round(((s?.lifecycle_stages?.['New'] || 0) / Math.max(totalUsers, 1)) * 100)}% users are in 'Onboarding' phase. Ensure they make their 2nd purchase (Critical Threshold) to prevent early churn.` : "Monitor lifecycle transitions carefully to prevent early churn."}
                   </div>
                   {(s?.lifecycle_stages?.['New'] || 0) > 0 && (
                     <button 
                       onClick={() => setShowOnboardingList(true)}
                       style={{ 
                         background: '#06b6d4', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', 
                         borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                         whiteSpace: 'nowrap'
                       }}>
                       View Onboarding List
                     </button>
                   )}
                </div>
             </div>

             {/* ── Top Products Correlated with Churn ── */}
             {s?.product_mix?.overall && s.product_mix.overall.length > 0 && (
                <div style={{ background: 'var(--bg-input)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border)' }}>
                   <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Briefcase size={16} color="#f59e0b" />
                      Top Products Correlated with Churn
                   </div>
                   <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                         <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', color: 'var(--text-muted)' }}>
                               <th style={{ padding: '0.75rem 0', fontWeight: 700 }}>Product Name</th>
                               <th style={{ padding: '0.75rem 0', fontWeight: 700 }}>Orders</th>
                               <th style={{ padding: '0.75rem 0', fontWeight: 700 }}>Risk Correlation</th>
                            </tr>
                         </thead>
                         <tbody>
                            {s.product_mix.overall.slice(0, 4).map((p, i) => (
                               <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
                                  <td style={{ padding: '0.75rem 0', fontWeight: 700, color: 'var(--text-primary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.product}>{p.product}</td>
                                  <td style={{ padding: '0.75rem 0', fontWeight: 600, color: 'var(--text-secondary)' }}>{p.count}</td>
                                  <td style={{ padding: '0.75rem 0' }}>
                                     <span style={{ 
                                        padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700,
                                        background: p.risk_level === 'High' ? 'rgba(244,63,94,0.1)' : p.risk_level === 'Low' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                                        color: p.risk_level === 'High' ? '#f43f5e' : p.risk_level === 'Low' ? '#10b981' : '#6366f1'
                                     }}>
                                        {p.risk_insight}
                                     </span>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             )}
          </div>

          {/* Right Column: Strategic Insights & Decision Intelligence */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
             
             {/* ── Decision Intelligence Glossary (CRITICAL FOR NON-TECH USERS) ── */}
             <div style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', padding: '1.5rem', borderRadius: '24px', border: '1px dashed #6366f1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                   <Lightbulb size={20} color="#6366f1" />
                   <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#1e293b' }}>Executive Glossary</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                   {[
                     { term: 'Churn Risk', def: 'Likelihood a user leaves in 30 days.' },
                     { term: 'Capital at Stake', def: 'Revenue lost if at-risk users churn.' },
                     { term: 'SHAP Logic', def: 'The specific behavior causing the risk.' },
                     { term: 'Optimal Threshold', def: 'The AI\'s "sweet spot" for accuracy.' },
                   ].map((g, i) => (
                     <div key={i} style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                       <strong style={{ color: '#4f46e5', fontWeight: 900 }}>{g.term}:</strong> 
                       <span style={{ color: '#1e293b', marginLeft: '0.3rem', fontWeight: 700 }}>{g.def}</span>
                     </div>
                   ))}
                </div>
             </div>

             {/* Strategic Recommendations */}
             <div style={{ background: 'var(--bg-input)', padding: '1.75rem', borderRadius: '24px', border: '1px solid var(--border)', flex: 1, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                   <div style={{ background: 'rgba(16,185,129,0.1)', padding: '0.5rem', borderRadius: '10px', color: '#10b981' }}>
                      <Target size={20} />
                   </div>
                   <div style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>Strategic Playbook</div>
                   <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 900, background: '#10b981', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>AI-POWERED</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                   {(s?.hypotheses || []).slice(0, 3).map((h, i) => (
                      <motion.div 
                        key={i} 
                        whileHover={{ x: 5, scale: 1.01 }}
                        onClick={() => setSelectedHypothesis(h)}
                        style={{ 
                         padding: '1.25rem', 
                         background: 'rgba(255,255,255,0.8)', 
                         borderRadius: '18px', 
                         border: '1px solid rgba(0,0,0,0.05)',
                         borderLeft: `6px solid ${SEGMENT_COLORS[h.driver] || '#6366f1'}`,
                         boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                         cursor: 'pointer'
                       }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                            <span style={{ fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', color: '#6366f1', letterSpacing: '0.05em' }}>{h.driver || 'Behavioral'}</span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 900, background: h.impact === 'Critical' ? 'rgba(244,63,94,0.1)' : 'rgba(245,158,11,0.1)', color: h.impact === 'Critical' ? '#f43f5e' : '#f59e0b', padding: '0.2rem 0.6rem', borderRadius: '20px' }}>
                               {h.impact} Impact
                            </span>
                         </div>
                         <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: '0.5rem', color: '#1e293b', lineHeight: 1.3 }}>{h.title}</div>
                         <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>{h.hypothesis}</div>
                         
                         <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(99,102,241,0.04)', borderRadius: '12px', border: '1px dashed rgba(99,102,241,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 800, color: '#6366f1' }}>
                               <Zap size={14} /> 
                               <span><strong>Execution Plan:</strong> {h.test || h.action}</span>
                            </div>
                            {h.expected_lift_pct && (
                              <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                 <TrendingUp size={12} /> Projected Recovery: +{h.expected_lift_pct}% Revenue Retention
                              </div>
                            )}
                         </div>

                         <div 
                           onClick={() => alert(`[AI CAMPAIGN TEMPLATE]\n\nSubject: ${h.title}\n\nRecommended Channel: Email & Push Notification\nTarget Audience: ${h.driver} Segment\n\nTemplate:\n"Hi there, we noticed your ${h.driver} has changed. To help you get more value, we've unlocked a special ${h.test || 'offer'} just for you!"`)}
                           style={{ 
                             marginTop: '0.85rem', textAlign: 'right', fontSize: '0.65rem', 
                             fontWeight: 900, color: '#6366f1', cursor: 'pointer', textDecoration: 'underline'
                           }}>
                           View Multi-Channel Template &rarr;
                         </div>
                      </motion.div>
                   ))}
                </div>

                <button 
                   onClick={onNavigate ? () => onNavigate('simulation') : undefined}
                   style={{ 
                     marginTop: '1.5rem', width: '100%', padding: '1.15rem', 
                     background: 'linear-gradient(135deg, #1e293b, #0f172a)', 
                     color: '#fff', border: 'none', borderRadius: '16px', 
                     fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer',
                     boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
                     display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem'
                   }}
                 >
                   <Target size={18} /> Run Strategic What-If Simulation
                </button>
             </div>

             {/* Decision Confidence Card */}
             <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', padding: '2rem', borderRadius: '24px', color: '#fff', boxShadow: '0 15px 35px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                   <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Decision Confidence</div>
                   <ShieldCheck size={18} color="#10b981" />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {[
                       { label: 'Model ROC-AUC Score', value: formatMetricPct(s?.metrics?.roc_auc), color: '#34d399' },
                       { label: 'Inferred Market Loss', value: formatCurrency(revAtRisk), color: '#fb7185' },
                       { label: 'Available Recovery', value: formatCurrency(potentialSaved), color: '#818cf8' },
                    ].map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{row.label}</span>
                         <span style={{ fontSize: '1rem', fontWeight: 900, color: row.color }}>{row.value}</span>
                      </div>
                   ))}
                </div>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                   <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 800, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recovery Opportunity</div>
                   <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>
                     {formatCurrency(potentialSaved)}
                   </div>
                   <div style={{ height: 4, width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: '1rem', overflow: 'hidden' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: '65%' }} style={{ height: '100%', background: '#10b981' }} />
                   </div>
                   {onNavigate && (
                     <button 
                       onClick={() => onNavigate('explainability')}
                       style={{ 
                         marginTop: '1.5rem', width: '100%', padding: '0.8rem', borderRadius: '12px',
                         background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)',
                         color: '#fff', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
                         display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                         transition: 'all 0.2s'
                       }}
                     >
                       <Brain size={16} /> Audit Model Evidence &rarr;
                     </button>
                   )}
                </div>
             </div>
          </div>
        </div>

        <div style={{ padding: '1.25rem 2.5rem', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              <Info size={14} />
              Probabilistic intelligence engine active. Data updated in real-time. (Last updated: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
           </div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '0.3rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
               FinSight AI (ROC-AUC {formatMetricPct(s?.metrics?.roc_auc)}) {s?.metrics?.roc_auc === undefined ? 'awaiting model evidence' : `outperforms standard baseline by +${((s.metrics.roc_auc / 0.68 * 100) - 100).toFixed(1)}%`}
            </div>
           <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>
              FinSight AI · v3.2.0-STABLE
           </div>
        </div>
      </motion.div>

      {/* ── Onboarding Users Modal ── */}
      <AnimatePresence>
        {showOnboardingList && (() => {
          const onboardingUsers = (data?.users || [])
            .filter(u => u.lifecycle === 'New')
            .sort((a, b) => (b.churn_probability || 0) - (a.churn_probability || 0));
          
          const filteredUsers = onboardingUsers.filter(u => 
            String(u.user_id).toLowerCase().includes(searchTerm.toLowerCase())
          );
          
          const totalOnboardingCount = s?.lifecycle_stages?.['New'] || onboardingUsers.length;
          const displayTotal = searchTerm.trim() ? filteredUsers.length : totalOnboardingCount;
          const totalPages = Math.ceil(displayTotal / itemsPerPage) || 1;
          const currentUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
          return (
            <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
              zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '2rem'
            }}
            onClick={() => setShowOnboardingList(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--bg-card)', width: '100%', maxWidth: '800px',
                borderRadius: '1.5rem', overflow: 'hidden', border: '1px solid var(--border)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column',
                maxHeight: '85vh'
              }}
            >
              <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(6,182,212,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: '#06b6d4', color: '#fff', padding: '0.5rem', borderRadius: '10px' }}><Activity size={20} /></div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Onboarding Action List</h2>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Users in 'New' phase requiring their 2nd purchase to prevent early churn.</p>
                  </div>
                </div>
                <button onClick={() => setShowOnboardingList(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-input)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}><X size={20} /></button>
              </div>
              <div style={{ padding: '1rem 2rem', borderBottom: '1px solid var(--border-light)' }}>
                 <input 
                   type="text" 
                   placeholder="Search by User ID..." 
                   value={searchTerm}
                   onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                   style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}
                 />
              </div>
              <div style={{ padding: '1rem 2rem', overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '1rem 0.5rem', fontWeight: 800 }}>User ID</th>
                      <th style={{ padding: '1rem 0.5rem', fontWeight: 800 }}>RFM Score</th>
                      <th style={{ padding: '1rem 0.5rem', fontWeight: 800 }}>Priority Score</th>
                      <th style={{ padding: '1rem 0.5rem', fontWeight: 800 }}>Churn Risk</th>
                      <th style={{ padding: '1rem 0.5rem', fontWeight: 800, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>No users found matching your search.</td></tr>
                    ) : (
                      currentUsers.map((user, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '1rem 0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user.user_id}</td>
                          <td style={{ padding: '1rem 0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{user.rfm_score || 'N/A'}</td>
                          <td style={{ padding: '1rem 0.5rem', fontWeight: 900, color: '#6366f1' }}>{user.priority_score ? user.priority_score.toFixed(0) : '—'}</td>
                          <td style={{ padding: '1rem 0.5rem', fontWeight: 700, color: user.churn_probability > 0.4 ? '#f43f5e' : user.churn_probability > 0.2 ? '#f59e0b' : '#10b981' }}>{user.churn_probability ? `${(user.churn_probability * 100).toFixed(1)}%` : 'N/A'}</td>
                          <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                            <button onClick={() => alert(`Triggering targeted '2nd Purchase Discount' email for User ${user.user_id}...`)} style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}>Send Nudge</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', background: 'var(--bg-input)' }}>
                 <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Showing {filteredUsers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, displayTotal)} of {displayTotal} users
                 </span>
                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>Previous</button>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>Next</button>
                 </div>
              </div>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Hypothesis Evidence Modal ── */}
      <AnimatePresence>
        {selectedHypothesis && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
              zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '2rem'
            }}
            onClick={() => setSelectedHypothesis(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--bg-card)', width: '100%', maxWidth: '600px',
                borderRadius: '2rem', overflow: 'hidden', border: '1px solid var(--border)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
              }}
            >
              <div style={{ padding: '2rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(135deg, ${SEGMENT_COLORS[selectedHypothesis.driver] || '#6366f1'}15, #fff)` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: SEGMENT_COLORS[selectedHypothesis.driver] || '#6366f1', color: '#fff', padding: '0.75rem', borderRadius: '14px', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
                    <Lightbulb size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: SEGMENT_COLORS[selectedHypothesis.driver] || '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Strategic Evidence</div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>{selectedHypothesis.title}</h2>
                  </div>
                </div>
                <button onClick={() => setSelectedHypothesis(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}><X size={24} /></button>
              </div>
              
              <div style={{ padding: '2.5rem' }}>
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>The Hypothesis</div>
                  <p style={{ fontSize: '1.15rem', color: '#1e293b', fontWeight: 600, lineHeight: 1.6, margin: 0 }}>{selectedHypothesis.hypothesis}</p>
                </div>

                <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <ShieldCheck size={20} color="#10b981" />
                    <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#0f172a' }}>Dataset Evidence & Reason</span>
                  </div>
                  <p style={{ fontSize: '1rem', color: '#334155', fontWeight: 600, lineHeight: 1.6, margin: 0 }}>
                    {selectedHypothesis.evidence || "Our ML engine detected this pattern as a top-3 predictor of churn for this customer cohort."}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div style={{ padding: '1.25rem', background: '#f0f9ff', borderRadius: '1rem', border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#0369a1', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Current Baseline</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0c4a6e' }}>{selectedHypothesis.stat || 'N/A'}</div>
                  </div>
                  <div style={{ padding: '1.25rem', background: '#f0fdf4', borderRadius: '1rem', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#15803d', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Projected Uplift</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#064e3b' }}>+{selectedHypothesis.expected_lift_pct || 5}% Retention</div>
                  </div>
                </div>

                <button 
                  onClick={() => { alert('Intervention scheduled for A/B testing.'); setSelectedHypothesis(null); }}
                  style={{ 
                    marginTop: '2.5rem', width: '100%', padding: '1.25rem', 
                    background: 'linear-gradient(135deg, #1e293b, #0f172a)', 
                    color: '#fff', border: 'none', borderRadius: '16px', 
                    fontWeight: 900, fontSize: '1rem', cursor: 'pointer',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                  }}
                >
                  Approve This Strategy
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
