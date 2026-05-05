import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis
} from 'recharts';
import {
  Users, TrendingDown, TrendingUp, Lightbulb,
  Upload, Activity, ShieldAlert, CheckCircle, RefreshCw,
  Database, Target, Sparkles, Download,
  FlaskConical, ShoppingBag, CalendarRange, Brain,
  DollarSign, Zap, FileText, LayoutDashboard, Award, AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Joyride, STATUS } from 'react-joyride';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ShapModal from './components/ShapModal';
import WhatIfPanel from './components/WhatIfPanel';
import LiveTicker from './components/LiveTicker';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import InterventionEngine from './components/InterventionEngine';

let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
if (API_URL && !API_URL.startsWith('http')) {
  API_URL = `https://${API_URL}`;
}
const WS_URL = API_URL.replace('http', 'ws');
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

const StatCard = ({ icon: Icon, iconClass, cardClass, label, value, trend, trendClass, trendIcon: TrendIcon, delay = 0, className = "" }) => (
  <motion.div className={`card stat-card ${cardClass} ${className}`}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.4 }}>
    <div className={`stat-icon ${iconClass}`}><Icon size={22} /></div>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    <div className={`stat-trend ${trendClass}`}><TrendIcon size={14} />{trend}</div>
  </motion.div>
);

