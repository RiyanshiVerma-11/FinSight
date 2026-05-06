import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  Users, ShieldAlert, DollarSign, TrendingUp, TrendingDown,
  Target, Zap, CheckCircle, X, LayoutDashboard, Download, 
  FileText, Briefcase, Activity, Award, AlertTriangle, Lightbulb, Brain
} from 'lucide-react';

const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981'];

const PERSONA_LABELS = {
  'At Risk': 'The Fading Star',
  'Loyalists': 'The Steady Pillar',
  'Champions': 'The Loyal Giant',
  'Promising': 'The Rising Star',
  'Hibernating': 'The Lost Soul',
};

export default function ExecutiveDashboard({ data, onExportAll }) {
  const s = data?.summary;
  const rar = s?.revenue_at_risk;
  const segChurn = s?.segment_churn || [];
  const totalUsers = s?.total_users || 0;
  const churnPct = ((s?.avg_churn_risk || 0) * 100).toFixed(1);
  const revAtRisk = rar?.total || 0;
  const highRiskUsers = data?.users?.filter(u => u.churn_probability > 0.7).length || 0;

  // ── Forecast: Use real backend data ──
  const forecastData = s?.forecast || [];

  // Top risk by product — purely data-driven (Honest Logic)
  const rawProducts = data?.summary?.product_mix?.overall || [];
  const productRisk = rawProducts.slice(0, 5).map((p, i) => ({
    name: p.product.length > 15 ? p.product.split(' ')[0] : p.product,
    revenue: Math.round(revAtRisk * ((p.count / totalUsers) || 0.1)),
    risk: Math.round((p.count / totalUsers) * 100) // Percentage of users/orders at risk
  }));

  const topSegChurn = segChurn[0];

  // Recovery potential: Based on CENTRALIZED backend simulation
  const potentialSaved = s?.potential_recovery || 0;

  const beforeAfter = [
    { label: 'Segmentation', before: '❌ None', after: '✅ Dynamic Persona-Based' },
    { label: 'Campaigns', before: '🎯 Blind', after: '🎯 ROI-Optimized' },
    { label: 'Churn Visibility', before: '❌ Unknown', after: `✅ ${churnPct}% tracked` },
    { label: 'Revenue Loss', before: '💸 Unmeasured', after: `💰 ₹${revAtRisk.toLocaleString()} mapped` },
  ];

  return (
    <div className="executive-view-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
      >
        {/* Header */}
        <div className="exec-header" style={{ padding: '1.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="exec-logo-icon"><LayoutDashboard size={24} /></div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Executive Dashboard
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                FinSight v3.0 · C-Suite Summary
              </div>
            </div>
          </div>

          <button 
            onClick={onExportAll}
            className="btn-export"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'var(--accent)', color: '#fff', border: 'none',
              padding: '0.6rem 1rem', borderRadius: '0.75rem', fontWeight: 700,
              cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}
          >
            <Download size={16} />
            Export for Board Meeting
          </button>
        </div>

        {/* KPI Row */}
        <div className="exec-kpi-row" style={{ padding: '2rem 2rem 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
          {[
            { icon: Users, label: 'Market Reach', value: totalUsers.toLocaleString(), color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
            { icon: AlertTriangle, label: 'Systemic Risk', value: `${churnPct}%`, color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
            { icon: DollarSign, label: 'Revenue at Risk', value: `₹${revAtRisk.toLocaleString()}`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
            { icon: Award, label: 'Recoverable Revenue', value: `₹${potentialSaved.toLocaleString()}`, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          ].map(({ icon: Icon, label, value, color, bg }, i) => (
            <div key={i} style={{ background: 'var(--bg-input)', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border)' }}>
              <div style={{ color, background: bg, width: 40, height: 40, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}><Icon size={20} /></div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.25rem' }}>{label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="exec-grid-main" style={{ padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
          {/* Left Column: Charts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
             {/* Forecast Chart */}
             <div style={{ background: 'var(--bg-input)', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                   <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Retention Strategy Impact (6-Month Forecast)</div>
                   <div style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>{s?.forecast?.length ? 'DATA-DRIVEN' : 'PROJECTED'}</div>
                </div>
                <div style={{ height: 200 }}>
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={forecastData}>
                         <defs>
                            <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorSaved" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorBaseline" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                               <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                            </linearGradient>
                         </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                          <XAxis dataKey="month" tick={{fontSize: 10}} />
                          <YAxis hide domain={[0, 'auto']} />
                          <Tooltip />
                          <Area type="monotone" dataKey="baseline" stroke="#94a3b8" strokeDasharray="5 5" fillOpacity={1} fill="url(#colorBaseline)" name="Baseline (No Action)" />
                          <Area type="monotone" dataKey="risk" stroke="#f43f5e" fillOpacity={1} fill="url(#colorRisk)" name="Projected Risk" />
                          <Area type="monotone" dataKey="saved" stroke="#10b981" fillOpacity={1} fill="url(#colorSaved)" name="Recovered Revenue" />
                       </AreaChart>
                   </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
                   <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>🔴 Baseline Risk (No Action)</div>
                   <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>🟢 AI-Optimized Recovery</div>
                </div>
             </div>

             {/* Product Risk Breakdown (only if real product data exists) */}
             <div style={{ display: 'grid', gridTemplateColumns: productRisk.length > 0 ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
                {productRisk.length > 0 && (
                <div style={{ background: 'var(--bg-input)', padding: '1.25rem', borderRadius: '1.25rem', border: '1px solid var(--border)' }}>
                   <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>Revenue Risk by Product</div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {productRisk.map((p, i) => (
                         <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                               <span>{p.name}</span>
                               <span style={{ fontWeight: 700 }}>₹{p.revenue.toLocaleString()}</span>
                            </div>
                            <div style={{ height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3 }}>
                               <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${p.risk}%` }}
                                  style={{ height: '100%', background: COLORS[i % COLORS.length], borderRadius: 3 }} 
                               />
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
                )}

                <div style={{ background: 'var(--bg-input)', padding: '1.25rem', borderRadius: '1.25rem', border: '1px solid var(--border)' }}>
                   <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>Persona Risk Heatmap</div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {segChurn.slice(0, 3).map((seg, i) => (
                         <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS[i] }} />
                            <div style={{ flex: 1 }}>
                               <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{PERSONA_LABELS[seg.segment] || seg.segment}</div>
                               <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{seg.count} high-priority users</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                               <div style={{ fontSize: '0.85rem', fontWeight: 800, color: seg.avg_churn > 0.5 ? '#f43f5e' : '#f59e0b' }}>
                                  {(seg.avg_churn * 100).toFixed(1)}%
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>

          {/* Right Column: Insights & Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
             {/* Strategic Recommendations (AI Powered) */}
             <div style={{ background: 'var(--bg-input)', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border)', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#6366f1' }}>
                   <Lightbulb size={18} />
                   <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Strategic Recommendations</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   {(s?.hypotheses || []).slice(0, 3).map((h, i) => (
                      <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.4)', borderRadius: '0.75rem', border: '1px solid rgba(0,0,0,0.03)' }}>
                         <div style={{ fontWeight: 800, fontSize: '0.8rem', marginBottom: '0.2rem', color: 'var(--text-primary)' }}>{h.title || h.driver}</div>
                         <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{h.hypothesis} <strong>Strategy:</strong> {h.test || h.action}</div>
                      </div>
                   ))}
                   {(!s?.hypotheses || s.hypotheses.length === 0) && (
                     <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                       Analyzing behavior for strategic recommendations...
                     </div>
                   )}
                </div>
             </div>

             {/* Efficiency Gains (Dynamic Metrics) */}
             <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: '1.5rem', borderRadius: '1.25rem', color: '#fff' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1.25rem', color: 'rgba(255,255,255,0.6)' }}>Efficiency Gains</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   {[
                      { label: 'Segmentation', after: '✅ Dynamic RFM' },
                      { label: 'Model Confidence', after: s?.metrics?.roc_auc ? `✅ ${(s.metrics.roc_auc * 100).toFixed(1)}% AUC` : '⏳ Calculating...' },
                      { label: 'Churn Visibility', after: `✅ ${churnPct}% tracked` },
                      { label: 'Revenue Loss', after: `💰 ₹${revAtRisk.toLocaleString()} mapped` },
                   ].map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                         <span style={{ color: 'rgba(255,255,255,0.5)' }}>{row.label}</span>
                         <span style={{ fontWeight: 700 }}>{row.after}</span>
                      </div>
                   ))}
                </div>
                <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: '0.75rem', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center' }}>
                   <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 800 }}>POTENTIAL RECOVERY</div>
                   <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                     ₹{potentialSaved.toLocaleString()}
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* C-Suite Action Playbook (Enterprise Table) */}
        <div style={{ padding: '0 2rem 2rem' }}>
           <div style={{ background: 'var(--bg-input)', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                 <Briefcase size={20} style={{ color: '#6366f1' }} />
                 <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>C-Suite Action Playbook</div>
                 <span className="version-badge" style={{ background: '#6366f1' }}>PRIORITY EXECUTION</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                 <table className="playbook-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                       <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                          <th style={{ padding: '0.75rem', fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Strategic Persona</th>
                          <th style={{ padding: '0.75rem', fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Churn Rate</th>
                          <th style={{ padding: '0.75rem', fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Problem Driver</th>
                          <th style={{ padding: '0.75rem', fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>C-Suite Intervention</th>
                          <th style={{ padding: '0.75rem', fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>ROI Status</th>
                       </tr>
                    </thead>
                    <tbody>
                       {segChurn.slice(0, 4).map((seg, i) => {
                          const persona = PERSONA_LABELS[seg.segment] || seg.segment;
                          const isHighRisk = seg.avg_churn > 0.4;
                          const topDriver = seg.top_drivers?.[0];
                          const driverLabel = topDriver?.feature || 'Behavioral Drift';
                          const riskLevel = isHighRisk ? 'high' : seg.avg_churn > 0.2 ? 'medium' : 'low';
                          const actionLookup = { high: 'Emergency cashback + priority outreach', medium: 'Re-engagement sequence + incentive', low: 'Loyalty tier upgrade + cross-sell' };
                          const actionLabel = actionLookup[riskLevel];
                          return (
                             <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td style={{ padding: '1rem 0.75rem' }}>
                                   <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{persona}</div>
                                   <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{seg.segment}</div>
                                </td>
                                <td style={{ padding: '1rem 0.75rem' }}>
                                   <span style={{ fontWeight: 800, color: isHighRisk ? '#f43f5e' : '#f59e0b' }}>
                                      {(seg.avg_churn * 100).toFixed(1)}%
                                   </span>
                                </td>
                                <td style={{ padding: '1rem 0.75rem', fontSize: '0.8rem', color: '#475569' }}>
                                   {driverLabel}
                                </td>
                                <td style={{ padding: '1rem 0.75rem' }}>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6366f1', background: 'rgba(99,102,241,0.08)', padding: '0.3rem 0.6rem', borderRadius: '0.5rem', width: 'fit-content' }}>
                                      <Zap size={12} />
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{actionLabel}</span>
                                   </div>
                                </td>
                                <td style={{ padding: '1rem 0.75rem' }}>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: isHighRisk ? '#f43f5e' : '#10b981' }} />
                                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isHighRisk ? '#f43f5e' : '#10b981' }}>
                                         {isHighRisk ? 'URGENT ROI' : 'PROF. GROWTH'}
                                      </span>
                                   </div>
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
            </div>
         </div>

         {/* ── Segment Risk Architecture (The "Why" per Segment) ── */}
         <div style={{ padding: '1.5rem 2rem 2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
               <Brain size={22} style={{ color: '#8b5cf6' }} />
               <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Segment Risk Architecture</h2>
               <span className="version-badge" style={{ background: '#8b5cf6' }}>SHAP EXPLAINABILITY</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
               {segChurn.slice(0, 4).map((seg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                     style={{ 
                        background: 'var(--bg-input)', 
                        padding: '1.25rem', 
                        borderRadius: '1.25rem', 
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                     }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: COLORS[i % COLORS.length] }}>{PERSONA_LABELS[seg.segment] || seg.segment}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{seg.count} Users</span>
                     </div>
                     
                     <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.4 }}>
                        {seg.explanation}
                     </div>

                     <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {seg.top_drivers?.map((d, di) => (
                           <div key={di} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontWeight: 700 }}>
                                 <span style={{ color: 'var(--text-secondary)' }}>{d.feature}</span>
                                 <span style={{ color: d.direction === 'increases_churn' ? '#f43f5e' : '#10b981' }}>
                                    {d.direction === 'increases_churn' ? '↑ Risk' : '↓ Risk'}
                                 </span>
                              </div>
                              <div style={{ height: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 2 }}>
                                 <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, d.importance * 400)}%` }}
                                    style={{ 
                                       height: '100%', 
                                       background: d.direction === 'increases_churn' ? '#f43f5e' : '#10b981',
                                       borderRadius: 2
                                    }} 
                                 />
                              </div>
                           </div>
                        ))}
                     </div>
                  </motion.div>
               ))}
            </div>
         </div>

        {/* Footer */}
        <div style={{ padding: '1rem 2rem', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>CONFIDENTIAL · FOR INTERNAL BOARD REVIEW ONLY</div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: '#6366f1', fontWeight: 700 }}>
              <ShieldAlert size={12} /> SECURE DATA PROCESSING ACTIVE
           </div>
        </div>
      </motion.div>
    </div>
  );
}
