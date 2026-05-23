import React from 'react';
import { Zap, TrendingUp, Brain } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export default function ActionPlanSection({ 
  prioritySegmentName, 
  priorityRiskCount, 
  s, 
  potentialSaved, 
  confidence, 
  driftStatus, 
  onNavigate 
}) {
  return (
    <div style={{ 
      background: 'var(--bg-card)', 
      borderRadius: '24px', 
      padding: '2rem',
      border: '1px solid var(--border)',
      position: 'relative',
      overflow: 'hidden',
      marginTop: '2rem',
      boxShadow: '0 10px 30px rgba(0,0,0,0.02)'
    }}>
      <Zap size={100} style={{ position: 'absolute', right: '-20px', bottom: '-20px', color: 'rgba(99,102,241,0.03)', transform: 'rotate(-15deg)' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
         <div style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '0.5rem', borderRadius: '10px' }}>
            <Zap size={20} fill="#f59e0b" />
         </div>
         <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Your 5-Step Action Plan</h2>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>AI-generated · Based on live model output · Act on this today</p>
         </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '1.25rem 0' }} />

      {/* Horizontal 5-Column Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1.25rem', 
        position: 'relative', 
        zIndex: 1 
      }}>

        {/* Step 1: Who to Target */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '1.25rem', 
          background: 'rgba(245,158,11,0.04)', 
          borderRadius: '20px', 
          border: '1px solid rgba(245,158,11,0.12)', 
          justifyContent: 'space-between',
          minHeight: '260px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.8rem', boxShadow: '0 4px 10px rgba(245,158,11,0.25)' }}>1</div>
              <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Segment</span>
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '0.25rem 0.6rem', borderRadius: '8px', display: 'inline-block', marginBottom: '0.75rem', border: '1px solid rgba(245,158,11,0.2)' }}>
              {prioritySegmentName}
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontWeight: 500 }}>
              Focus your retention team on the <strong style={{ color: 'var(--text-primary)' }}>{prioritySegmentName}</strong> segment ({priorityRiskCount} at-risk users). Cheaper to act now than to win them back later.
            </p>
          </div>
        </div>

        {/* Step 2: Root Cause */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '1.25rem', 
          background: 'rgba(244,63,94,0.03)', 
          borderRadius: '20px', 
          border: '1px solid rgba(244,63,94,0.1)', 
          justifyContent: 'space-between',
          minHeight: '260px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.8rem', boxShadow: '0 4px 10px rgba(244,63,94,0.25)' }}>2</div>
              <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#f43f5e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Root Cause</span>
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#f43f5e', background: 'rgba(244,63,94,0.08)', padding: '0.25rem 0.6rem', borderRadius: '8px', display: 'inline-block', marginBottom: '0.75rem', border: '1px solid rgba(244,63,94,0.15)', maxWidth: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={s?.top_drivers?.[0]?.feature}>
              {s?.top_drivers?.[0]?.feature || 'Behavioral Trend'}
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontWeight: 500 }}>
              SHAP analysis flagged <strong style={{ color: 'var(--text-primary)' }}>{s?.top_drivers?.[0]?.feature || 'key metrics'}</strong> as the #1 driver, showing a <strong style={{ color: '#f43f5e' }}>{s?.top_drivers?.[0]?.direction === 'increases_churn' ? 'harmful increase' : 'dangerous decline'}</strong>.
            </p>
          </div>
        </div>

        {/* Step 3: Revenue to Protect */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '1.25rem', 
          background: 'rgba(16,185,129,0.03)', 
          borderRadius: '20px', 
          border: '1px solid rgba(16,185,129,0.12)', 
          justifyContent: 'space-between',
          minHeight: '260px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.8rem', boxShadow: '0 4px 10px rgba(16,185,129,0.25)' }}>3</div>
              <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue at Stake</span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981', marginBottom: '0.75rem' }}>
              {formatCurrency(potentialSaved)}
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontWeight: 500 }}>
              Estimated recoverable revenue across this segment. Calibrated from each user's predicted LTV × success probability.
            </p>
          </div>
        </div>

        {/* Step 4: Campaign */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '1.25rem', 
          background: 'rgba(99,102,241,0.03)', 
          borderRadius: '20px', 
          border: '1px solid rgba(99,102,241,0.1)', 
          justifyContent: 'space-between',
          minHeight: '260px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.8rem', boxShadow: '0 4px 10px rgba(99,102,241,0.25)' }}>4</div>
              <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Recommendation</span>
            </div>
            <div style={{ 
              background: 'rgba(99,102,241,0.06)', 
              border: '1px dashed rgba(99,102,241,0.25)', 
              borderRadius: '8px', 
              padding: '0.5rem 0.65rem', 
              fontSize: '0.75rem', 
              fontWeight: 700, 
              color: '#4f46e5', 
              lineHeight: 1.4, 
              marginBottom: '0.5rem',
              maxHeight: '75px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical'
            }} title={s?.hypotheses?.[0]?.test}>
              &ldquo;{s?.hypotheses?.[0]?.test || "Personalized re-engagement tied to top features."}&rdquo;
            </div>
            {s?.hypotheses?.[0]?.expected_lift_pct && (
              <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <TrendingUp size={10} /> Expected Recovery: +{s.hypotheses[0].expected_lift_pct}%
              </div>
            )}
          </div>
        </div>

        {/* Step 5: Confidence */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '1.25rem', 
          background: 'rgba(139,92,246,0.03)', 
          borderRadius: '20px', 
          border: '1px solid rgba(139,92,246,0.1)', 
          justifyContent: 'space-between',
          minHeight: '260px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.8rem', boxShadow: '0 4px 10px rgba(139,92,246,0.25)' }}>5</div>
              <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Decision Confidence</span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: confidence >= 75 ? '#10b981' : confidence >= 50 ? '#f59e0b' : '#f43f5e', marginBottom: '0.75rem' }}>
              {confidence}% Confidence
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontWeight: 500 }}>
              {confidence >= 75
                ? "Reliable recommendations. Deploy campaign immediately."
                : confidence >= 50
                ? "Run a small pilot test before complete rollout."
                : "Add more user tenure history to increase prediction accuracy."
              }
              <em style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.4rem', fontSize: '0.7rem' }}>Drift status: {driftStatus}</em>
            </p>
          </div>
        </div>

      </div>
      
      {onNavigate && (
        <button 
          onClick={() => onNavigate('explainability')}
          style={{ 
            marginTop: '1.5rem', width: '100%', padding: '0.85rem', borderRadius: '12px',
            background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: 'none',
            color: '#fff', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
            transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        >
          <Brain size={14} /> See Full AI Evidence & SHAP Explanations &rarr;
        </button>
      )}
    </div>
  );
}
