import React from 'react';
import { CalendarRange } from 'lucide-react';
import { motion } from 'framer-motion';

const retentionColor = (val) => {
  if (val >= 80) return '#dcfce7';
  if (val >= 60) return '#bbf7d0';
  if (val >= 40) return '#fef9c3';
  if (val >= 20) return '#fed7aa';
  if (val > 0) return '#fecaca';
  return '#f1f5f9';
};

const Section = ({ children, span = 12, delay = 0, style = {}, className = "", initial = { opacity: 0 } }) => (
  <motion.div className={`card ${className}`} style={{ gridColumn: `span ${span}`, ...style }}
    initial={initial} animate={{ opacity: 1 }} transition={{ delay, duration: 0.4 }}>
    {children}
  </motion.div>
);

export default function CohortMatrix({ cohorts }) {
  if (!cohorts || cohorts.length === 0) return null;

  return (
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
  );
}
