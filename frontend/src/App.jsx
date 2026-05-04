import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Users, TrendingDown, TrendingUp, Lightbulb,
  Upload, Activity, ShieldAlert, CheckCircle, RefreshCw,
  Database, BarChart3, Target, Sparkles, Download,
  FlaskConical, ShoppingBag, CalendarRange, Brain,
  DollarSign, Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import ShapModal from './components/ShapModal';
import WhatIfPanel from './components/WhatIfPanel';
import LiveTicker from './components/LiveTicker';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981'];
const CHART_COLORS = ['#6366f1', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.75rem 1rem', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', fontSize: '0.85rem' }}>
      <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{label}</p>
      {payload.map((e, i) => <p key={i} style={{ color: e.color, fontWeight: 500 }}>{e.name}: {typeof e.value === 'number' ? e.value.toLocaleString() : e.value}</p>)}
    </div>
  );
};

const StatCard = ({ icon: Icon, iconClass, cardClass, label, value, trend, trendClass, trendIcon: TrendIcon, delay = 0 }) => (
  <motion.div className={`card stat-card ${cardClass}`} style={{ gridColumn: 'span 3' }}
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
    <div className={`stat-icon ${iconClass}`}><Icon size={22} /></div>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    <div className={`stat-trend ${trendClass}`}><TrendIcon size={14} />{trend}</div>
  </motion.div>
);

const Section = ({ children, span = 12, delay = 0, style = {} }) => (
  <motion.div className="card" style={{ gridColumn: `span ${span}`, ...style }}
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5 }}>
    {children}
  </motion.div>
);

