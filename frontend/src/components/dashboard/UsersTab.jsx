import React from 'react';
import { motion } from 'framer-motion';
import {
  Users, AlertTriangle, Target, DollarSign, Activity, TrendingDown,
  Brain, Zap, ShieldCheck, CheckCircle, Database, BarChart2,
  PieChart as PieChartIcon, Search, Download, Trash2, Sliders, RefreshCw,
  Lightbulb, FlaskConical, Filter, CalendarRange, ChevronRight, Play, ShoppingBag,
  Award
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

export default function UsersTab({ setShapUser, data, s, globalSimResult, exportPDF, setActiveTab, setShowGuide, segmentData, lifecycleData, segChurn, shapData, cohorts, productMix, rar, totalUsers, churnPct }) {
  const thresholds = getRiskThresholds(s);
  const riskThreshold = thresholds.high;
  const criticalThreshold = thresholds.critical;

  return (
    <>

              <CohortMatrix cohorts={cohorts} />

              <div style={{ gridColumn: 'span 12' }} className="tour-ltv">
                <Section span={12} delay={0} initial={false}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h2 style={{ margin: 0 }}><Users size={20} style={{ color: '#6366f1' }} /> User-Level Analytics</h2>
                      <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Deep dive into individual user performance and risk profiles</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>High Risk Users</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-rose)' }}>
                          {s?.metrics?.total_high_risk_users || data?.users?.filter(u => u.churn_probability >= riskThreshold).length}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Avg. LTV</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                          ₹{(data?.users?.reduce((acc, u) => acc + (u.predicted_ltv || u.monetary || 0), 0) / (data?.users?.length || 1)).toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.6rem 1rem', background: 'linear-gradient(135deg,rgba(244,63,94,0.06),rgba(245,158,11,0.06))', borderRadius: '0.75rem', border: '1px solid rgba(244,63,94,0.12)' }}>
                    <Award size={16} style={{ color: '#f43f5e' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f43f5e' }}>Top 50 Users to Save TODAY</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.25rem' }}>— ranked by Priority Score (churn × revenue × engagement sensitivity)</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '12%' }}>User Profile</th>
                          <th style={{ width: '12%' }}>Persona</th>
                          <th style={{ width: '10%' }}>Lifecycle</th>
                          <th style={{ width: '10%' }}>RFM Score</th>
                          <th style={{ width: '14%' }}>Churn Risk</th>
                          <th style={{ width: '14%' }}>Predicted LTV</th>
                          <th style={{ width: '14%' }}>Retention ROI</th>
                          <th style={{ width: '14%' }}>Priority Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const allUsers = data?.users || [];
                          const maxLtv = Math.max(...allUsers.map(u => u.predicted_ltv || u.monetary || 0), 1);
                          const maxPriority = Math.max(...allUsers.map(u => {
                            const ltv = u.predicted_ltv || u.monetary || 0;
                            return u.churn_probability * (ltv / maxLtv) * (u.frequency_score || 1);
                          }), 1);
                          const sorted = [...allUsers]
                            .map(u => ({
                              ...u,
                              priority: u.churn_probability * ((u.predicted_ltv || u.monetary || 0) / maxLtv) * (u.frequency_score || 1)
                            }))
                            .sort((a, b) => b.priority - a.priority)
                            .slice(0, 50);

                          return sorted.map((u, i) => {
                            const riskColor = u.churn_probability >= criticalThreshold ? 'var(--accent-rose)' : u.churn_probability >= riskThreshold ? 'var(--accent-amber)' : 'var(--accent-emerald)';
                            const ltvVal = u.predicted_ltv || u.monetary || 0;
                            const ltvPct = Math.min(100, (ltvVal / maxLtv) * 100);
                            const priorityPct = Math.min(100, (u.priority / maxPriority) * 100);
                            const priorityColor = priorityPct > 70 ? '#f43f5e' : priorityPct > 40 ? '#f59e0b' : '#10b981';
                            return (
                              <tr key={i} onClick={() => setShapUser(u.user_id)} style={{
                                cursor: 'pointer',
                                borderLeft: `3px solid ${u.churn_probability >= criticalThreshold ? 'var(--accent-rose)' : 'transparent'}`
                              }}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                      width: 36, height: 36, borderRadius: '10px',
                                      background: `linear-gradient(135deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      color: '#fff', fontWeight: 700, fontSize: '0.8rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                    }}>
                                      {u.user_id.toString().slice(-2)}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{u.user_id}</div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rank #{i + 1}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span className="badge" style={{ background: `${COLORS[i % COLORS.length]}12`, color: COLORS[i % COLORS.length], border: `1px solid ${COLORS[i % COLORS.length]}25`, padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 800 }}>
                                      {u.segment || 'Unknown'}
                                    </span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase' }}>Persona: {getPersona(u)}</span>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-light)' }} />
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{u.lifecycle}</span>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '0.3rem 0.6rem', borderRadius: '0.5rem', letterSpacing: '0.05em' }}>
                                      {u.rfm_raw || 'Unknown'}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: riskColor }}>
                                        {u.churn_probability >= criticalThreshold ? 'CRITICAL' : u.churn_probability >= riskThreshold ? 'WARNING' : 'STABLE'}
                                      </span>
                                      <span style={{ fontWeight: 800, color: riskColor, fontSize: '0.85rem' }}>{(u.churn_probability * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="churn-bar-track" style={{ width: '100%', height: 6, background: 'var(--bg-input)' }}>
                                      <div className="churn-bar-fill" style={{ width: `${u.churn_probability * 100}%`, backgroundColor: riskColor, boxShadow: `0 0 10px ${riskColor}30` }} />
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(ltvVal)}</span>
                                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>PRED. LTV</span>
                                    </div>
                                    <div className="ltv-bar-track" style={{ width: '100%', height: 6, background: 'var(--bg-input)' }}>
                                      <div className="ltv-bar-fill" style={{ width: `${ltvPct}%`, backgroundColor: 'var(--primary)', opacity: 0.7 }} />
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  {(() => {
                                    const roi = getROIStatus(u);
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <span style={{
                                          fontSize: '0.7rem',
                                          fontWeight: 800,
                                          color: roi.color,
                                          background: roi.bg,
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '4px',
                                          textAlign: 'center',
                                          border: `1px solid ${roi.color}20`
                                        }}>
                                          {roi.status}
                                        </span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700 }}>
                                          Est. Cost: {formatCurrency(roi.cost)}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: priorityColor }}>
                                        {priorityPct > 70 ? 'URGENT' : priorityPct > 40 ? 'HIGH' : 'MONITOR'}
                                      </span>
                                      <span style={{ fontWeight: 800, color: priorityColor, fontSize: '0.85rem' }}>{priorityPct.toFixed(0)}</span>
                                    </div>
                                    <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${priorityPct}%`, background: `linear-gradient(90deg, ${priorityColor}88, ${priorityColor})`, borderRadius: 3, transition: 'width 0.7s ease' }} />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </div>
            
    </>
  );
}
