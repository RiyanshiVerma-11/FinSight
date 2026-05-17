import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Activity, ShieldAlert, RefreshCw,
  Database, Download, Upload, FlaskConical,
  Brain, Zap, FileText, LayoutDashboard, Award, AlertTriangle
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import confetti from 'canvas-confetti';

import { getRiskThresholds } from '../../utils/formatters';
import ShapModal from '../dashboard/ShapModal';
import ModelIntelligenceGuide from '../dashboard/ModelIntelligenceGuide';
import ExecutiveDashboard from '../dashboard/ExecutiveDashboard';
import ActiveExperiments from '../dashboard/ActiveExperiments';
import OverviewTab from '../dashboard/OverviewTab';
import ExplainabilityTab from '../dashboard/ExplainabilityTab';
import SimulationTab from '../dashboard/SimulationTab';
import UsersTab from '../dashboard/UsersTab';
import { Section } from '../ui/DashboardComponents';

export default function DashboardLayout({
  data, loading, error, datasets, selectedDataset, onDatasetChange,
  onFileUpload, uploading, fetchDemoData,
  llmHypotheses, fetchLlmHypothesesMutation, llmLoading
}) {
  const [shapUser, setShapUser] = useState(null);
  const [activeTab, setActiveTab] = useState('executive');
  const [globalSimResult, setGlobalSimResult] = useState(null);
  const [showGuide, setShowGuide] = useState(false);

  const fetchLlmHypotheses = async () => {
    try {
      await fetchLlmHypothesesMutation();
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#fbbf24', '#fcd34d']
      });
    } catch (err) {
      console.error(err);
    }
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
      const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, logging: false, scrollY: -window.scrollY });
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
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899'] });
    } catch (error) {
      console.error("PDF Export failed:", error);
      alert("Failed to generate PDF. The dashboard might be too large.");
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="loader-container" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}>
            <RefreshCw size={60} color="#6366f1" />
          </motion.div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span className="loader-text" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Initializing Intelligence Engine…</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>This may take up to 60 seconds on first load.</span>
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
  
  let currentChurnRisk = s?.baseline_churn_rate || s?.avg_churn_risk || 0;
  if (globalSimResult && totalUsers > 0) {
    const churnDecrease = (globalSimResult.original_churn - globalSimResult.simulated_churn) * globalSimResult.users_affected / totalUsers;
    currentChurnRisk -= churnDecrease;
  }
  const churnPct = (currentChurnRisk * 100).toFixed(1);

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
          <select className="select-dataset" value={selectedDataset} onChange={(e) => onDatasetChange(e.target.value)}>
            <option value="">Select Local Dataset</option>
            {datasets?.map(ds => <option key={ds} value={ds}>{ds}</option>)}
          </select>
          <label className="btn-primary" style={{ cursor: 'pointer' }}>
            <Upload size={17} />{uploading ? 'Processing…' : 'Upload'}
            <input type="file" hidden onChange={onFileUpload} accept=".csv,.xlsx" />
          </label>
          <button className="btn-outline" onClick={fetchDemoData}><Database size={17} />Demo Data</button>
          <button className="btn-outline" style={{ border: '1px solid #6366f1', color: '#6366f1' }} onClick={() => setShowGuide(true)}>
            <Brain size={17} /> Intelligence Guide
          </button>
          {data && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-outline" onClick={exportCSV}><Download size={17} /> CSV</button>
              <button className="btn-primary" onClick={exportPDF} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', color: 'white' }}>
                <FileText size={17} /> Export PDF
              </button>
            </div>
          )}
        </div>
      </header>

      {error && !data && (
        <div style={{ margin: '2rem auto', maxWidth: '600px', padding: '2rem', background: 'rgba(244,63,94,0.05)', border: '1px solid #f43f5e', borderRadius: '1rem', textAlign: 'center' }}>
          <AlertTriangle size={48} color="#f43f5e" style={{ marginBottom: '1rem' }} />
          <h2 style={{ color: '#f43f5e', marginBottom: '0.5rem' }}>Engine Warmup in Progress</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn-primary" onClick={fetchDemoData}><RefreshCw size={17} /> Retry Initialization</button>
        </div>
      )}

      {data?.summary?.is_synthetic_demo && (
        <div style={{ margin: '0 0 1rem 0', padding: '0.85rem 1rem', borderRadius: '0.75rem', border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: '#92400e', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} />
          <span>Running on fallback synthetic demo data. Upload/select a real dataset to view production metrics.</span>
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
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent', border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', borderRadius: '0.5rem 0.5rem 0 0', transition: 'all 0.2s ease', whiteSpace: 'nowrap' }}>
                <Icon size={18} /> {tab.label}
              </button>
            )
          })}
        </div>
      )}

      {activeTab === 'overview' && (
        <OverviewTab activeTab={activeTab} data={data} s={s} globalSimResult={globalSimResult} exportPDF={exportPDF} setActiveTab={setActiveTab} setShowGuide={setShowGuide} segmentData={segmentData} lifecycleData={lifecycleData} segChurn={segChurn} shapData={shapData} cohorts={cohorts} productMix={productMix} rar={rar} totalUsers={totalUsers} churnPct={churnPct} />
      )}

      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-grid">
          {activeTab === 'executive' && (
            <div style={{ gridColumn: 'span 12' }}>
              <ExecutiveDashboard data={data} globalSimResult={globalSimResult} onExportAll={exportPDF} onNavigate={() => setActiveTab('explainability')} />
            </div>
          )}

          {activeTab === 'explainability' && (
            <ExplainabilityTab data={data} s={s} globalSimResult={globalSimResult} exportPDF={exportPDF} setActiveTab={setActiveTab} setShowGuide={setShowGuide} segmentData={segmentData} lifecycleData={lifecycleData} segChurn={segChurn} shapData={shapData} cohorts={cohorts} productMix={productMix} rar={rar} totalUsers={totalUsers} churnPct={churnPct} />
          )}

          {activeTab === 'simulation' && (
            <SimulationTab s={s} segChurn={segChurn} setGlobalSimResult={setGlobalSimResult} fetchLlmHypotheses={fetchLlmHypotheses} llmLoading={llmLoading} llmHypotheses={llmHypotheses} />
          )}

          {activeTab === 'users' && (
            <UsersTab setShapUser={setShapUser} data={data} s={s} globalSimResult={globalSimResult} exportPDF={exportPDF} setActiveTab={setActiveTab} setShowGuide={setShowGuide} segmentData={segmentData} lifecycleData={lifecycleData} segChurn={segChurn} shapData={shapData} cohorts={cohorts} productMix={productMix} rar={rar} totalUsers={totalUsers} churnPct={churnPct} />
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