const retentionColor = (val) => {
  if (val >= 80) return '#dcfce7';
  if (val >= 60) return '#bbf7d0';
  if (val >= 40) return '#fef9c3';
  if (val >= 20) return '#fed7aa';
  if (val > 0) return '#fecaca';
  return '#f1f5f9';
};

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [shapUser, setShapUser] = useState(null);
  const [llmHypotheses, setLlmHypotheses] = useState(null);
  const [llmLoading, setLlmLoading] = useState(false);

  const fetchDatasets = async () => {
    try { setDatasets((await axios.get(`${API_URL}/list-datasets`)).data.datasets || []); }
    catch { setDatasets([]); }
  };
  const fetchDemoData = async () => {
    setLoading(true);
    try { setData((await axios.get(`${API_URL}/demo-data`)).data); setSelectedDataset(""); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  const handleDatasetChange = async (e) => {
    const f = e.target.value; if (!f) return;
    setSelectedDataset(f); setLoading(true);
    try { setData((await axios.get(`${API_URL}/analyze-local?filename=${f}`)).data); }
    catch { alert("Error loading dataset."); }
    finally { setLoading(false); }
  };
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    setUploading(true);
    try { setData((await axios.post(`${API_URL}/analyze`, fd)).data); setSelectedDataset(""); }
    catch { alert("Error processing file."); }
    finally { setUploading(false); }
  };
  const fetchLlmHypotheses = async () => {
    setLlmLoading(true);
    try {
      const r = await axios.get(`${API_URL}/llm-hypotheses`);
      setLlmHypotheses(r.data);
    } catch { setLlmHypotheses(null); }
    setLlmLoading(false);
  };

  const exportCSV = () => {
    if (!data?.users?.length) return;
    const keys = Object.keys(data.users[0]);
    const csv = [keys.join(','), ...data.users.map(u => keys.map(k => JSON.stringify(u[k] ?? '')).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'finsight_report.csv'; a.click();
  };

  useEffect(() => { fetchDemoData(); fetchDatasets(); }, []);

  if (loading) return (
    <div className="app-container loader-container">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}>
        <RefreshCw size={40} color="#6366f1" />
      </motion.div>
      <span className="loader-text">Analyzing your data…</span>
    </div>
  );

  const s = data?.summary;
  const segmentData = s?.segments ? Object.entries(s.segments).map(([name, value]) => ({ name, value })) : [];
  const lifecycleData = s?.lifecycle_stages ? Object.entries(s.lifecycle_stages).map(([name, value]) => ({ name, value })) : [];
  const segChurn = s?.segment_churn || [];
  const shapData = s?.shap_data || [];
  const cohorts = s?.cohort_data || [];
  const productMix = s?.product_mix;
  const rar = s?.revenue_at_risk;

  return (
    <div className="app-container">
      <ShapModal userId={shapUser} onClose={() => setShapUser(null)} />

      {/* ─── Header ─── */}
      <header className="header">
        <div className="logo">
          <Activity size={28} strokeWidth={2.5} />
          <span>Fin<span className="logo-gradient">Sight</span></span>
          <span className="version-badge">v3.0</span>
        </div>
        <div className="controls-row">
          <select className="select-dataset" id="dataset-selector" value={selectedDataset} onChange={handleDatasetChange}>
            <option value="">Select Local Dataset</option>
            {datasets?.length > 0 && <option value="all" style={{ fontWeight: 600 }}>🚀 Train on All Datasets</option>}
            {datasets?.map(ds => <option key={ds} value={ds}>{ds}</option>)}
          </select>
          <label className="btn-primary" id="upload-btn" style={{ cursor: 'pointer' }}>
            <Upload size={17} />{uploading ? 'Processing…' : 'Upload'}
            <input type="file" hidden onChange={handleFileUpload} accept=".csv,.xlsx" />
          </label>
          <button className="btn-outline" id="demo-btn" onClick={fetchDemoData}><Database size={17} />Demo Data</button>
          {data && <button className="btn-outline" id="export-btn" onClick={exportCSV}><Download size={17} />Export CSV</button>}
        </div>
      </header>

      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-grid">

          {/* Row 1: Stats (5 cards now) */}
          <StatCard icon={Users} iconClass="stat-icon--indigo" cardClass="stat-card--indigo"
            label="Total Users" value={s?.total_users?.toLocaleString() || '0'}
            trend={`${s?.metrics?.train_size || 0} train / ${s?.metrics?.test_size || 0} test`}
            trendClass="stat-trend--neutral" trendIcon={CheckCircle} delay={0} />

          <StatCard icon={ShieldAlert} iconClass="stat-icon--rose" cardClass="stat-card--rose"
            label="Avg Churn Risk" value={`${(s?.avg_churn_risk * 100 || 0).toFixed(1)}%`}
            trend="Across all segments" trendClass="stat-trend--down" trendIcon={TrendingDown} delay={0.05} />

          <StatCard icon={Target} iconClass="stat-icon--cyan" cardClass="stat-card--cyan"
            label="Test AUC-ROC" value={`${(s?.metrics?.roc_auc * 100 || 0).toFixed(1)}%`}
            trend={`CV: ${(s?.metrics?.cv_auc_mean * 100 || 0).toFixed(1)}% ± ${(s?.metrics?.cv_auc_std * 100 || 0).toFixed(1)}%`}
            trendClass="stat-trend--neutral" trendIcon={CheckCircle} delay={0.1} />

          <StatCard icon={DollarSign} iconClass="stat-icon--amber" cardClass="stat-card--amber"
            label="Revenue at Risk" value={`$${(rar?.total || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            trend={`${segChurn?.length || 0} segments tracked`}
            trendClass="stat-trend--down" trendIcon={TrendingDown} delay={0.15} />

          {/* Row 2: Segments + Lifecycle */}
          <Section span={8} delay={0.15}>
            <h2><Sparkles size={20} style={{ color: '#6366f1' }} /> User Segmentation Intelligence</h2>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segmentData} barCategoryGap="20%">
                  <defs>{COLORS.map((c, i) => (
                    <linearGradient key={i} id={`bg${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.9} /><stop offset="100%" stopColor={c} stopOpacity={0.5} />
                    </linearGradient>))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} name="Users">
                    {segmentData.map((_, i) => <Cell key={i} fill={`url(#bg${i % COLORS.length})`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section span={4} delay={0.2}>
            <h2>Lifecycle Distribution</h2>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={lifecycleData} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                    {lifecycleData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8}
                    formatter={v => <span style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 500 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Row 3: Churn by Segment + SHAP */}
          <Section span={6} delay={0.25}>
            <h2><ShieldAlert size={20} style={{ color: '#f43f5e' }} /> Churn Rate by Segment</h2>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segChurn.map(s => ({ ...s, avg_churn_pct: +(s.avg_churn * 100).toFixed(1), rar: s.total_revenue_at_risk ? `$${s.total_revenue_at_risk.toFixed(0)}` : '' }))} layout="vertical" barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                  <YAxis type="category" dataKey="segment" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(244,63,94,0.04)' }} />
                  <Bar dataKey="avg_churn_pct" name="Churn %" radius={[0, 6, 6, 0]}>
                    {segChurn.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section span={6} delay={0.3}>
            <h2><Brain size={20} style={{ color: '#8b5cf6' }} /> SHAP Feature Impact</h2>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shapData.map(s => ({ ...s, shap_val: +s.importance.toFixed(4) }))} layout="vertical" barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="feature" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139,92,246,0.04)' }} />
                  <Bar dataKey="shap_val" name="Mean |SHAP|" radius={[0, 6, 6, 0]}>
                    {shapData.map((s, i) => <Cell key={i} fill={s.direction === 'increases_churn' ? '#f43f5e' : '#10b981'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f43f5e', marginRight: 4 }}></span>Increases churn</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#10b981', marginRight: 4 }}></span>Decreases churn</span>
            </div>
          </Section>

          {/* Row: What-If Simulation Engine */}
          <Section span={12} delay={0.32}>
            <WhatIfPanel segments={s?.segments} />
          </Section>

          {/* Row: Live Event Stream + Product Mix */}
          <Section span={5} delay={0.34}>
            <LiveTicker />
          </Section>

          {productMix?.overall && (
            <Section span={7} delay={0.34}>
              <h2><ShoppingBag size={20} style={{ color: '#f59e0b' }} /> Product Mix Analysis</h2>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productMix.overall} barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="product" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245,158,11,0.04)' }} />
                    <Bar dataKey="count" name="Transactions" radius={[6, 6, 0, 0]}>
                      {productMix.overall.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}

          {/* Row: Churn Drivers */}
          <Section span={12} delay={0.35}>
            <h2><Target size={20} style={{ color: '#f43f5e' }} /> Primary Churn Drivers</h2>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {s?.top_drivers?.map((d, i) => (
                <div key={i} className="driver-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{d.feature}</span>
                    <span className="badge" style={{ background: `${COLORS[i]}14`, color: COLORS[i], border: `1px solid ${COLORS[i]}30` }}>
                      {(d.importance * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="driver-bar-track"><div className="driver-bar-fill" style={{ width: `${d.importance * 100}%`, background: COLORS[i] }} /></div>
                </div>
              ))}
            </div>
          </Section>

          {/* Row: Testable Hypotheses */}
          <Section span={12} delay={0.38}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}><Lightbulb size={20} style={{ color: '#f59e0b' }} /> Testable Hypotheses</h2>
              <button className="btn-outline" onClick={fetchLlmHypotheses} disabled={llmLoading}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}>
                <Zap size={13} />{llmLoading ? 'Generating...' : '✨ AI Generate'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              {(llmHypotheses?.hypotheses || s?.hypotheses)?.map((h, i) => (
                <div key={i} className="hypothesis-card" style={{ borderLeft: `4px solid ${COLORS[i]}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>{h.driver || h.title}</span>
                    <span className={`badge badge-${(h.impact || h.confidence || 'medium').toLowerCase()}`}>{h.impact || h.confidence} Impact</span>
                  </div>
                  <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: '#475569', marginBottom: '0.75rem' }}>{h.hypothesis}</p>
                  {(h.stat || h.action) && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {h.stat && <span className="badge" style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.15)' }}>📊 {h.stat}</span>}
                      {(h.test || h.action) && (
                        <span className="badge" style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.15)' }}>
                          <FlaskConical size={11} style={{ marginRight: 3 }} />{h.test || h.action}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {llmHypotheses && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Zap size={11} /> Generated via {llmHypotheses.source === 'llm' ? 'Llama 3 (Groq)' : 'Rule-Based Engine'}
              </div>
            )}
          </Section>

          {/* Row: Cohort Retention Heatmap */}
          {cohorts.length > 0 && (
            <Section span={12} delay={0.4}>
              <h2><CalendarRange size={20} style={{ color: '#06b6d4' }} /> Cohort Retention Heatmap</h2>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table cohort-table">
                  <thead>
                    <tr>
                      <th>Cohort</th><th>Size</th>
                      {cohorts[0]?.retention.map((_, i) => <th key={i}>M{i}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.slice(0, 12).map((c, ci) => (
                      <tr key={ci}>
                        <td style={{ fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{c.cohort}</td>
                        <td style={{ fontWeight: 500, color: '#64748b' }}>{c.size.toLocaleString()}</td>
                        {c.retention.map((v, vi) => (
                          <td key={vi} style={{
                            background: retentionColor(v), textAlign: 'center', fontWeight: 600, fontSize: '0.78rem',
                            color: v >= 40 ? '#166534' : v > 0 ? '#9a3412' : '#94a3b8'
                          }}>{v > 0 ? `${v}%` : '–'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Row: User Table with clickable SHAP */}
          <Section span={12} delay={0.42}>
            <h2><Users size={20} style={{ color: '#6366f1' }} /> User-Level Insights <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400, marginLeft: '0.5rem' }}>Click any row for SHAP explanation</span></h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>User ID</th><th>Segment</th><th>Lifecycle</th><th>Churn Risk</th><th>LTV</th><th>$ at Risk</th></tr>
                </thead>
                <tbody>
                  {data?.users?.slice(0, 50).map((u, i) => (
                    <tr key={i} onClick={() => setShapUser(u.user_id)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600, color: '#1e293b' }}>{u.user_id}</td>
                      <td><span className="badge" style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.15)' }}>{u.segment}</span></td>
                      <td>{u.lifecycle}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div className="churn-bar-track">
                            <div className={`churn-bar-fill ${u.churn_probability > 0.6 ? 'churn-bar-fill--high' : 'churn-bar-fill--low'}`}
                              style={{ width: `${u.churn_probability * 100}%` }} />
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '0.82rem', color: u.churn_probability > 0.6 ? '#e11d48' : '#059669' }}>
                            {(u.churn_probability * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>${u.monetary?.toFixed(2)}</td>
                      <td style={{ fontWeight: 600, color: '#f59e0b' }}>${u.revenue_at_risk?.toFixed(2) || '0.00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

        </motion.div>
      )}
    </div>
  );
}

export default App;
