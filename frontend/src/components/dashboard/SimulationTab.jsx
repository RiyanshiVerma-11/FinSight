import React from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Zap, FlaskConical } from 'lucide-react';
import { COLORS } from '../../utils/constants';
import { Section } from '../ui/DashboardComponents';
import WhatIfSandbox from './WhatIfSandbox';
import InterventionEngine from './InterventionEngine';

export default function SimulationTab({ s, segChurn, setGlobalSimResult, fetchLlmHypotheses, llmLoading, llmHypotheses }) {
  return (
    <>
      <div style={{ gridColumn: 'span 12' }}>
                <Section span={12} delay={0} className="tour-whatif" initial={false}>
                  <WhatIfSandbox segments={s?.segments} segChurn={segChurn} domain={s?.domain} onSimulationResult={setGlobalSimResult} hypotheses={llmHypotheses?.hypotheses || s?.hypotheses} isSummaryData={s?.is_summary_data} />
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
  );
}
