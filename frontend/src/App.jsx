import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis, ReferenceLine
} from 'recharts';
import {
  Users, TrendingDown, TrendingUp, Lightbulb,
  Upload, Activity, ShieldAlert, ShieldCheck, CheckCircle, RefreshCw,
  Database, Target, Download,
  FlaskConical, ShoppingBag, CalendarRange, Brain,
  DollarSign, Zap, FileText, LayoutDashboard, Award, AlertTriangle, Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';
import ShapModal from './components/ShapModal';
import WhatIfPanel from './components/WhatIfPanel';
import LiveTicker from './components/LiveTicker';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import InterventionEngine from './components/InterventionEngine';
import FormulaTooltip from './components/FormulaTooltip';
import ActiveExperiments from './components/ActiveExperiments';
import ModelIntelligenceGuide from './components/ModelIntelligenceGuide';

const Info = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={props.size || 24} 
    height={props.size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
  </svg>
);

let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
if (API_URL && !API_URL.startsWith('http')) {
  API_URL = `https://${API_URL}`;
}
const WS_URL = API_URL.replace('http', 'ws');
const COLORS = ['#10b981', '#6366f1', '#06b6d4', '#f59e0b', '#f43f5e', '#8b5cf6'];
const SEGMENT_COLORS = {
  'Champions': '#10b981',    // Emerald
  'Loyalists': '#6366f1',    // Indigo
  'Promising': '#06b6d4',    // Cyan
  'At Risk': '#f43f5e',      // Rose (Red for Danger)
  'Hibernating': '#94a3b8',  // Slate (Dull for Lapsed)
  'Needs Attention': '#f59e0b', // Amber/Yellow
  'New': '#8b5cf6',          // Violet
};
const CHART_COLORS = ['#6366f1', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];

const formatCurrency = (val) => {
  try {
    if (val === undefined || val === null) return '₹0';
    
    let num;
    if (typeof val === 'object' && val !== null) {
      num = Number(val.value ?? val.total ?? val.amount ?? 0);
    } else {
      num = Number(val);
    }

    if (isNaN(num) || !isFinite(num)) return '₹0';
    
    if (num >= 10000000) { // Crore
       return `₹${(num / 10000000).toFixed(2)}Cr`;
    } else if (num >= 100000) { // Lakh
      return `₹${(num / 100000).toFixed(2)}L`;
    } else if (num >= 1000) { // Thousand
      return `₹${(num / 1000).toFixed(1)}K`;
    }
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  } catch (e) {
    return '₹0';
  }
};

const segmentToPersona = (seg) => {
  const personas = {
    'Champions': 'The Loyal Giant',
    'Loyalists': 'The Steady Pillar',
    'Promising': 'The Rising Star',
    'At Risk': 'The Fading Star',
    'Hibernating': 'The Lost Soul',
    'Needs Attention': 'The Drifting User',
    'New': 'Onboarding'
  };
  return personas[seg] || seg;
};

const formatMetricPct = (val) => {
  if (val === undefined || val === null) return '0%';
  const num = Number(val);
  return isNaN(num) ? '0%' : `${(num * 100).toFixed(1)}%`;
};

const getRiskThresholds = (s) => {
  return {
    high: s?.metrics?.optimal_threshold || 0.4,
    critical: (s?.metrics?.optimal_threshold || 0.4) + 0.2
  };
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '0.75rem 1rem',
      boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
      fontSize: '0.85rem'
    }}>
      <p style={{ fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontSize: '10px', marginBottom: 6, letterSpacing: '0.05em' }}>{label}</p>
      {payload.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color }} />
          <p style={{ color: '#fff', fontWeight: 700 }}>
            {e.name}: {typeof e.value === 'number' && (e.name?.toLowerCase().includes('revenue') || e.name?.toLowerCase().includes('amount') || e.name?.toLowerCase().includes('risk') && e.value > 100) ? formatCurrency(e.value) : (e.value?.toLocaleString() ?? '0')}
          </p>
        </div>
      ))}
      {payload[0]?.payload?.risk_insight && (
        <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, color: payload[0].payload.risk_level === 'High' ? '#f43f5e' : payload[0].payload.risk_level === 'Low' ? '#10b981' : '#94a3b8' }}>
            {payload[0].payload.risk_insight}
          </p>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, iconClass, cardClass, label, value, trend, trendClass, trendIcon: TrendIcon, delay = 0, className = "", logic }) => (
  <FormulaTooltip formula={logic} color={cardClass.includes('indigo') ? '#6366f1' : cardClass.includes('rose') ? '#f43f5e' : cardClass.includes('cyan') ? '#06b6d4' : '#f59e0b'}>
    <motion.div className={`card stat-card ${cardClass} ${className}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.4 }}
      style={{ position: 'relative', cursor: logic ? 'help' : 'default', height: '100%' }}
    >
      <div className={`stat-icon ${iconClass}`}><Icon size={22} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className={`stat-trend ${trendClass}`}><TrendIcon size={14} />{trend}</div>
    </motion.div>
  </FormulaTooltip>
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
  return segmentToPersona(u.segment);
};

const getROIStatus = (u) => {
  if (!u) return { status: 'N/A', cost: 0, color: '#94a3b8', bg: 'transparent' };

  // Real ROI logic: Use centralized backend LTV and Cost
  const isProfitable = u.is_profitable !== undefined ? u.is_profitable : (u.predicted_ltv > (u.monetary + (u.intervention_cost || 15)));
  const cost = u.intervention_cost || 15;

  if (isProfitable) {
    return { status: 'Profitable', cost, color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
  }
  return { status: 'At Risk / Non-Profitable', cost, color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' };
};


function App() {
  console.log("FinSight App Mounting...");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [shapUser, setShapUser] = useState(null);
  const [llmHypotheses, setLlmHypotheses] = useState(null);
  const [llmLoading, setLlmLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('executive');
  const [error, setError] = useState(null);
  const [globalSimResult, setGlobalSimResult] = useState(null);
  const [dataFetched, setDataFetched] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    fetchDatasets();
    if (!data && !dataFetched) {
      fetchDemoData();
      setDataFetched(true);
    }
  }, []);



  const fetchDatasets = async () => {
    try { setDatasets((await axios.get(`${API_URL}/list-datasets`)).data.datasets || []); }
    catch { setDatasets([]); }
  };

  const fetchDemoData = async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    try {
      setData((await axios.get(`${API_URL}/demo-data`)).data);
      setSelectedDataset("");
    } catch (e) {
      console.error(e);
      if (retryCount < 2) {
        console.log(`Retrying demo data fetch... (${retryCount + 1})`);
        setTimeout(() => fetchDemoData(retryCount + 1), 5000);
      } else {
        setError("The analytics engine is taking longer than usual to warm up. Please wait a moment and try clicking 'Demo Data' again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDatasetChange = async (e) => {
    const f = e.target.value; if (!f) return;
    setSelectedDataset(f); setLoading(true);
    try { setData((await axios.get(`${API_URL}/analyze-local?filename=${encodeURIComponent(f)}`)).data); }
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
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#fbbf24', '#fcd34d']
      });
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
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899']
      });
    } catch (error) {
      console.error("PDF Export failed:", error);
      alert("Failed to generate PDF. The dashboard might be too large.");
    }
  };

  console.log("App Render Pass - loading:", loading, "data:", !!data, "error:", !!error);
  if (loading) {
    console.log("Rendering Loader...");
    return (
    <div className="app-container">
      <div className="loader-container" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}>
          <RefreshCw size={60} color="#6366f1" />
        </motion.div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span className="loader-text" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Initializing Intelligence Engine…</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>This may take up to 60 seconds on first load as we process historical datasets.</span>
        </div>
      </div>
    </div>
  );
}

  const s = data?.summary;
  const segmentData = s?.segments ? Object.entries(s.segments).map(([name, value]) => ({ name, value })) : [];
  const lifecycleData = s?.lifecycle_stages ? Object.entries(s.lifecycle_stages).map(([name, value]) => ({ name, value })) : [];
  const segChurn = s?.segment_churn || [];
  const shapData = s?.shap_data || [];
  const cohorts = s?.cohort_data || [];
  const productMix = s?.product_mix;
  const rar = s?.revenue_at_risk;
  const totalUsers = s?.total_users || 0;
  const { high: riskThreshold, critical: criticalThreshold } = getRiskThresholds(s);

  let currentChurnRisk = s?.baseline_churn_rate || s?.avg_churn_risk || 0;
  if (globalSimResult && totalUsers > 0) {
    const churnDecrease = (globalSimResult.original_churn - globalSimResult.simulated_churn) * globalSimResult.users_affected / totalUsers;
    currentChurnRisk -= churnDecrease;
  }
  const churnPct = (currentChurnRisk * 100).toFixed(1);

  console.log("Rendering Main UI - data is present:", !!data);
  return (
    <div className="app-container">

      <ShapModal userId={shapUser} onClose={() => setShapUser(null)} />
      <ModelIntelligenceGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />

      <header className="header">
        <div className="logo">
          <Activity size={28} strokeWidth={2.5} />
          <span>Fin<span className="logo-gradient">Sight</span></span>
          <span className="version-badge">v3.0</span>
        </div>
        <div className="controls-row tour-dataset">

          <select className="select-dataset" id="dataset-selector" value={selectedDataset} onChange={handleDatasetChange}>
            <option value="">Select Local Dataset</option>
            {datasets?.map(ds => <option key={ds} value={ds}>{ds}</option>)}
          </select>
          <label className="btn-primary" id="upload-btn" style={{ cursor: 'pointer' }}>
            <Upload size={17} />{uploading ? 'Processing…' : 'Upload'}
            <input type="file" hidden onChange={handleFileUpload} accept=".csv,.xlsx" />
          </label>
          <button className="btn-outline" onClick={fetchDemoData}><Database size={17} />Demo Data</button>
          <button className="btn-outline" style={{ border: '1px solid #6366f1', color: '#6366f1' }} onClick={() => setShowGuide(true)}>
            <Brain size={17} /> Intelligence Guide
          </button>
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

      {error && !data && (
        <div style={{
          margin: '2rem auto',
          maxWidth: '600px',
          padding: '2rem',
          background: 'rgba(244,63,94,0.05)',
          border: '1px solid #f43f5e',
          borderRadius: '1rem',
          textAlign: 'center'
        }}>
          <AlertTriangle size={48} color="#f43f5e" style={{ marginBottom: '1rem' }} />
          <h2 style={{ color: '#f43f5e', marginBottom: '0.5rem' }}>Engine Warmup in Progress</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn-primary" onClick={() => fetchDemoData()}>
            <RefreshCw size={17} /> Retry Initialization
          </button>
        </div>
      )}

      {data?.summary?.is_synthetic_demo && (
        <div style={{
          margin: '0 0 1rem 0',
          padding: '0.85rem 1rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(245,158,11,0.35)',
          background: 'rgba(245,158,11,0.08)',
          color: '#92400e',
          fontSize: '0.82rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertTriangle size={16} />
          <span>
            Running on fallback synthetic demo data. Upload/select a real dataset to view production metrics.
          </span>
        </div>
      )}

      {data && (
        <div className="tabs-container" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
          {[
            { id: 'executive', label: 'Executive View', icon: Award },
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'experiments', label: 'Active Experiments', icon: FlaskConical },
            { id: 'explainability', label: 'Explainability & Models', icon: Brain },
            { id: 'simulation', label: 'Simulation & Interventions', icon: Zap },
            { id: 'users', label: 'Cohorts & Users', icon: Users }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} id={`tab-${tab.id}`} onClick={() => setActiveTab(tab.id)}
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

      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-grid">
          {activeTab === 'executive' && (
            <div style={{ gridColumn: 'span 12' }}>
              <ExecutiveDashboard data={data} globalSimResult={globalSimResult} onExportAll={exportPDF} onNavigate={() => setActiveTab('explainability')} />
            </div>
          )}

          {activeTab === 'overview' && (
            <>
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
          )}

          {activeTab === 'explainability' && (
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
                          : `Declining ${feat} is an early-warning signal. This behavioral shift contributes ${pct}% to the model's risk assessment.`;
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
                                    background: p.correlation === 'Positive' ? '#f43f5e' : p.correlation === 'Negative' ? '#10b981' : '#94a3b8' 
                                  }} />
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {p.risk_correlation || 'Neutral behavioral footprint.'}
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

              <Section span={6} delay={0.34}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  <ShieldCheck size={20} style={{ color: '#10b981' }} />
                  <h2 style={{ margin: 0 }}>Model Health & Data Drift</h2>
                  <span className="version-badge" style={{ background: '#10b981' }}>LIVE MONITOR</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  <strong>How to read this:</strong> The ROC-AUC score measures the AI's accuracy in predicting churn (closer to 100% is better). Data drift alerts you if user behavior has changed so much that the AI might need retraining.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'var(--bg-input)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                    <div style={{ width: 70, height: 70 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={[{ value: s?.metrics?.roc_auc || 0 }, { value: 1 - (s?.metrics?.roc_auc || 0) }]}
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
                        {formatMetricPct(s?.metrics?.roc_auc)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginTop: '0.25rem' }}>ROC-AUC SCORE</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>DATA DRIFT STATUS</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: s?.metrics?.drift?.status === 'STABLE' ? '#10b981' : s?.metrics?.drift?.status === 'LOW DRIFT' ? '#f59e0b' : '#f43f5e' }}>
                        {s?.metrics?.drift?.status || 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>P-VALUE: {(s?.metrics?.drift?.avg_p_value ?? 0).toFixed(4)}</div>
                    </div>
                    <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '0.05em' }}>CROSS-VALIDATION</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#6366f1' }}>
                        {s?.metrics?.cv_auc_mean ? `${(s.metrics.cv_auc_mean * 100).toFixed(1)}%` : 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>F1-SCORE: {s?.metrics?.f1 ? `${(s.metrics.f1 * 100).toFixed(1)}%` : 'N/A'}</div>
                    </div>
                  </div>

                  {/* ── Confusion Matrix Mini-Grid ── */}
                  <div style={{ marginTop: '1.25rem' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.75rem', letterSpacing: '0.05em' }}>PREDICTION PERFORMANCE (CONFUSION MATRIX)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', textAlign: 'center' }}>
                      {(() => {
                        const cm = s?.metrics?.confusion_matrix;
                        return [
                          { label: 'Correct Churn Detection', val: cm ? `${cm.tp_rate}%` : '—', sub: 'True Positive (TP)', detail: `Recall: ${cm?.recall || 0}%`, color: '#10b981' },
                          { label: 'False Alarms', val: cm ? `${cm.fp_rate}%` : '—', sub: 'False Positive (FP)', detail: `FPR: ${cm?.fp_rate || 0}%`, color: '#f59e0b' },
                          { label: 'Missed Churners', val: cm ? `${cm.fn_rate}%` : '—', sub: 'False Negative (FN)', detail: `FNR: ${cm?.fn_rate || 0}%`, color: '#f43f5e' },
                          { label: 'Correct Retentions', val: cm ? `${cm.tn_rate}%` : '—', sub: 'True Negative (TN)', detail: `Spec: ${cm?.specificity || 0}%`, color: '#6366f1' }
                        ];
                      })().map((m, i) => (
                        <div key={i} style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: '0.6rem', border: '1px dashed var(--border)' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 900, color: m.color, marginBottom: '0.2rem' }}>{m.val}</div>
                          <div style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: '0.2rem' }}>{m.label}</div>
                          <div style={{ fontSize: '0.45rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{m.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: '1.25rem', padding: '1.15rem', background: 'rgba(99,102,241,0.06)', borderRadius: '1.25rem', border: '1px solid rgba(99,102,241,0.12)' }}>
                    <h4 style={{ margin: '0 0 0.65rem 0', fontSize: '0.82rem', fontWeight: 900, color: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Lightbulb size={15} /> Intelligence Guide: Model Health
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ fontWeight: 800, color: '#6366f1', fontSize: '0.75rem', minWidth: '70px' }}>ROC-AUC:</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          The AI's "Grade". <strong>100%</strong> means perfect predictions. <strong>80-90%</strong> is world-class for financial churn models. It measures how well the AI distinguishes between high and low risk users.
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.75rem', minWidth: '70px' }}>DATA DRIFT:</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          The "Stability" check. If user behavior changes (e.g., a new competitor launches), the AI's old training may become stale. <strong>Stable</strong> means the model is still highly reliable.
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.75rem', minWidth: '70px' }}>CONFUSION:</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          Shows the <strong>True Positives</strong> (correctly identified churners) vs. <strong>False Positives</strong> (users who were fine but AI flagged them). Balancing these helps optimize marketing spend.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1.25rem' }}>
                    <div style={{ padding: '0.85rem', background: 'rgba(16,185,129,0.08)', borderRadius: '0.75rem', border: '1px solid rgba(16,185,129,0.15)', fontSize: '0.8rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <CheckCircle size={16} />
                      <span>Model: <span style={{ fontWeight: 800 }}>{s?.model_info?.name || 'Random Forest'}</span>. {s?.model_info?.features_used?.length || 0} features · {s?.metrics?.train_size || 0} train samples.</span>
                    </div>
                  </div>
                </div>
              </Section>


            </>
          )}

          {activeTab === 'simulation' && (
            <>
              <div style={{ gridColumn: 'span 12' }}>
                <Section span={12} delay={0} className="tour-whatif" initial={false}>
                  <WhatIfPanel segments={s?.segments} segChurn={segChurn} domain={s?.domain} onSimulationResult={setGlobalSimResult} />
                </Section>
              </div>

              {/* ── Intervention Engine ── */}
              <div style={{ gridColumn: 'span 12' }}>
                <Section span={12} delay={0} initial={false}>
                  <InterventionEngine segments={s?.segments} segChurn={segChurn} metrics={s?.metrics} domain={s?.domain} />
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
                      // Correctly map hypothesis theme to its corresponding logical SHAP driver
                      const hTheme = (h.driver || h.title || '').toLowerCase();
                      const findDriver = (keywords) => s?.top_drivers?.find(d => keywords.some(k => d.feature.toLowerCase().includes(k)));
                      
                      let driver = null;
                      if (hTheme.includes('inactivity') || hTheme.includes('recency')) {
                        driver = findDriver(['recency', 'delay', 'time since']) || s?.top_drivers?.[0];
                      } else if (hTheme.includes('frequency')) {
                        driver = findDriver(['frequency', 'order count']) || s?.top_drivers?.[1];
                      } else if (hTheme.includes('wallet') || hTheme.includes('monetary')) {
                        driver = findDriver(['spending', 'monetary', 'wallet share']) || s?.top_drivers?.[2];
                      } else {
                        driver = s?.top_drivers?.[i]; // Fallback
                      }

                      const shapContext = driver
                        ? `Because ${driver.feature} ${driver.direction === 'increases_churn' ? '↑' : '↓'} (${(driver.importance * 100).toFixed(0)}% impact)`
                        : null;
                      return (
                        <motion.div 
                          key={i} 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: i * 0.15 }}
                          className="hypothesis-card" 
                          style={{ borderLeft: `4px solid ${COLORS[i % COLORS.length]}` }}
                        >
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
                        </motion.div>
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
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      <strong>How to read this:</strong> This table shows how well we retain users over time. Rows are groups of users joining in the same month (cohort). Columns (M0, M1, etc.) show the percentage of users still active after that many months. Greener cells mean better retention!
                    </p>
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
          )}

          {activeTab === 'experiments' && (
            <div style={{ gridColumn: 'span 12' }}>
              <Section span={12} delay={0} initial={false}>
                <ActiveExperiments hypotheses={s?.hypotheses} segments={s?.segments} metrics={s?.metrics} />
              </Section>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default App;
