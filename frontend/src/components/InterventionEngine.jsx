import React from 'react';
import { motion } from 'framer-motion';
import { Target, Zap } from 'lucide-react';

const INTERVENTION_MAP = {
  'At Risk': {
    problem: 'High recency deviation',
    action: 'Send ₹100 cashback offer',
    campaign: 'cashback',
    color: '#f43f5e',
    emoji: '🚨',
  },
  'Loyal': {
    problem: 'Frequency plateau',
    action: 'Launch loyalty reward program',
    campaign: 'loyalty',
    color: '#6366f1',
    emoji: '💎',
  },
  'Champions': {
    problem: 'Low but needs nurturing',
    action: 'Exclusive VIP upgrade offer',
    campaign: 'vip',
    color: '#8b5cf6',
    emoji: '👑',
  },
  'Promising': {
    problem: 'Low monetary conversion',
    action: 'Plan upgrade discount (20% off)',
    campaign: 'discount',
    color: '#06b6d4',
    emoji: '🌟',
  },
  'Hibernating': {
    problem: 'High IPI deviation + low activity',
    action: 'Re-engagement email + push notification',
    campaign: 'reengagement',
    color: '#f59e0b',
    emoji: '😴',
  },
  'Lost': {
    problem: 'Very high churn probability',
    action: 'Win-back campaign with strong incentive',
    campaign: 'winback',
    color: '#94a3b8',
    emoji: '💔',
  },
};

const DEFAULT_INTERVENTION = {
  problem: 'Engagement drop detected',
  action: 'Targeted re-engagement campaign',
  campaign: 'general',
  color: '#6366f1',
  emoji: '📊',
};

export default function InterventionEngine({ segments, segChurn }) {
  const segmentList = segments ? Object.entries(segments) : [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <Zap size={20} style={{ color: '#f59e0b' }} />
        <h2 style={{ margin: 0 }}>Intervention Engine</h2>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700,
          background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
          color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '1rem'
        }}>PLAYBOOK</span>
      </div>
      <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
        Prescriptive action playbook — segment-specific interventions to reduce churn and save revenue
      </p>

      <div className="intervention-table-wrap">
        <table className="intervention-table">
          <thead>
            <tr>
              <th>Segment</th>
              <th>Users</th>
              <th>Problem</th>
              <th>Recommended Action</th>
              <th>Urgency</th>
            </tr>
          </thead>
          <tbody>
            {segmentList.map(([seg, count], i) => {
              const cfg = INTERVENTION_MAP[seg] || DEFAULT_INTERVENTION;
              const segData = segChurn?.find(s => s.segment === seg);
              const churnPct = segData ? (segData.avg_churn * 100).toFixed(1) : '—';
              const urgency = segData
                ? segData.avg_churn > 0.6 ? 'CRITICAL' : segData.avg_churn > 0.35 ? 'HIGH' : 'MEDIUM'
                : 'MEDIUM';
              const urgencyColor = urgency === 'CRITICAL' ? '#f43f5e' : urgency === 'HIGH' ? '#f59e0b' : '#10b981';

              return (
                <motion.tr
                  key={seg}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="intervention-row"
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>{cfg.emoji}</span>
                      <span style={{ fontWeight: 700, color: cfg.color, fontSize: '0.9rem' }}>{seg}</span>
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
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700,
                      background: `${urgencyColor}15`,
                      color: urgencyColor,
                      border: `1px solid ${urgencyColor}30`,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '1rem'
                    }}>{urgency}</span>
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
