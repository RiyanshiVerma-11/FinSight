import React from 'react';
import { motion } from 'framer-motion';
import {
  Users, AlertTriangle, Target, DollarSign, Activity, TrendingDown,
  Brain, Zap, ShieldCheck, CheckCircle, Database, BarChart2,
  PieChart as PieChartIcon, Search, Download, Trash2, Sliders, RefreshCw,
  Lightbulb, FlaskConical, Filter, CalendarRange, ChevronRight, Play, ShoppingBag,
  ShieldAlert
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, Legend, CartesianGrid, ReferenceLine, ScatterChart, 
  Scatter, ZAxis, AreaChart, Area, ComposedChart, Line
} from 'recharts';
import { COLORS, SEGMENT_COLORS, CHART_COLORS, PERSONA_DEFINITIONS } from '../../utils/constants';
import { formatCurrency, formatMetricPct, getRiskThresholds, segmentToPersona, getPersona, getROIStatus } from '../../utils/formatters';
import { CustomTooltip, StatCard, Section } from '../ui/DashboardComponents';
import FormulaTooltip from '../ui/FormulaTooltip';
import LiveTicker from './LiveTicker';
import ActiveExperiments from './ActiveExperiments';
import CohortMatrix from './CohortMatrix';
import WhatIfSandbox from './WhatIfSandbox';