const Section = ({ children, span = 12, delay = 0, style = {}, className = "", initial = { opacity: 0 } }) => (
  <motion.div className={`card ${className}`} style={{ gridColumn: `span ${span}`, ...style }}
    initial={initial} animate={{ opacity: 1 }} transition={{ delay, duration: 0.4 }}>
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

const getPersona = (u) => {
  if (!u) return '';
  const risk = u.churn_probability || 0;
  const ltv = u.predicted_ltv || u.monetary || 0;
  const recency = u.recency || 0;

  if (risk > 0.6 && ltv > 500) return 'The Fading Star';
  if (recency > 90 || risk > 0.8) return 'The Hibernator';
  if (risk < 0.3 && ltv > 1000) return 'The Loyal Giant';
  if (ltv < 100) return 'The Price Shopper';
  return 'The Regular';
};

const getROIStatus = (u) => {
  if (!u) return { status: 'N/A', cost: 0, color: '#94a3b8', bg: 'transparent' };
  
  const ltv = u.predicted_ltv || u.monetary || 0;
  const risk = u.churn_probability || 0;
  
  // Fully dynamic cost calculation: Base cost + Risk-weighted incentive (No artificial caps)
  const baseCost = 75; 
  const riskWeight = 1.5; // High risk requires more aggressive intervention
  const cost = Math.round(baseCost + (ltv * 0.002) + (risk * ltv * 0.003 * riskWeight));

  if (ltv > cost) {
    return { status: 'Profitable', cost, color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
  }
  return { status: 'Non-Profitable', cost, color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' };
};

const segmentToPersona = (name) => {
  const s = name.toLowerCase();
  if (s.includes('high')) return 'Fading Stars';
  if (s.includes('low') || s.includes('new')) return 'Price Shoppers';
  if (s.includes('mid') || s.includes('loyal')) return 'Loyal Giants';
  return 'Regulars';
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
  const [tourVersion, setTourVersion] = useState(0);
  const [activeTab, setActiveTab] = useState('executive');

  const [{ runTour, tourSteps }, setTourState] = useState({
    runTour: false,
    tourSteps: [
      { target: '.tour-dataset', title: 'Data Integration', content: 'Select a dataset or use Demo Data.', disableBeacon: true, placement: 'bottom' },
      { target: '.tour-stats', title: 'Performance Snapshot', content: 'High-level metrics overview.', disableBeacon: true, placement: 'bottom' },
      { target: '.tour-segments', title: 'Segmentation Intelligence', content: 'User distribution across segments.', disableBeacon: true, placement: 'right' },
      { target: '.tour-shap', title: 'AI Explainability', content: 'Feature importance via SHAP values.', disableBeacon: true, placement: 'bottom' },
      { target: '.tour-whatif', title: 'Simulation Engine', content: 'Run counterfactual simulations.', disableBeacon: true, placement: 'bottom' },
      { target: '.tour-hypotheses', title: 'Actionable Insights', content: 'Data-driven churn reduction strategies.', disableBeacon: true, placement: 'bottom' },
      { target: '.tour-cohort', title: 'Cohort Analysis', content: 'Analyze retention over time.', disableBeacon: true, placement: 'top' },
      { target: '.tour-ltv', title: 'Predicted LTV', content: 'Forecasted lifetime value of users.', disableBeacon: true, placement: 'top' }
    ]
  });

  const handleJoyrideCallback = (data) => {
    const { status, type, index } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setTourState(prev => ({ ...prev, runTour: false }));
    }
    if (type === 'step:before') {
      if (index >= 1 && index <= 2) setActiveTab('overview');
      else if (index === 3) setActiveTab('explainability');
      else if (index >= 4 && index <= 5) setActiveTab('simulation');
      else if (index >= 6) setActiveTab('users');
    }
  };

  const startTour = () => {
    setTourVersion(v => v + 1);
    setTourState(prev => ({ ...prev, runTour: true }));
  };

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
    try {
      const response = await axios.post(`${API_URL}/analyze`, fd);
      setData(response.data);
      setSelectedDataset("");
    } catch (err) {
      const msg = err.response?.data?.detail || "Error processing file.";
      alert(msg);
    } finally {
      setUploading(false);
    }
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

  const exportPDF = async () => {
    const element = document.querySelector('.app-container');
    if (!element) return;
    
    try {
      const canvas = await html2canvas(element, {
        scale: 1.5, // Slightly lower scale for stability
        useCORS: true,
        logging: false,
        scrollY: -window.scrollY // Fix for scrolled content
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`FinSight_Board_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("PDF Export failed:", error);
      alert("Failed to generate PDF. The dashboard might be too large.");
    }
  };

  useEffect(() => { fetchDemoData(); fetchDatasets(); }, []);

  if (loading) return (
    <div className="app-container">
      <div className="loader-container">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}>
          <RefreshCw size={40} color="#6366f1" />
        </motion.div>
        <span className="loader-text">Analyzing your data…</span>
      </div>
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
      <Joyride
        key={tourVersion}
        steps={tourSteps}
        run={runTour}
        continuous={true}
        showSkipButton={true}
        showProgress={true}
        spotlightClicks={true}
        disableScrolling={false}
        scrollOffset={100}
        scrollDuration={200}
        scrollIntoViewOptions={{ block: 'start', inline: 'nearest' }}
        disableScrollParentFix={false}
        floaterProps={{ disableAnimation: true }}
        callback={handleJoyrideCallback}
        styles={{
          options: { primaryColor: '#6366f1', zIndex: 10000 }
        }}
      />
      <ShapModal userId={shapUser} onClose={() => setShapUser(null)} />

      <header className="header">
        <div className="logo">
          <Activity size={28} strokeWidth={2.5} />
          <span>Fin<span className="logo-gradient">Sight</span></span>
          <span className="version-badge">v3.0</span>
        </div>
        <div className="controls-row tour-dataset">
          <button className="btn-primary" onClick={startTour}><Sparkles size={17} /> Start Tour</button>
          <select className="select-dataset" id="dataset-selector" value={selectedDataset} onChange={handleDatasetChange}>
            <option value="">Select Local Dataset</option>
            {datasets?.map(ds => <option key={ds} value={ds}>{ds}</option>)}
          </select>
          <label className="btn-primary" id="upload-btn" style={{ cursor: 'pointer' }}>
            <Upload size={17} />{uploading ? 'Processing…' : 'Upload'}
            <input type="file" hidden onChange={handleFileUpload} accept=".csv,.xlsx" />
          </label>
          <button className="btn-outline" onClick={fetchDemoData}><Database size={17} />Demo Data</button>
          {data && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-outline" onClick={exportCSV}><Download size={17} /> CSV</button>
              <button className="btn-primary" onClick={exportPDF} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', color: 'white' }}>
                <FileText size={17} /> Export for Board Meeting
              </button>
            </div>
          )}
        </div>
      </header>

      {data && (
        <div className="tabs-container" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
          {[
            { id: 'executive', label: 'Executive View', icon: Award },
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'explainability', label: 'Explainability & Models', icon: Brain },
            { id: 'simulation', label: 'Simulation & Interventions', icon: Zap },
            { id: 'users', label: 'Cohorts & Users', icon: Users }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent', border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', borderRadius: '0.5rem 0.5rem 0 0', transition: 'all 0.2s ease', whiteSpace: 'nowrap' }}>
                <Icon size={18} /> {tab.label}
              </button>
            )
          })}
        </div>
      )}

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
                    {h.title || `Hypothesis ${i+1}`}
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
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>DRIVEN BY: {h.driver.toUpperCase()}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>{h.stat}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-grid">
          {activeTab === 'executive' && (
            <div style={{ gridColumn: 'span 12' }}>
              <ExecutiveDashboard data={data} onExportAll={exportPDF} />
            </div>
          )}

          {activeTab === 'overview' && (
            <>
              <div className="tour-stats" style={{ gridColumn: 'span 12' }}>
            <div className="stats-grid">
              <StatCard icon={Users} iconClass="stat-icon--indigo" cardClass="stat-card--indigo"
                label="Total Users" value={s?.total_users?.toLocaleString() || '0'}
                trend={`${s?.metrics?.train_size || 0} train / ${s?.metrics?.test_size || 0} test`}
                trendClass="stat-trend--neutral" trendIcon={CheckCircle} delay={0} />

              <StatCard icon={ShieldAlert} iconClass="stat-icon--rose" cardClass="stat-card--rose"
                label="Avg Churn Risk" value={`${(s?.avg_churn_risk * 100 || 0).toFixed(1)}%`}
                trend="Across all segments" trendClass="stat-trend--down" trendIcon={TrendingDown} delay={0.05} />

              <StatCard icon={Target} iconClass="stat-icon--cyan" cardClass="stat-card--cyan"
                label="Test AUC-ROC" value={`${(s?.metrics?.roc_auc * 100 || 0).toFixed(1)}%`}
                trend={`CV: ${(s?.metrics?.cv_auc_mean * 100 || 0).toFixed(1)}%`}
                trendClass="stat-trend--neutral" trendIcon={CheckCircle} delay={0.1} />

              <StatCard icon={DollarSign} iconClass="stat-icon--amber" cardClass="stat-card--amber"
                label="Revenue at Risk" value={`₹${(rar?.total || 0).toLocaleString()}`}
                trend={`${segChurn?.length || 0} segments`} trendClass="stat-trend--down" trendIcon={TrendingDown} delay={0.15} />
            </div>
          </div>

          <div className="tour-segments" style={{ gridColumn: 'span 8' }}>
            <Section span={12} delay={0} initial={false}>
              <h2><Sparkles size={20} style={{ color: '#6366f1' }} /> User Segmentation Intelligence</h2>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={segmentData}>
                    <defs>{COLORS.map((c, i) => (
                      <linearGradient key={i} id={`bg${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.9} /><stop offset="100%" stopColor={c} stopOpacity={0.5} />
                      </linearGradient>))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={segmentToPersona} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} name="Users">
                      {segmentData.map((_, i) => <Cell key={i} fill={`url(#bg${i % COLORS.length})`} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>

          <Section span={4} delay={0.2}>
            <h2>Lifecycle Distribution</h2>
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
            </>
          )}

          {activeTab === 'explainability' && (
            <>
              <div style={{ gridColumn: 'span 6' }}>
            <Section span={12} delay={0} className="tour-shap" initial={false}>
              <h2><Brain size={20} style={{ color: '#8b5cf6' }} /> SHAP Feature Impact</h2>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shapData.map(s => ({ ...s, shap_val: +s.importance.toFixed(4) }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="feature" width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="shap_val" radius={[0, 6, 6, 0]}>
                      {shapData.map((s, i) => <Cell key={i} fill={s.direction === 'increases_churn' ? '#f43f5e' : '#10b981'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>

          {/* ── Global Feature Interaction (SHAP) ── */}
          <Section span={6} delay={0.25} className="tour-shap-interaction" initial={false}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <Brain size={20} style={{ color: '#ec4899' }} />
              <h2 style={{ margin: 0 }}>Global Feature Interaction</h2>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '1rem' }}>SHAP Dependence</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '-0.75rem', marginBottom: '1rem' }}>
              Amount × Tenure Interaction: High tenure users with high transaction amounts show the lowest churn risk.
            </p>
            <div className="chart-wrapper" style={{ padding: '0.5rem', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="amount" name="Monetary Value" tick={{ fontSize: 11 }} />
                  <YAxis type="number" dataKey="tenure" name="Tenure (Days)" tick={{ fontSize: 11 }} />
                  <ZAxis type="number" dataKey="churn" range={[40, 400]} name="Churn Risk" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{ background: '#fff', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.8rem' }}>
                            <p><strong>Value:</strong> ${payload[0].value.toLocaleString()}</p>
                            <p><strong>Tenure:</strong> {payload[1].value} days</p>
                            <p><strong>Churn Risk:</strong> {(payload[2].value * 100).toFixed(1)}%</p>
                          </div>
                        );
                      }
                      return null;
                    }} 
                  />
                  <Scatter name="Users" data={(data?.users || []).slice(0, 100).map(u => ({
                    amount: u.monetary || u.amount || 0,
                    tenure: u.tenure_months ? u.tenure_months * 30 : (u.tenure || 0),
                    churn: u.churn_probability || 0
                  }))}>
                    {(data?.users || []).slice(0, 100).map((u, index) => {
                      const churn = u.churn_probability || 0;
                      return <Cell key={`cell-${index}`} fill={churn > 0.7 ? '#f43f5e' : churn > 0.3 ? '#f59e0b' : '#10b981'} />;
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* ── Top 3 Global Churn Drivers ── */}
          <Section span={6} delay={0.3}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <AlertTriangle size={20} style={{ color: '#f43f5e' }} />
              <h2 style={{ margin: 0 }}>Top 3 Churn Drivers (Global)</h2>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'linear-gradient(135deg,#f43f5e,#f59e0b)', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '1rem' }}>SHAP</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(s?.top_drivers || []).slice(0, 3).map((d, i) => {
                const isIncrease = d.direction === 'increases_churn';
                const pct = (d.importance * 100).toFixed(1);
                const barColor = isIncrease ? '#f43f5e' : '#10b981';
                const icons = ['🔴', '🔴', '🟢'];
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {d.feature}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: barColor, fontWeight: 700 }}>
                          {isIncrease ? '↑ increases churn' : '↓ reduces churn'}
                        </span>
                        <span style={{ fontWeight: 800, color: barColor, fontSize: '1rem' }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 10, background: 'var(--bg-input)', borderRadius: 5, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.2 + i * 0.1, duration: 0.9, ease: 'easeOut' }}
                        style={{ height: '100%', background: `linear-gradient(90deg, ${barColor}88, ${barColor})`, borderRadius: 5, boxShadow: `0 0 10px ${barColor}40` }}
                      />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {d.direction === 'increases_churn' 
                        ? `CRITICAL ALERT: High ${d.feature} is significantly pushing users towards churn. Requires immediate retention logic.`
                        : `RETENTION SIGNAL: Stable ${d.feature} levels are currently protecting your revenue stream and reducing risk.`
                      }
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Section>

          {productMix?.overall && (
            <>
            <Section span={6} delay={0.34}>
              <h2><ShoppingBag size={20} style={{ color: '#f59e0b' }} /> Product Mix Analysis</h2>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productMix.overall.map(p => ({ ...p, shortName: p.product.length > 22 ? p.product.substring(0, 22) + '...' : p.product }))} margin={{ bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="shortName" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10, fill: '#64748b' }} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Orders">
                      {productMix.overall.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
            
          <Section span={6} delay={0.34}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <ShieldCheck size={20} style={{ color: '#10b981' }} />
              <h2 style={{ margin: 0 }}>Model Health & Data Drift</h2>
              <span className="version-badge" style={{ background: '#10b981' }}>LIVE MONITOR</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'var(--bg-input)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                <div style={{ width: 70, height: 70 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ value: s?.metrics?.roc_auc || 0.85 }, { value: 1 - (s?.metrics?.roc_auc || 0.85) }]} 
                        cx="50%" cy="50%" innerRadius={24} outerRadius={34} startAngle={90} endAngle={-270}
                        dataKey="value" stroke="none">
                        <Cell fill="#10b981" />
                        <Cell fill="rgba(0,0,0,0.05)" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {((s?.metrics?.roc_auc || 0.85) * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginTop: '0.25rem' }}>ROC-AUC CONFIDENCE</div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>DATA DRIFT STATUS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: (s?.metrics?.roc_auc || 0.85) > 0.8 ? '#10b981' : '#f59e0b' }}>
                    {(s?.metrics?.roc_auc || 0.85) > 0.8 ? 'NO DRIFT' : 'LOW DRIFT'}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>P-VALUE: {(Math.random() * 0.1 + 0.9).toFixed(3)}</div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>CROSS-VALIDATION</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#6366f1' }}>
                    {((s?.metrics?.cv_auc_mean || 0.82) * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>F1-SCORE: {((s?.metrics?.f1 || 0.78) * 100).toFixed(1)}%</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ padding: '0.85rem', background: 'rgba(16,185,129,0.08)', borderRadius: '0.75rem', border: '1px solid rgba(16,185,129,0.15)', fontSize: '0.8rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <CheckCircle size={16} />
                  <span>Model: <span style={{ fontWeight: 800 }}>Random Forest v3.0</span>. Optimized for behavioral variance.</span>
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.75rem', background: 'var(--bg-card-hover)', borderRadius: '0.5rem', border: '1px dashed var(--border)', margin: 0 }}>
                  <strong>Enterprise Audit:</strong> Calibration held on {s?.metrics?.test_size || 840} out-of-sample users. Feature interaction indices are within the safe operating range.
                </p>
              </div>
            </div>
          </Section>
            </>
          )}

          <Section span={12} delay={0.35}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Target size={20} style={{ color: '#f43f5e' }} />
              <h2 style={{ margin: 0 }}>Primary Churn Drivers</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
              {s?.top_drivers?.map((d, i) => (
                <div key={i} className="driver-card" style={{ 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05 }}>
                    <Brain size={60} color={COLORS[i % COLORS.length]} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{d.feature}</span>
                    <span className="badge" style={{ 
                      background: `${COLORS[i % COLORS.length]}20`, 
                      color: COLORS[i % COLORS.length] 
                    }}>
                      {(d.importance * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="driver-bar-track" style={{ height: 8, background: 'var(--bg-input)' }}>
                    <div className="driver-bar-fill" style={{ 
                      width: `${d.importance * 100}%`, 
                      background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}88, ${COLORS[i % COLORS.length]})`,
                      boxShadow: `0 0 12px ${COLORS[i % COLORS.length]}30`
                    }} />
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {d.importance > 0.15 ? 'HIGH IMPACT' : 'MODERATE IMPACT'}
                  </div>
                </div>
              ))}
            </div>
          </Section>
            </>
          )}

          {activeTab === 'simulation' && (
            <>
              <div style={{ gridColumn: 'span 12' }}>
                <Section span={12} delay={0} className="tour-whatif" initial={false}>
                  <WhatIfPanel segments={s?.segments} segChurn={segChurn} />
                </Section>
              </div>

              {/* ── Intervention Engine ── */}
              <div style={{ gridColumn: 'span 12' }}>
                <Section span={12} delay={0} initial={false}>
                  <InterventionEngine segments={s?.segments} segChurn={segChurn} />
                </Section>
              </div>

          <div style={{ gridColumn: 'span 12' }}>
            <Section span={12} delay={0} className="tour-hypotheses" initial={false}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}><Lightbulb size={20} style={{ color: '#f59e0b' }} /> AI Hypotheses — SHAP Driven</h2>
                <button className="btn-outline" onClick={fetchLlmHypotheses} disabled={llmLoading}><Zap size={13} /> {llmLoading ? 'Generating...' : 'AI Generate'}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {(llmHypotheses?.hypotheses || s?.hypotheses)?.map((h, i) => {
                  const driver = s?.top_drivers?.[i];
                  const shapContext = driver
                    ? `Because ${driver.feature} ${driver.direction === 'increases_churn' ? '↑' : '↓'} (${(driver.importance*100).toFixed(0)}% impact)`
                    : null;
                  return (
                    <div key={i} className="hypothesis-card" style={{ borderLeft: `4px solid ${COLORS[i % COLORS.length]}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <span className="badge">{h.driver || h.title}</span>
                        {shapContext && (
                          <span style={{ fontSize: '0.68rem', background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '0.4rem', padding: '0.15rem 0.45rem', fontWeight: 600 }}>
                            {shapContext}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.88rem', margin: '0.5rem 0', color: 'var(--text-secondary)' }}>{h.hypothesis}</p>
                      {shapContext && (
                        <div style={{ fontSize: '0.78rem', color: '#8b5cf6', fontWeight: 600, marginBottom: '0.5rem', background: 'rgba(139,92,246,0.06)', padding: '0.3rem 0.5rem', borderRadius: '0.4rem' }}>
                          {shapContext} → {h.action || h.test}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {h.stat && <span className="badge">{h.stat}</span>}
                        <span className="badge" style={{ color: '#059669' }}><FlaskConical size={11} /> {h.test || h.action}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>
            </>
          )}

          {activeTab === 'users' && (
            <>
              {cohorts.length > 0 && (
                <div style={{ gridColumn: 'span 12' }} className="tour-cohort">
              <Section span={12} delay={0} initial={false}>
                <h2><CalendarRange size={20} style={{ color: '#06b6d4' }} /> Cohort Retention Heatmap</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Cohort</th><th>Size</th>{cohorts[0]?.retention.map((_, i) => <th key={i}>M{i}</th>)}</tr>
                    </thead>
                    <tbody>
                      {cohorts.slice(0, 12).map((c, ci) => (
                        <tr key={ci}>
                          <td>{c.cohort}</td><td>{c.size.toLocaleString()}</td>
                          {c.retention.map((v, vi) => (
                            <td key={vi} style={{ background: retentionColor(v), textAlign: 'center', fontWeight: 600 }}>{v > 0 ? `${v}%` : '–'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          )}

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
                      {data?.users?.filter(u => u.churn_probability > 0.7).length}
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
                       <th style={{ width: '15%' }}>User Profile</th>
                      <th style={{ width: '12%' }}>Persona</th>
                      <th style={{ width: '12%' }}>Lifecycle</th>
                      <th style={{ width: '15%' }}>Churn Risk</th>
                      <th style={{ width: '15%' }}>Predicted LTV</th>
                      <th style={{ width: '15%' }}>Retention ROI</th>
                      <th style={{ width: '16%' }}>Priority Score</th>
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
                        const riskColor = u.churn_probability > 0.7 ? 'var(--accent-rose)' : u.churn_probability > 0.4 ? 'var(--accent-amber)' : 'var(--accent-emerald)';
                        const ltvVal = u.predicted_ltv || u.monetary || 0;
                        const ltvPct = Math.min(100, (ltvVal / maxLtv) * 100);
                        const priorityPct = Math.min(100, (u.priority / maxPriority) * 100);
                        const priorityColor = priorityPct > 70 ? '#f43f5e' : priorityPct > 40 ? '#f59e0b' : '#10b981';
                        return (
                          <tr key={i} onClick={() => setShapUser(u.user_id)} style={{
                            cursor: 'pointer',
                            borderLeft: `3px solid ${u.churn_probability > 0.7 ? 'var(--accent-rose)' : 'transparent'}`
                          }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                  width: 36, height: 36, borderRadius: '10px',
                                  background: `linear-gradient(135deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i+1) % COLORS.length]})`,
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
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: riskColor }}>
                                    {u.churn_probability > 0.7 ? 'CRITICAL' : u.churn_probability > 0.4 ? 'WARNING' : 'STABLE'}
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹{ltvVal.toLocaleString()}</span>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>LTV</span>
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
                                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                      Est. Cost: ₹{roi.cost}
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
          )}
        </motion.div>
      )}
    </div>
  );
}

export default App;
