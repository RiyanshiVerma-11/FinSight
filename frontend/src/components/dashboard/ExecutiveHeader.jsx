import React from 'react';
import { LayoutDashboard, ShieldCheck, AlertTriangle, FileText } from 'lucide-react';

export default function ExecutiveHeader({ totalUsers, s, onExportAll }) {
  return (
    <div className="exec-header" style={{ 
      padding: '2rem 2.5rem', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      background: 'linear-gradient(135deg, #0f172a, #1e293b)',
      borderBottom: '1px solid rgba(255,255,255,0.1)' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
          width: 54, 
          height: 54, 
          borderRadius: '16px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 10px 25px rgba(99, 102, 241, 0.2)',
          color: '#fff'
        }}>
          <LayoutDashboard size={28} />
        </div>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.04em', margin: 0, color: '#ffffff' }}>
            Executive Intelligence Dashboard
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginTop: '0.2rem' }}>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              Live System Active
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>
            <span style={{ color: '#ffffff', opacity: 0.9 }}>{`${(totalUsers || 0).toLocaleString()} High-Value Profiles Analyzed`}</span>
            {s?.metrics?.roc_auc ? (
              <span style={{ 
                fontSize: '0.65rem', 
                fontWeight: 900, 
                color: s.metrics.roc_auc > 0.75 ? '#10b981' : s.metrics.roc_auc > 0.60 ? '#f59e0b' : '#f43f5e', 
                background: s.metrics.roc_auc > 0.75 ? 'rgba(16,185,129,0.1)' : s.metrics.roc_auc > 0.60 ? 'rgba(245,158,11,0.1)' : 'rgba(244,63,94,0.1)', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '20px', 
                border: `1px solid ${s.metrics.roc_auc > 0.75 ? 'rgba(16,185,129,0.2)' : s.metrics.roc_auc > 0.60 ? 'rgba(245,158,11,0.2)' : 'rgba(244,63,94,0.2)'}`,
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.3rem'
              }}>
                {s.metrics.roc_auc > 0.75 ? <ShieldCheck size={10} /> : <AlertTriangle size={10} />}
                {`${s.metrics.roc_auc > 0.75 ? 'High Confidence' : s.metrics.roc_auc > 0.60 ? 'Moderate Confidence' : 'Low Confidence'} (AUC: ${(s.metrics.roc_auc * 100).toFixed(1)}%)`}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button 
          onClick={onExportAll}
          className="btn-export-premium"
          style={{
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            background: '#f8fafc', 
            color: '#0f172a', 
            border: '1px solid #e2e8f0',
            padding: '0.85rem 1.75rem', 
            borderRadius: '14px', 
            fontWeight: 800,
            cursor: 'pointer', 
            fontSize: '0.9rem', 
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
          }}
        >
          <FileText size={18} color="#6366f1" />
          Generate Board Briefing
        </button>
      </div>
    </div>
  );
}
