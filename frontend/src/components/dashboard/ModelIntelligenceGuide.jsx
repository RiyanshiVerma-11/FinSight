import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Brain, Zap, Target, Activity, ShieldCheck, 
  TrendingUp, BarChart3, FlaskConical, Lightbulb, Info
} from 'lucide-react';

export default function ModelIntelligenceGuide({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(8px)'
      }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          style={{
            background: '#ffffff',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            borderRadius: '2rem',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '2rem 2.5rem',
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
                padding: '0.75rem', 
                borderRadius: '1rem',
                color: '#fff'
              }}>
                <Brain size={32} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Intelligence Guide</h2>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Understanding the FinSight Analytical Engine</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              style={{ 
                background: 'rgba(255,255,255,0.1)', 
                border: 'none', 
                padding: '0.5rem', 
                borderRadius: '50%', 
                color: '#fff', 
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div style={{
            padding: '2.5rem',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '2.5rem',
            background: '#f8fafc'
          }}>
            {/* 1. Behavioral Fingerprinting */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '0.5rem', borderRadius: '0.75rem' }}>
                  <Activity size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Behavioral Fingerprinting</h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', lineHeight: 1.6 }}>
                FinSight doesn't just look at balance totals. It calculates the <strong>rhythm</strong> of every user.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#475569', fontSize: '0.9rem' }}>
                <li><strong>Recency:</strong> Days since the last interaction.</li>
                <li><strong>Velocity:</strong> Are they speeding up or slowing down?</li>
                <li><strong>IPI (Heartbeat):</strong> The consistency of their "habit." A missed heartbeat is the first sign of churn.</li>
              </ul>
            </div>

            {/* 2. Tournament of Models */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '0.5rem', borderRadius: '0.75rem' }}>
                  <FlaskConical size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Tournament of Models</h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', lineHeight: 1.6 }}>
                Every time data is analyzed, the engine runs a competition between <strong>Random Forest</strong>, <strong>XGBoost</strong>, and <strong>Stacking Meta-Learners</strong>.
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic' }}>
                Only the most accurate model (measured by AUC) is used to score your users, ensuring your risk reports are always state-of-the-art.
              </p>
            </div>

            {/* 3. Explainable AI (SHAP) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.1)', padding: '0.5rem', borderRadius: '0.75rem' }}>
                  <Target size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Explainable AI (SHAP)</h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', lineHeight: 1.6 }}>
                We believe in <strong>"Why" over "What."</strong> When a user is flagged as "High Risk," our SHAP explainer reveals the exact behavioral drivers causing the score.
              </p>
              <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                <span style={{ color: '#f43f5e', fontWeight: 700 }}>Red Bars:</span> Increase risk (e.g., Delay in filing)<br/>
                <span style={{ color: '#10b981', fontWeight: 700 }}>Green Bars:</span> Decrease risk (e.g., High diversity)
              </div>
            </div>

            {/* 4. Risk Prioritization */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '0.5rem', borderRadius: '0.75rem' }}>
                  <TrendingUp size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Priority Scoring</h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', lineHeight: 1.6 }}>
                FinSight doesn't just tell you who is leaving; it tells you who <strong>matters</strong>.
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
                By multiplying <strong>Churn Probability</strong> × <strong>Lifetime Value (LTV)</strong>, we calculate <strong>Revenue at Risk (RAR)</strong>. This ensures you spend your marketing budget on the "At-Risk Giants" first.
              </p>
            </div>
          </div>

          {/* Footer / Glossary */}
          <div style={{
            padding: '1.5rem 2.5rem',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                <ShieldCheck size={16} color="#10b981" /> Data Secure
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                <Zap size={16} color="#f59e0b" /> Real-time Simulation
              </div>
            </div>
            <button 
              onClick={onClose}
              style={{
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Got it, let's explore!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