export default function OverviewTab({ activeTab, data, s, globalSimResult, exportPDF, setActiveTab, setShowGuide, segmentData, lifecycleData, segChurn, shapData, cohorts, productMix, rar, totalUsers, churnPct }) {
  return (
    <>
{/* ── Testable Hypotheses (Main Dashboard Injection) ── */}
      {data && activeTab === 'overview' && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <Lightbulb size={24} style={{ color: '#f59e0b' }} />
            <h2 style={{ margin: 0 }}>Strategic Hypotheses</h2>
            <span className="version-badge" style={{ background: '#f59e0b' }}>TESTABLE</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {(s?.hypotheses || []).map((h, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="hypothesis-card" style={{
                  borderLeft: `5px solid ${CHART_COLORS[i % CHART_COLORS.length]}`,
                  background: 'var(--bg-card)',
                  boxShadow: 'var(--shadow-md)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', color: CHART_COLORS[i % CHART_COLORS.length], letterSpacing: '0.05em' }}>
                    {h.title || `Hypothesis ${i + 1}`}
                  </span>
                  <span className={`badge ${h.impact === 'Critical' ? 'badge-high' : 'badge-medium'}`}>{h.impact} Impact</span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{h.hypothesis}</h3>
                <div style={{
                  background: 'rgba(99,102,241,0.05)',
                  border: '1px dashed rgba(99,102,241,0.3)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  fontSize: '0.85rem',
                  color: 'var(--primary-dark)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <FlaskConical size={16} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                  <span><strong>Test:</strong> {h.test}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>DRIVEN BY: {h.driver?.toUpperCase() || 'UNKNOWN'}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>{h.stat}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
              <div className="tour-stats" style={{ gridColumn: 'span 12' }}>
                <div className="stats-grid">
                  <StatCard icon={Users} iconClass="stat-icon--indigo" cardClass="stat-card--indigo"
                    label="Total Users" value={s?.total_users?.toLocaleString() || '0'}
                    trend={`${s?.metrics?.train_size || 0} train / ${s?.metrics?.test_size || 0} test`}
                    trendClass="stat-trend--neutral" trendIcon={CheckCircle} delay={0}
                    logic="Computed from: Count of unique User IDs in the current analytical session." />

                  <StatCard icon={ShieldAlert} iconClass="stat-icon--rose" cardClass="stat-card--rose"
                    label="Aggregated Risk" value={`${churnPct}%`}
                    trend="Revenue-Weighted Risk" trendClass="stat-trend--neutral" trendIcon={DollarSign} delay={0.05}
                    logic="Computed from: Σ(Churn Prob × Monetary) / Σ(Total Monetary). A weighted measure of systemic risk." />

                  <StatCard icon={Target} iconClass="stat-icon--cyan" cardClass="stat-card--cyan"
                    label="Model Accuracy" value={formatMetricPct(s?.metrics?.accuracy)}
                    trend={`AUC: ${formatMetricPct(s?.metrics?.roc_auc)}`}
                    trendClass="stat-trend--neutral" trendIcon={ShieldCheck} delay={0.1}
                    logic="Computed from: Out-of-sample Test Set Accuracy (Correct Predictions / Total Predictions)." />

                  <StatCard icon={DollarSign} iconClass="stat-icon--amber" cardClass="stat-card--amber"
                    label="Revenue at Risk" value={formatCurrency(rar?.total || 0)}
                    trend={`${segChurn?.length || 0} segments`} trendClass="stat-trend--down" trendIcon={TrendingDown} delay={0.15}
                    logic="Computed from: Σ(Daily Velocity × 90 Days × Churn Prob). Total projected exposure over the next quarter." />
                </div>
              </div>

              <div className="tour-segments" style={{ gridColumn: 'span 8' }}>
                <Section span={12} delay={0} initial={false}>
                  <h2><Activity size={20} style={{ color: '#6366f1' }} /> User Segmentation Intelligence</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    <strong>How to read this:</strong> This bar chart shows the total count of users grouped by their behavioral persona. Use this to identify which segments form your largest audience.
                  </p>
                  <div className="chart-wrapper" style={{ background: 'transparent' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={segmentData}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} tickFormatter={segmentToPersona} dy={10} />
                        <YAxis hide />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]} name="Users">
                          {segmentData.map((entry, i) => <Cell key={i} fill={SEGMENT_COLORS[entry.name] || COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              </div>

              <Section span={4} delay={0.2}>
                <h2>Lifecycle Distribution</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  <strong>How to read this:</strong> Shows the proportion of users at different stages of their journey (e.g., New, Active). Hover over a slice to see exact numbers.
                </p>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={lifecycleData} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                        {lifecycleData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section span={6} delay={0.25}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  <TrendingDown size={22} style={{ color: '#f43f5e' }} />
                  <h2 style={{ margin: 0 }}>Churn Driver Analysis</h2>
                  <span className="version-badge" style={{ background: '#f43f5e' }}>TOP 3 REASONS</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Our analytics engine has identified these top 3 drivers based on current user behavior patterns and transactional events.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(s?.top_drivers || []).slice(0, 3).map((d, i) => {
                    const colors = ['#f43f5e', '#f59e0b', '#8b5cf6'];
                    const color = colors[i % colors.length];
                    return (
                      <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }}
                        style={{
                          background: 'var(--bg-input)',
                          borderRadius: '1rem',
                          padding: '1.25rem',
                          border: '1px solid var(--border)',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: color }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${color}15`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                              {i + 1}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{d.feature}</span>
                          </div>
                          <span style={{ fontWeight: 800, color: color, fontSize: '1.1rem' }}>{(d.importance * 100).toFixed(1)}%</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden', marginBottom: '0.5rem' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${d.importance * 100}%` }}
                            transition={{ duration: 1, ease: 'easeOut', delay: 0.5 + i * 0.1 }}
                            style={{ height: '100%', background: color, borderRadius: 4, boxShadow: `0 0 10px ${color}30` }}
                          />
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                          <span>IMPACT LEVEL: {d.impact || 'HIGH'}</span>
                          <span>{d.importance > 0.15 ? 'CRITICAL SIGNAL' : 'MODERATE SIGNAL'}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Section>

              <Section span={6} delay={0.34}>
                <LiveTicker />
              </Section>

              <div style={{ gridColumn: 'span 12', marginTop: '1rem', padding: '1.5rem', background: 'rgba(99,102,241,0.03)', borderRadius: '1rem', border: '1px dashed rgba(99,102,241,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Brain size={24} color="#6366f1" />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Confused about the metrics?</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Read our Intelligence Guide to understand Behavioral Fingerprinting, SHAP, and RAR.</div>
                  </div>
                </div>
                <button className="btn-primary" onClick={() => setShowGuide(true)} style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                  Open Intelligence Guide
                </button>
              </div>
            
    </>
  );
}
