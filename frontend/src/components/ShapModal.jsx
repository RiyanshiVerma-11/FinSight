import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ShapModal({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    axios.get(`${API_URL}/user-shap/${userId}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  if (!userId) return null;

  return (
    <AnimatePresence>
      <motion.div className="modal-overlay" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="modal-content" onClick={e => e.stopPropagation()}
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
          
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
          
          <div className="modal-header">
            <Brain size={24} style={{ color: '#8b5cf6' }} />
            <h3>SHAP Explainability — {userId}</h3>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Analyzing user...</div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#f43f5e' }}>User not found</div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="shap-stats-row">
                <div className="shap-stat">
                  <AlertTriangle size={16} style={{ color: data.churn_probability > 0.5 ? '#f43f5e' : '#10b981' }} />
                  <span className="shap-stat-label">Churn Risk</span>
                  <span className="shap-stat-value" style={{ color: data.churn_probability > 0.5 ? '#f43f5e' : '#10b981' }}>
                    {(data.churn_probability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="shap-stat">
                  <DollarSign size={16} style={{ color: '#f59e0b' }} />
                  <span className="shap-stat-label">Revenue at Risk</span>
                  <span className="shap-stat-value">${data.revenue_at_risk?.toFixed(2)}</span>
                </div>
                <div className="shap-stat">
                  <span className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
                    {data.segment}
                  </span>
                </div>
              </div>

              {/* Explanation summary */}
              <div className="shap-explanation">
                <p>{data.explanation_summary}</p>
              </div>

              {/* SHAP drivers */}
              <h4 style={{ margin: '1.25rem 0 0.75rem', color: '#1e293b', fontSize: '0.95rem', fontWeight: 700 }}>
                Top Churn Drivers for This User
              </h4>
              <div className="shap-drivers">
                {data.top_drivers?.map((d, i) => (
                  <div key={i} className="shap-driver-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>{d.feature}</span>
                      {d.direction === 'increases_churn' 
                        ? <TrendingUp size={16} style={{ color: '#f43f5e' }} />
                        : <TrendingDown size={16} style={{ color: '#10b981' }} />
                      }
                    </div>
                    <div className="shap-bar-container">
                      <div className="shap-bar"
                        style={{
                          width: `${Math.min(Math.abs(d.shap_value) * 500, 100)}%`,
                          background: d.direction === 'increases_churn' ? '#f43f5e' : '#10b981'
                        }} />
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.4rem', lineHeight: 1.5 }}>
                      {d.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
