import React from 'react';
import { motion } from 'framer-motion';
import { Target, Zap } from 'lucide-react';

const PERSONA_MAP = {
  'At Risk': 'The Fading Star',
  'Loyal': 'The Steady Pillar',
  'Champions': 'The Loyal Giant',
  'Promising': 'The Rising Star',
  'Hibernating': 'The Hibernator',
  'Lost': 'The Lost Soul',
};

const INTERVENTION_MAP = {
  'At Risk': {
    problem: 'High recency deviation',
    action: 'Send ₹200 cashback offer',
    cost: 200,
    est_ltv: 1500,
    campaign: 'cashback',
    color: '#f43f5e',
  },
  'Loyal': {
    problem: 'Frequency plateau',
    action: 'Launch loyalty reward program',
    cost: 150,
    est_ltv: 2500,
    campaign: 'loyalty',
    color: '#6366f1',
  },
  'Champions': {
    problem: 'Low but needs nurturing',
    action: 'Exclusive VIP upgrade offer',
    cost: 500,
    est_ltv: 5000,
    campaign: 'vip',
    color: '#8b5cf6',
  },
  'Promising': {
    problem: 'Low monetary conversion',
    action: 'Plan upgrade discount (20% off)',
    cost: 100,
    est_ltv: 1200,
    campaign: 'discount',
    color: '#06b6d4',
  },
  'Hibernating': {
    problem: 'High IPI deviation + low activity',
    action: 'Re-engagement email + push notification',
    cost: 50,
    est_ltv: 800,
    campaign: 'reengagement',
    color: '#f59e0b',
  },
  'Lost': {
    problem: 'Very high churn probability',
    action: 'Win-back campaign with strong incentive',
    cost: 300,
    est_ltv: 150, // Cost > LTV
    campaign: 'winback',
    color: '#94a3b8',
  },
};

const DEFAULT_INTERVENTION = {
  problem: 'Engagement drop detected',
  action: 'Targeted re-engagement campaign',
  cost: 100,
  est_ltv: 500,
  campaign: 'general',
  color: '#6366f1',
};

export default function InterventionEngine({ segments, segChurn }) {
  const segmentList = segments ? Object.entries(segments) : [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <Zap size={20} style={{ color: '#f59e0b' }} />
        <h2 style={{ margin: 0 }}>Retention ROI Engine</h2>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700,
          background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
          color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '1rem'
        }}>LIVE CALCULATOR</span>
      </div>
      <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
        Smart spending logic: We only recommend interventions where <strong>ROI &gt; Cost</strong>.
      </p>

      <div className="intervention-table-wrap">
        <table className="intervention-table">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Users</th>
              <th>Problem</th>
              <th>Recommended Action</th>
              <th>Retention ROI</th>
            </tr>
          </thead>
          <tbody>
            {segmentList.map(([seg, count], i) => {
              const cfg = INTERVENTION_MAP[seg] || DEFAULT_INTERVENTION;
              const personaName = PERSONA_MAP[seg] || seg;
              const segData = segChurn?.find(s => s.segment === seg);
              const churnPct = segData ? (segData.avg_churn * 100).toFixed(1) : '—';

              const isProfitable = cfg.est_ltv > cfg.cost;
              const roiColor = isProfitable ? '#10b981' : '#f43f5e';

              return (
                <motion.tr
                  key={seg}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="intervention-row"
                >
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>{personaName}</span>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{seg}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>{count?.toLocaleString()}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{cfg.problem}</span>
                    {churnPct !== '—' && (
                      <div style={{ fontSize: '0.7rem', color: '#f43f5e', fontWeight: 600, marginTop: '0.15rem' }}>
                        {churnPct}% churn rate
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      background: `${cfg.color}12`, borderRadius: '0.5rem',
                      padding: '0.35rem 0.65rem', width: 'fit-content',
                      border: `1px solid ${cfg.color}25`
                    }}>
                      <Target size={12} style={{ color: cfg.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: cfg.color }}>{cfg.action}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 800,
                        background: `${roiColor}15`,
                        color: roiColor,
                        border: `1px solid ${roiColor}30`,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '1rem',
                        marginBottom: '0.25rem'
                      }}>
                        {isProfitable ? 'PROFITABLE' : 'NON-PROFITABLE'}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                        Cost: ₹{cfg.cost} | LTV: ₹{cfg.est_ltv}
                      </span>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
