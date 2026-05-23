import React from 'react';
import { motion } from 'framer-motion';
import {
  Users, AlertTriangle, Target, DollarSign, Activity, TrendingDown,
  Brain, Zap, ShieldCheck, CheckCircle, Database, BarChart2,
  PieChart as PieChartIcon, Search, Download, Trash2, Sliders, RefreshCw,
  Lightbulb, FlaskConical, Filter, CalendarRange, ChevronRight, Play, ShoppingBag
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

export default function ExplainabilityTab({ data, s, globalSimResult, exportPDF, setActiveTab, setShowGuide, segmentData, lifecycleData, segChurn, shapData, cohorts, productMix, rar, totalUsers, churnPct }) {
  return (
    <>

              <div style={{ gridColumn: 'span 6' }}>
                <Section span={12} delay={0} className="tour-shap" initial={false}>
                  <h2><Brain size={20} style={{ color: '#8b5cf6' }} /> SHAP Feature Impact</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    <strong>How to read this:</strong> This chart reveals the hidden factors driving churn. Red bars pushing right increase the risk of a user leaving, while green bars pushing left indicate factors keeping them loyal. The longer the bar, the stronger the impact!
                  </p>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={shapData.slice(0, 15).map(s => {
                          const isIncrease = s.direction === 'increases_churn';
                          return { 
                            ...s, 
                            shap_val: isIncrease ? Math.abs(s.importance || 0) : -Math.abs(s.importance || 0) 
                          };
                        })} 
                        layout="vertical"
                        margin={{ left: 20, right: 30 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} vertical={true} />
                        <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} />
                        <YAxis type="category" dataKey="feature" width={160} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="shap_val" radius={[0, 4, 4, 0]}>
                          {shapData.slice(0, 15).map((s, i) => (
                            <Cell 
                              key={i} 
                              fill={s.direction === 'increases_churn' ? '#f43f5e' : '#10b981'} 
                            />
                          ))}
                        </Bar>
                        <ReferenceLine x={0} stroke="#64748b" strokeWidth={2} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              </div>




              {/* ── Top 3 Global Churn Drivers ── */}
              <Section span={6} delay={0.3}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  <AlertTriangle size={20} style={{ color: '#f43f5e' }} />
                  <h2 style={{ margin: 0 }}>Top 3 Churn Drivers (Global)</h2>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'linear-gradient(135deg,#f43f5e,#f59e0b)', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '1rem' }}>SHAP</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(() => {
                    const topDrivers = (s?.top_drivers || []).slice(0, 3);
                    const maxImportance = Math.max(...topDrivers.map(d => d.importance || 0), 0.01);
                    const domain = s?.domain || 'generic';
                    return topDrivers.map((d, i) => {
                      const isIncrease = d.direction === 'increases_churn';
                      const pct = ((d.importance || 0) * 100).toFixed(1);
                      const barPct = Math.round(((d.importance || 0) / maxImportance) * 100);
                      const barColor = isIncrease ? '#f43f5e' : '#10b981';
                      
                      // Domain-aware strategic insights
                      const getInsight = () => {
                        const feat = d.feature;
                        const raw = (d.raw_feature || '').toLowerCase();
                        if (domain === 'tax') {
                          if (raw.includes('frequency') || raw.includes('payment'))
                            return isIncrease 
                              ? `Higher filing/payment frequency correlates with multi-deductor complexity. Users with many TDS entries may be facing compliance fatigue, increasing churn risk.`
                              : `Declining payment frequency signals reduced tax activity through the platform. Users may be switching to competitors or direct filing.`;
                          if (raw.includes('monetary') || raw.includes('income') || raw.includes('amount'))
                            return isIncrease
                              ? `High-income users are paradoxically more likely to churn — they have more options and higher expectations. Premium retention strategies are needed.`
                              : `Declining taxable income flow through the platform indicates users are diverting income reporting elsewhere.`;
                          if (raw.includes('recency'))
                            return `Time since last tax credit/filing is a strong churn predictor. Users who haven't engaged recently during the filing season are at high risk of permanent attrition.`;
                        }
                        if (domain === 'upi') {
                          if (raw.includes('frequency'))
                            return isIncrease
                              ? `Unusually high transaction frequency can indicate fraud-testing patterns or account-sharing, both of which precede account abandonment.`
                              : `Declining UPI usage frequency is the #1 churn signal. Users are likely switching to competing payment apps (GPay, PhonePe, Paytm).`;
                          if (raw.includes('monetary') || raw.includes('amount') || raw.includes('spent'))
                            return isIncrease
                              ? `Higher spending via UPI correlates with churn when combined with service issues — high-value users have lower tolerance for failures.`
                              : `Declining transaction value signals users are routing larger payments through alternative channels.`;
                          if (raw.includes('ipi') || raw.includes('cycle'))
                            return `Purchase cycle irregularity indicates behavioral disruption. Consistent users who suddenly change their payment timing are showing early churn signals.`;
                        }
                        // Generic fallback
                        return isIncrease
                          ? `Elevated ${feat} shows statistical correlation with churn in the model. This feature contributes ${pct}% to the AI's churn prediction decision.`
                          : `Declining ${feat} is an early-warning signal. This behavioral trend contributes ${pct}% to the model's risk assessment.`;
                      };

                      return (
                        <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                          style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', maxWidth: '60%' }}>
                              {d.feature}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '0.7rem', color: barColor, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {isIncrease ? '⚠️ High → churn' : '📉 Drop → churn'}
                              </span>
                              <div style={{ textAlign: 'right', minWidth: '55px' }}>
                                <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.1rem' }}>
                                  SHAP Weight
                                </div>
                                <div style={{ fontWeight: 900, color: barColor, fontSize: '1.1rem', lineHeight: 1 }}>
                                  {pct}%
                                </div>
                              </div>
                            </div>
                          </div>
                          <div style={{ height: 10, background: 'var(--bg-input)', borderRadius: 5, overflow: 'hidden', marginBottom: '0.2rem' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barPct}%` }}
                              transition={{ delay: 0.2 + i * 0.1, duration: 0.9, ease: 'easeOut' }}
                              style={{ height: '100%', background: `linear-gradient(90deg, ${barColor}88, ${barColor})`, borderRadius: 5, boxShadow: `0 0 10px ${barColor}40` }}
                            />
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, background: 'rgba(0,0,0,0.02)', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', borderLeft: `3px solid ${barColor}`, lineHeight: 1.4 }}>
                            <span><strong>Strategic Insight:</strong> {getInsight()}</span>
                          </div>
                        </motion.div>
                      );
                    });
                  })()}
                </div>
              </Section>

              {productMix?.overall && (
                <>
                  <Section span={12} delay={0.34}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h2 style={{ margin: 0 }}><ShoppingBag size={20} style={{ color: '#f59e0b' }} /> Top Products Correlated with Churn</h2>
                      <span className="version-badge" style={{ background: '#f59e0b' }}>AI INSIGHTS</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      <strong>How to read this:</strong> This table ranks products by transaction volume and maps their statistical correlation to user churn. Identify which platforms are associated with high-risk behavior patterns.
                    </p>
                    
                    <div className="intervention-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40%' }}>Product Name</th>
                            <th style={{ width: '20%' }}>Orders</th>
                            <th style={{ width: '40%' }}>Risk Correlation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(productMix.overall || []).map((p, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.product}</td>
                              <td style={{ fontWeight: 600 }}>{p.count.toLocaleString()}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ 
                                    width: 8, height: 8, borderRadius: '50%', 
                                    background: p.risk_level === 'High' ? '#f43f5e' : p.risk_level === 'Low' ? '#10b981' : '#94a3b8' 
                                  }} />
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {p.risk_insight || 'Neutral behavioral footprint.'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Section>
                </>
              )}

              <Section span={12} delay={0.34}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  <ShieldCheck size={20} style={{ color: '#10b981' }} />
                  <h2 style={{ margin: 0 }}>Model Health & Data Drift Monitor</h2>
                  <span className="version-badge" style={{ background: '#10b981' }}>LIVE MONITOR</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  <strong>How to read this:</strong> The ROC-AUC score measures the AI's accuracy in predicting churn (closer to 100% is better). Data drift alerts you if user behavior has changed so much that the AI might need retraining.
                </p>

                {/* Main horizontal layout grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {/* Column 1: Performance & Accuracy */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.01)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                      Performance & Accuracy
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'var(--bg-input)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                      <div style={{ width: 60, height: 60 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={[{ value: s?.metrics?.roc_auc || 0 }, { value: 1 - (s?.metrics?.roc_auc || 0) }]}
                              cx="50%" cy="50%" innerRadius={20} outerRadius={28} startAngle={90} endAngle={-270}
                              dataKey="value" stroke="none">
                              <Cell fill="#10b981" />
                              <Cell fill="rgba(0,0,0,0.05)" />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                          {formatMetricPct(s?.metrics?.roc_auc)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginTop: '0.25rem' }}>ROC-AUC SCORE</div>
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-input)', padding: '0.85rem 1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>CROSS-VALIDATION</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#6366f1' }}>
                        {s?.metrics?.cv_auc_mean ? `${(s.metrics.cv_auc_mean * 100).toFixed(1)}%` : 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>F1-SCORE: {s?.metrics?.f1 ? `${(s.metrics.f1 * 100).toFixed(1)}%` : 'N/A'}</div>
                    </div>

                    {/* Mini Confusion Matrix */}
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>CONFUSION MATRIX</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', textAlign: 'center' }}>
                        {(() => {
                          const cm = s?.metrics?.confusion_matrix;
                          return [
                            { label: 'Correct Churn', val: cm ? `${cm.tp_rate}%` : '—', sub: 'True Positive', color: '#10b981' },
                            { label: 'False Alarms', val: cm ? `${cm.fp_rate}%` : '—', sub: 'False Positive', color: '#f59e0b' },
                            { label: 'Missed Churn', val: cm ? `${cm.fn_rate}%` : '—', sub: 'False Negative', color: '#f43f5e' },
                            { label: 'Correct Retain', val: cm ? `${cm.tn_rate}%` : '—', sub: 'True Negative', color: '#6366f1' }
                          ];
                        })().map((m, i) => (
                          <div key={i} style={{ background: 'var(--bg-input)', padding: '0.5rem 0.3rem', borderRadius: '0.6rem', border: '1px dashed var(--border)' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: m.color, marginBottom: '0.1rem' }}>{m.val}</div>
                            <div style={{ fontSize: '0.52rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{m.label}</div>
                            <div style={{ fontSize: '0.42rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{m.sub}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Data Drift Status & Diagnosis */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.01)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                      Drift Diagnostics
                    </div>

                    <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>DATA DRIFT STATUS</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: s?.metrics?.drift?.status === 'STABLE' ? '#10b981' : s?.metrics?.drift?.status === 'LOW DRIFT' ? '#f59e0b' : '#f43f5e' }}>
                        {s?.metrics?.drift?.status || 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {s?.metrics?.drift?.drifted_count != null
                          ? `${s.metrics.drift.drifted_count}/${s.metrics.drift.total_features} features shifted (${s.metrics.drift.drifted_pct}%)`
                          : `P-VALUE: ${(s?.metrics?.drift?.avg_p_value ?? 0).toFixed(4)}`
                        }
                      </div>
                    </div>

                    {s?.metrics?.drift?.severity_reason && (
                      <div style={{
                        padding: '1rem',
                        background: s?.metrics?.drift?.status === 'STABLE'
                          ? 'rgba(16,185,129,0.05)'
                          : s?.metrics?.drift?.status === 'LOW DRIFT'
                            ? 'rgba(245,158,11,0.05)'
                            : 'rgba(244,63,94,0.05)',
                        borderRadius: '1rem',
                        border: `1px solid ${s?.metrics?.drift?.status === 'STABLE'
                          ? 'rgba(16,185,129,0.12)'
                          : s?.metrics?.drift?.status === 'LOW DRIFT'
                            ? 'rgba(245,158,11,0.12)'
                            : 'rgba(244,63,94,0.12)'}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <AlertTriangle size={14} style={{ color: s?.metrics?.drift?.status === 'STABLE' ? '#10b981' : '#f59e0b' }} />
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                            color: s?.metrics?.drift?.status === 'STABLE' ? '#059669' : s?.metrics?.drift?.status === 'LOW DRIFT' ? '#d97706' : '#e11d48'
                          }}>
                            Why this status?
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', lineHeight: 1.4, fontWeight: 500 }}>
                          {s.metrics.drift.severity_reason}
                        </p>

                        {/* Top Drifted Features */}
                        {(s?.metrics?.drift?.top_drifted || []).length > 0 ? (
                          <div style={{ marginTop: '0.6rem' }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                              Top Shifted Features
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {s.metrics.drift.top_drifted.map((f, i) => (
                                <div key={i} style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '0.3rem 0.5rem',
                                  background: 'rgba(0,0,0,0.02)',
                                  borderRadius: '0.4rem',
                                  borderLeft: '3px solid #f43f5e'
                                }}>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-primary)' }}>{f.feature}</span>
                                  <span style={{ fontSize: '0.6rem', color: '#f43f5e', fontWeight: 700 }}>KS: {f.ks_statistic}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                            No individual features show statistically significant drift.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Column 3: Recommended Actions & Strategy */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.01)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                      Actions & Strategy
                    </div>

                    {/* Recommended Actions */}
                    <div style={{ background: 'var(--bg-input)', padding: '0.85rem 1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Recommended Actions
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {(s?.metrics?.drift?.recommended_actions || []).length > 0 ? (
                          s.metrics.drift.recommended_actions.map((action, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'flex-start', gap: '0.4rem',
                              fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.3
                            }}>
                              <CheckCircle size={12} style={{ color: '#10b981', marginTop: '0.1rem', flexShrink: 0 }} />
                              <span>{action}</span>
                            </div>
                          ))
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.3 }}>
                            <CheckCircle size={12} style={{ color: '#10b981', marginTop: '0.1rem', flexShrink: 0 }} />
                            <span>No immediate retraining actions needed. Keep monitoring routinely.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mini Metric Guide */}
                    <div style={{ padding: '0.85rem 1rem', background: 'rgba(99,102,241,0.04)', borderRadius: '1rem', border: '1px solid rgba(99,102,241,0.1)' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', fontWeight: 900, color: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Lightbulb size={14} /> Metrics Guide
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                        <div>
                          <strong>ROC-AUC:</strong> Predictor grade (perfect score is 100%).
                        </div>
                        <div>
                          <strong>Data Drift:</strong> Detects if incoming behavior shifts from training distributions using KS analysis.
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(16,185,129,0.08)', borderRadius: '0.75rem', border: '1px solid rgba(16,185,129,0.15)', fontSize: '0.75rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto' }}>
                      <CheckCircle size={14} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Model: <strong>{s?.model_info?.name || 'Random Forest'}</strong> · {s?.model_info?.features_used?.length || 0} features
                      </span>
                    </div>
                  </div>
                </div>
              </Section>


            
    </>
  );
}
