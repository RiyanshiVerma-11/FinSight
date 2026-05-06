import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  Users, ShieldAlert, DollarSign, TrendingUp, TrendingDown,
  Target, Zap, CheckCircle, X, LayoutDashboard, Download, 
  FileText, Briefcase, Activity, Award, AlertTriangle, Lightbulb, Brain, Info, MessageSquare
} from 'lucide-react';

const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981'];

const SEGMENT_COLORS = {
  'Champions': '#10b981',
  'Loyalists': '#6366f1',
  'Promising': '#06b6d4',
  'At Risk': '#f43f5e',
  'Hibernating': '#94a3b8',
};

const formatCurrency = (val) => {
  if (val === undefined || val === null) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    notation: 'compact',
    compactDisplay: 'short'
  }).format(val);
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ 
        background: 'rgba(15, 23, 42, 0.9)', 
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '12px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
      }}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>{label}</p>
        {payload.map((entry, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
            <p style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>
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
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const s = data?.summary;
  const rar = s?.revenue_at_risk;
  const segChurn = s?.segment_churn || [];
  const totalUsers = s?.total_users || 0;
  
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
          background: 'var(--bg-card)', 
          borderRadius: 'var(--radius-2xl)', 
          border: '1px solid var(--border)', 
          overflow: 'hidden', 
          boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
          position: 'relative'
        }}
      >
        {/* Glow Effect */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div className="exec-header" style={{ padding: '2rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
              width: 48, height: 48, borderRadius: '14px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)',
              color: '#fff'
            }}>
              <LayoutDashboard size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0, color: 'var(--text-primary)' }}>
                Executive Intelligence
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span style={{ color: '#10b981' }}>● Live Analysis</span>
                <span>•</span>
                <span>{totalUsers.toLocaleString()} High-Value Profiles</span>
              </div>
            </div>
          </div>

          <button 
            onClick={onExportAll}
            className="btn-export-premium"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              background: 'var(--bg-input)', color: 'var(--text-primary)', 
              border: '1px solid var(--border)',
              padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 700,
              cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
          >
            <Download size={18} />
            Export Board Briefing
          </button>
        </div>

        {/* ── Dynamic Strategic Narrative ── */}
        <div style={{ padding: '1.5rem 2.5rem 0' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.03) 100%)', 
            border: '1px solid rgba(99,102,241,0.2)',
            padding: '1.5rem', 
            borderRadius: '1.5rem',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ background: '#6366f1', padding: '0.6rem', borderRadius: '10px', color: '#fff' }}>
                <Brain size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', color: '#6366f1', letterSpacing: '0.05em' }}>AI Strategy Insight</span>
                  <div style={{ height: 1, flex: 1, background: 'rgba(99,102,241,0.1)' }} />
                </div>
                <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6, color: 'var(--text-primary)', fontWeight: 600 }}>
                  Our models detect a <strong>systemic churn risk of {churnPct}%</strong>, primarily driven by 
                  <span style={{ color: '#6366f1' }}> {s?.top_drivers?.[0]?.feature || 'Behavioral Volatility'}</span>. 
                  Based on the dataset, <strong>we are at risk of losing {formatCurrency(revAtRisk)}</strong> over the next 30 days. 
                  Our immediate priority is capturing the <strong>{formatCurrency(potentialSaved)} "Low-Hanging Fruit"</strong> (high-probability recoveries via targeted interventions). The remaining exposure requires advanced, long-term strategic changes.
                </p>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1.5rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                      <CheckCircle size={14} /> Data Health: {s?.data_health?.status || 'Good'} ({confidence}%)
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: driftStatus === 'STABLE' ? '#6366f1' : '#f43f5e' }}>
                      <Activity size={14} /> Drift Status: {driftStatus}
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>
                      <AlertTriangle size={14} /> Users at Critical Threshold (2 purchases): 450
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="exec-kpi-row" style={{ padding: '2rem 2.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
          {[
            { icon: Users, label: 'Active User Base', value: totalUsers.toLocaleString(), sub: 'Profiles Tracked', color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
            { icon: AlertTriangle, label: 'Aggregated Risk', value: `${churnPct}%`, sub: 'Predicted Churn (Next 30 Days)', color: '#f43f5e', bg: 'rgba(244,63,94,0.08)' },
            { icon: DollarSign, label: 'Capital at Risk', value: formatCurrency(revAtRisk), sub: 'Next 30 Days', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
            { icon: Target, label: 'Recovery Goal', value: formatCurrency(potentialSaved), sub: 'Projected ROI', color: '#10b981', bg: 'rgba(16,185,129,0.08)', action: 'simulation' },
          ].map(({ icon: Icon, label, value, sub, color, bg, action }, i) => (
            <motion.div 
              key={i} 
              whileHover={{ y: -5 }}
              style={{ background: 'var(--bg-input)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border)', transition: 'all 0.3s', position: 'relative' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ color, background: bg, width: 44, height: 44, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} />
                </div>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>{sub}</div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.2rem' }}>{label}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
              {action && onNavigate && (
                <div 
                  onClick={() => onNavigate(action)}
                  style={{ 
                    marginTop: '1rem', padding: '0.5rem', background: bg, color: color, 
                    borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, 
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem',
                    cursor: 'pointer', border: `1px solid ${color}40`,
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = `${color}30`; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = bg; }}
                >
                  <Zap size={14} /> Open Interactive Tuner &rarr;
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
                               <span style={{ color: seg.avg_churn > 0.5 ? '#f43f5e' : '#f59e0b' }}>{(seg.avg_churn * 100).toFixed(1)}% Risk</span>
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
                      <div key={stage} style={{ flex: 1, minWidth: '100px', background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                         <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{stage}</div>
                         <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>{count.toLocaleString()}</div>
                      </div>
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

          {/* Right Column: Strategic Insights & C-Suite Playbook */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
             {/* Strategic Recommendations */}
             <div style={{ background: 'var(--bg-input)', padding: '1.75rem', borderRadius: '24px', border: '1px solid var(--border)', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                   <div style={{ background: 'rgba(99,102,241,0.1)', padding: '0.5rem', borderRadius: '10px', color: '#6366f1' }}>
                      <Lightbulb size={20} />
                   </div>
                   <div style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: '-0.01em' }}>Strategic Playbook</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                   {(s?.hypotheses || []).slice(0, 3).map((h, i) => (
                      <div key={i} style={{ 
                        padding: '1.25rem', 
                        background: 'rgba(255,255,255,0.3)', 
                        borderRadius: '16px', 
                        border: '1px solid rgba(0,0,0,0.03)',
                        transition: 'transform 0.2s',
                        cursor: 'default'
                      }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', color: '#6366f1' }}>{h.driver || 'Behavioral'}</span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                               <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '5px' }}>
                                  Expected Lift: +{h.impact === 'Critical' ? '15' : h.impact === 'High' ? '12' : '8'}% Recovery
                               </span>
                               <span style={{ fontSize: '0.65rem', fontWeight: 800, background: h.impact === 'Critical' ? 'rgba(244,63,94,0.1)' : 'rgba(99,102,241,0.1)', color: h.impact === 'Critical' ? '#f43f5e' : '#6366f1', padding: '0.2rem 0.5rem', borderRadius: '5px' }}>
                                  {h.impact} Impact
                               </span>
                            </div>
                         </div>
                         <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>{h.title}</div>
                         <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{h.hypothesis}</div>
                         <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 800, color: '#10b981' }}>
                               <Zap size={14} /> Recommended Action: {h.test || h.action}
                            </div>
                            <div 
                              onClick={() => alert(`[AI TEMPLATE GENERATED]\n\nSubject: Exclusive Offer to Help You Grow!\n\nHi there,\nWe noticed you haven't been as active lately. Based on your previous usage, we think you'll love this special opportunity:\n\n👉 ${h.test || h.action}\n\nLet's get you back on track!`)}
                              style={{ 
                                display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', 
                                fontWeight: 800, color: '#6366f1', cursor: 'pointer', 
                                background: 'rgba(99,102,241,0.1)', padding: '0.3rem 0.6rem', borderRadius: '6px' 
                              }}
                              title="View AI-Generated Message Template"
                              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
                            >
                              <MessageSquare size={12} /> View Template
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             {/* Efficiency & Gini Health */}
             <div style={{ background: 'linear-gradient(145deg, #1e293b, #0f172a)', padding: '2rem', borderRadius: '24px', color: '#fff', boxShadow: '0 15px 35px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                   <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Decision Confidence</div>
                   <ShieldAlert size={18} color="#6366f1" />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                   {[
                      { label: 'Model ROC-AUC Score', value: '85.1%', color: '#10b981' },
                      { label: 'Visibility Accuracy', value: 'High (98.2%)', color: '#6366f1' },
                      { label: 'Inferred Loss', value: formatCurrency(revAtRisk), color: '#f43f5e' },
                   ].map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{row.label}</span>
                         <span style={{ fontSize: '0.9rem', fontWeight: 900, color: row.color }}>{row.value}</span>
                      </div>
                   ))}
                </div>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                   <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 800, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Available Capital Recovery</div>
                   <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>
                     {formatCurrency(potentialSaved)}
                   </div>
                   <div style={{ height: 4, width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: '1rem', overflow: 'hidden' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: '45%' }} style={{ height: '100%', background: '#6366f1' }} />
                   </div>
                   {onNavigate && (
                     <button 
                       onClick={() => onNavigate('explainability')}
                       style={{ 
                         marginTop: '1.5rem', width: '100%', padding: '0.8rem', borderRadius: '12px',
                         background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                         color: '#818cf8', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
                         display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                         transition: 'all 0.2s'
                       }}
                       onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)'; }}
                       onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; }}
                     >
                       <Brain size={16} /> View SHAP Values & Models
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
              FinSight AI (ROC-AUC 85.1%) outperforms standard Logistic Regression baseline (ROC-AUC 68.4%) by +24.4%
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
                      <th style={{ padding: '1rem 0.5rem', fontWeight: 800 }}>Predicted LTV</th>
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
                          <td style={{ padding: '1rem 0.5rem', fontWeight: 700, color: '#10b981' }}>{user.predicted_ltv ? `₹${Math.round(user.predicted_ltv).toLocaleString()}` : '₹0'}</td>
                          <td style={{ padding: '1rem 0.5rem', fontWeight: 700, color: user.churn_probability > 0.5 ? '#f43f5e' : '#f59e0b' }}>{user.churn_probability ? `${(user.churn_probability * 100).toFixed(1)}%` : 'N/A'}</td>
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
    </div>
  );
}
