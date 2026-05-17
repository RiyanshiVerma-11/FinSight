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
      <Zap size={100} style={{ position: 'absolute', right: '-20px', bottom: '-20px', color: 'rgba(99,102,241,0.05)', transform: 'rotate(-15deg)' }} />

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', zIndex: 1 }}>

        {/* Step 1: Who to Target */}
        <div style={{ display: 'flex', gap: '1rem', padding: '1rem 1.25rem', background: 'rgba(245,158,11,0.05)', borderRadius: '16px', border: '1px solid rgba(245,158,11,0.15)', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 32, height: 32, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(245,158,11,0.3)', flexShrink: 0 }}>1</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>🎯 Who to Target First</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '0.2rem 0.75rem', borderRadius: '20px', border: '1px solid rgba(245,158,11,0.25)' }}>{prioritySegmentName}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55, fontWeight: 500 }}>
              Focus your retention team on the <strong style={{ color: '#0f172a' }}>{prioritySegmentName}</strong> segment — the AI detected the highest concentration of at-risk revenue here. These {priorityRiskCount > 0 ? <strong style={{ color: '#f59e0b' }}>{priorityRiskCount} users</strong> : 'users'} are showing active disengagement signals. Acting <em>now</em> is 3–5× cheaper than winning them back after they leave.
            </p>
          </div>
        </div>

        {/* Step 2: Root Cause */}
        <div style={{ display: 'flex', gap: '1rem', padding: '1rem 1.25rem', background: 'rgba(244,63,94,0.04)', borderRadius: '16px', border: '1px solid rgba(244,63,94,0.12)', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 32, height: 32, borderRadius: '50%', background: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(244,63,94,0.3)', flexShrink: 0 }}>2</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#f43f5e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>🔍 Root Cause of Churn</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f43f5e', background: 'rgba(244,63,94,0.08)', padding: '0.2rem 0.6rem', borderRadius: '20px', border: '1px solid rgba(244,63,94,0.2)', maxWidth: 160, textAlign: 'right' }}>{s?.top_drivers?.[0]?.feature || 'Behavioral Shift'}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55, fontWeight: 500 }}>
              SHAP analysis identified <strong style={{ color: '#0f172a' }}>{s?.top_drivers?.[0]?.feature || 'key behavioral metrics'}</strong> as the #1 churn driver — it's showing a <strong style={{ color: '#f43f5e' }}>{s?.top_drivers?.[0]?.direction === 'increases_churn' ? 'harmful increase' : 'dangerous decline'}</strong>. Directly address this in your messaging. E.g. if it's "Days Since Last Login", your campaign should create urgency to re-engage.
            </p>
          </div>
        </div>

        {/* Step 3: Revenue to Protect */}
        <div style={{ display: 'flex', gap: '1rem', padding: '1rem 1.25rem', background: 'rgba(16,185,129,0.04)', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.15)', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 32, height: 32, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', flexShrink: 0 }}>3</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>💰 Revenue You Can Save</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>{formatCurrency(potentialSaved)}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55, fontWeight: 500 }}>
              This is the estimated revenue recoverable by successfully retaining the at-risk users via targeted intervention. Calculated from each user's <em>Predicted LTV × success probability</em>. The intervention ROI is positive — spending on retention campaigns now returns more than the cost. <strong style={{ color: '#10b981' }}>Green = act fast.</strong>
            </p>
          </div>
        </div>

        {/* Step 4: Campaign */}
        <div style={{ display: 'flex', gap: '1rem', padding: '1rem 1.25rem', background: 'rgba(99,102,241,0.04)', borderRadius: '16px', border: '1px solid rgba(99,102,241,0.12)', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 32, height: 32, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(99,102,241,0.3)', flexShrink: 0 }}>4</div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em' }}>📣 AI-Recommended Campaign</span>
            </div>
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.3)', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#4f46e5', lineHeight: 1.5, marginBottom: '0.5rem' }}>
              &ldquo;{s?.hypotheses?.[0]?.test || "Run a personalized re-engagement push notification with an offer tied to the user's most-used feature."}&rdquo;
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontWeight: 500 }}>
              This campaign was auto-generated by testing which behavioral hypothesis produces the highest predicted lift. Run this as an A/B test: send to 50% of the segment and compare 30-day retention rates.
            </p>
            {s?.hypotheses?.[0]?.expected_lift_pct && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <TrendingUp size={12} /> Expected Lift: +{s.hypotheses[0].expected_lift_pct}% revenue retention
              </div>
            )}
          </div>
        </div>

        {/* Step 5: Confidence */}
        <div style={{ display: 'flex', gap: '1rem', padding: '1rem 1.25rem', background: 'rgba(139,92,246,0.04)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.12)', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 32, height: 32, borderRadius: '50%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(139,92,246,0.3)', flexShrink: 0 }}>5</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.1em' }}>🛡️ How Much to Trust This</span>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: confidence >= 75 ? '#10b981' : confidence >= 50 ? '#f59e0b' : '#f43f5e' }}>{confidence}% Confidence</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55, fontWeight: 500 }}>
              {confidence >= 75
                ? <><strong style={{ color: '#10b981' }}>High confidence ✓</strong> — Data quality is strong and model drift is low. These recommendations are reliable. Deploy the campaign with confidence.</>  
                : confidence >= 50
                ? <><strong style={{ color: '#f59e0b' }}>Moderate confidence ⚠</strong> — Directionally correct, but run a small pilot (200 users) before full rollout to validate predictions.</>  
                : <><strong style={{ color: '#f43f5e' }}>Low confidence ✗</strong> — Upload richer data (more users / more time history) to improve accuracy before major campaigns.</>
              }
              <em style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>Data drift status: {driftStatus}. {driftStatus !== 'STABLE' ? 'Consider retraining the model with fresh data.' : 'Model is well-calibrated.'}</em>
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
