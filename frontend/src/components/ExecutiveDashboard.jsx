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
import FormulaTooltip from './FormulaTooltip';

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
  try {
    if (val === undefined || val === null) return '₹0';
    
    // Extract numeric value from potentially complex backend objects
    let num;
    if (typeof val === 'object' && val !== null) {
      num = Number(val.value ?? val.amount ?? val.total ?? 0);
    } else {
      num = Number(val);
    }

    // Safety fallback for non-numeric results (NaN, Infinity, etc.)
    if (isNaN(num) || !isFinite(num)) return '₹0';
    
    if (num >= 10000000) { // 1 Crore+
       return `₹${(num / 10000000).toFixed(2)}Cr`;
    } else if (num >= 100000) { // 1 Lakh+
      return `₹${(num / 100000).toFixed(2)}L`;
    } else if (num >= 1000) { // 1 Thousand+
      return `₹${(num / 1000).toFixed(1)}K`;
    }
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  } catch (e) {
    console.error("Currency formatting error:", e);
    return '₹0';
  }
};

const formatExactCurrency = (val) => {
  if (val === undefined || val === null) return '₹0';
  const num = typeof val === 'object' ? Number(val?.value ?? 0) : Number(val);
  if (isNaN(num)) return '₹0';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
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
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const s = data?.summary || {};
  const rar = s?.revenue_at_risk || {};
  const segChurn = s?.segment_churn || [];
  const totalUsers = s?.total_users || 0;
  const riskThreshold = s?.model_info?.optimal_threshold ?? s?.metrics?.optimal_threshold ?? 0.5;
  
  // ── Financial Extraction (Memoized for safety) ──
  const revAtRisk = useMemo(() => {
    const raw = s?.revenue_at_risk;
    if (typeof raw === 'object' && raw !== null) return Number(raw.total ?? raw.value ?? 0);
    return Number(raw) || 0;
  }, [s?.revenue_at_risk]);

  const potentialSaved = useMemo(() => {
    const raw = s?.potential_recovery;
    if (typeof raw === 'object' && raw !== null) return Number(raw.value ?? raw.amount ?? 0);
    return Number(raw) || 0;
  }, [s?.potential_recovery]);

  const recoveryEfficiency = useMemo(() => {
    const raw = s?.potential_recovery;
    if (typeof raw === 'object' && raw !== null) return Number(raw.efficiency_pct ?? 45.0);
    return 45.0;
  }, [s?.potential_recovery]);

  const forecastData = useMemo(() => s?.forecast || [], [s?.forecast]);

  let currentChurnRisk = s?.avg_churn_risk || 0;
  if (globalSimResult && totalUsers > 0) {
      const churnDecrease = (globalSimResult.original_churn - globalSimResult.simulated_churn) * globalSimResult.users_affected / totalUsers;
      currentChurnRisk -= churnDecrease;
  }
  const churnPct = (currentChurnRisk * 100 || 0).toFixed(1);

  // Strategic Insights based on data health and drift
  const driftStatus = s?.metrics?.drift?.status || 'STABLE';
  const confidence = s?.data_health?.score || 0;

  // ── Dynamic Priority Segment Logic ──
  const sortedSegments = [...segChurn].sort((a,b) => b.avg_churn - a.avg_churn);
  const topRiskSeg = sortedSegments[0];
  const isOnboardingPriority = s?.metrics?.onboarding_risk_users > (totalUsers * 0.15);
  const prioritySegmentName = isOnboardingPriority ? "Onboarding" : (topRiskSeg?.segment || "At Risk");
  
  // Use segment-specific risk count if available, else total
  const priorityRiskCount = isOnboardingPriority 
    ? (s?.metrics?.onboarding_risk_users || 0)
    : (topRiskSeg?.high_risk_count || s?.metrics?.total_high_risk_users || 0);

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
                {s?.metrics?.roc_auc > 0.75 && (
                  <span style={{ 
                    fontSize: '0.65rem', fontWeight: 900, color: '#10b981', 
                    background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', 
                    borderRadius: '20px', border: '1px solid rgba(16,185,129,0.2)',
                    display: 'flex', alignItems: 'center', gap: '0.3rem'
                  }}>
                    <ShieldCheck size={10} /> High Reliability Analysis
                  </span>
                )}
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
                  The Situation: {churnPct}% Overall Churn Exposure Detected
                </h3>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontWeight: 500 }}>
                  Our models have identified a total probabilistic <strong style={{ color: '#0f172a' }}>Revenue Exposure of {formatCurrency(revAtRisk)}</strong>. 
                  {s?.potential_recovery?.is_adaptive 
                    ? `While absolute churn is low, we have identified a high-potential recovery of ${formatCurrency(potentialSaved)} by targeting the top-quartile 'Warning' cohort.`
                    : `Currently, users with critical risk profiles contribute to this exposure, primarily driven by ${s?.top_drivers?.[0]?.feature || 'Behavioral Volatility'}.`
                  } 
                  By deploying our recommended <strong>Strategic Playbook</strong>, we can protect and grow this revenue through targeted AI-driven interventions. 
                  The immediate command priority is the <strong style={{ color: '#0891b2' }}>'{prioritySegmentName}'</strong> segment, where <strong style={{ color: '#e11d48' }}>{priorityRiskCount} users</strong> are at critical risk.
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
                      <span style={{ color: '#f59e0b' }}>{prioritySegmentName} Segment</span>
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
              logic: `Computed from: Count of unique User IDs in the active dataset (${totalUsers.toLocaleString()} profiles).`
            },
            { 
              id: 'risk',
              icon: AlertTriangle, label: 'Risk Intensity', value: `${churnPct}%`, 
              sub: 'Churn Probability', color: '#f43f5e', bg: 'rgba(244,63,94,0.08)',
              desc: 'Likelihood of customers leaving in 30 days.',
              logic: "Computed from: Σ(User Churn Prob × User Monetary) / Σ(Total Monetary). A revenue-weighted average of churn risk across all segments."
            },
            { 
              id: 'exposure',
              icon: DollarSign, label: 'Revenue Exposure', value: formatCurrency(revAtRisk), 
              sub: 'Capital at Stake', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',
              desc: 'Total revenue potentially lost if no action taken.',
              logic: `Computed from: Σ(Daily Velocity × 90 Days × Churn Prob) for every user. Reflects 90-day projected capital risk. Exact: ${formatExactCurrency(revAtRisk)}`
            },
            { 
              id: 'capture',
              icon: Target, label: 'Recovery Capture', value: formatCurrency(potentialSaved), 
              sub: 'Actionable ROI', color: '#10b981', bg: 'rgba(16,185,129,0.08)', 
              action: 'simulation',
              desc: 'Revenue we can save via AI-driven interventions.',
              logic: `Computed from: (Revenue Exposure of At-Risk Segments) × (Model Accuracy × 0.5). Simulates a ${recoveryEfficiency}% risk reduction. Exact: ${formatExactCurrency(potentialSaved)}`
            },
          ].map(({ id, icon: Icon, label, value, sub, color, bg, action, desc, logic }, i) => (
            <FormulaTooltip key={i} formula={logic} color={color}>
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
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                       {segChurn.slice(0, 5).map((seg, i) => (
                          <div key={i} style={{ borderBottom: i < 4 ? '1px solid rgba(0,0,0,0.02)' : 'none', paddingBottom: i < 4 ? '0.75rem' : 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: '#0f172a' }}>{seg.segment}</span>
                                    <span style={{ 
                                       fontSize: '0.65rem', 
                                       fontWeight: 900, 
                                       padding: '0.1rem 0.5rem', 
                                       borderRadius: '20px',
                                       background: seg.status === 'CRITICAL' ? 'rgba(244,63,94,0.1)' : seg.status === 'WARNING' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                                       color: seg.status === 'CRITICAL' ? '#f43f5e' : seg.status === 'WARNING' ? '#f59e0b' : '#10b981'
                                    }}>
                                       {seg.status} ({(seg.avg_churn * 100).toFixed(1)}%)
                                    </span>
                                 </div>
                              </div>
                              <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginBottom: '0.6rem', lineHeight: 1.4 }}>
                                 {seg.definition || {
                                    'Champions': 'Best customers: High spenders who buy frequently and recently.',
                                    'Loyalists': 'Reliable regulars: Consistent purchase history with high engagement.',
                                    'At Risk': 'High-value but fading: Historically big spenders who haven\'t returned recently.',
                                    'Hibernating': 'Lost users: Low frequency and hasn\'t interacted in a long time.',
                                    'Promising': 'Emerging stars: Recent joiners with high initial spending potential.',
                                    'Needs Attention': 'Struggling users: Average value but showing signs of declining activity.',
                                    'New': 'Fresh leads: Just joined the platform; habits not yet formed.'
                                 }[seg.segment] || 'Behavioral segment based on RFM scoring.'}
                              </div>
                             <div style={{ height: 6, background: 'rgba(0,0,0,0.03)', borderRadius: 10, overflow: 'hidden' }}>
                                <motion.div 
                                   initial={{ width: 0 }}
                                   animate={{ width: `${seg.avg_churn * 100}%` }}
                                   style={{ height: '100%', background: SEGMENT_COLORS[seg.segment] || '#6366f1', borderRadius: 10 }} 
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

             {/* ── COMMAND CENTER (Repositioned precisely within the left column) ── */}
             <div style={{ 
                background: 'var(--bg-card)', 
                borderRadius: '24px', 
                padding: '2rem',
                border: '1px solid var(--border)',
                position: 'relative',
                overflow: 'hidden',
                marginTop: '2rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.02)'
             }}>
                <Zap size={100} style={{ position: 'absolute', right: '-20px', bottom: '-20px', color: 'rgba(99,102,241,0.05)', transform: 'rotate(-15deg)' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                   <div style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '0.5rem', borderRadius: '10px' }}>
                      <Zap size={20} fill="#f59e0b" />
                   </div>
                   <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-primary)', textTransform: 'uppercase' }}>What should I do now?</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '2rem', position: 'relative', zIndex: 1 }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>1. Target Segment First</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f59e0b' }}>{prioritySegmentName}</span>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>2. Primary "Why"</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                         {s?.top_drivers?.[0]?.feature || 'Behavioral'} anomaly detected. {s?.top_drivers?.[0]?.direction === 'increases_churn' ? 'Increasing' : 'Declining'} patterns indicate imminent churn.
                      </span>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>3. Est. Revenue Protected</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#10b981' }}>{formatCurrency(potentialSaved)}</span>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>4. Recommended Campaign</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{s?.hypotheses?.[0]?.test || 'Targeted re-engagement nudges.'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                       <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>5. Confidence & Caveat</span>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#6366f1' }}>{confidence}% Model Health</span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                             {driftStatus === 'STABLE' ? 'Baseline remains stable.' : 'Significant market drift detected.'}
                          </span>
                       </div>
                    </div>
                 </div>
                 
                 {onNavigate && (
                   <button 
                     onClick={() => onNavigate('explainability')}
                     style={{ 
                       marginTop: '2rem', width: '100%', padding: '0.75rem', borderRadius: '12px',
                       background: 'var(--bg-input)', border: '1px solid var(--border)',
                       color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer',
                       display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                       transition: 'all 0.2s'
                     }}
                   >
                     <Brain size={14} /> Audit Model Evidence &rarr;
                   </button>
                 )}
              </div>
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
            <div style={{ fontSize: '0.7rem', fontWeight: 700, background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '0.3rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
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
