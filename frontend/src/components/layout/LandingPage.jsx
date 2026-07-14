import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, Activity, Cpu, Brain,
  Zap, Database, CheckCircle2, ArrowRight,
  TrendingUp, BarChart3, Users, PlayCircle,
  FileSpreadsheet, BookOpen, Percent, Calculator, Info
} from 'lucide-react';

export default function LandingPage({ onLaunchDashboard }) {
  const [activeInfoTab, setActiveInfoTab] = useState('data'); // 'data' | 'math'

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 25, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100, damping: 15 }
    }
  };

  const schemas = [
    {
      id: 'upi',
      name: 'UPI & Payment Logs',
      icon: '📱',
      description: 'Transaction-level logs capturing peer-to-peer or peer-to-merchant payments.',
      required: ['payer_user_id (or sender_vpa / upi_id)', 'timestamp (date/time)', 'amount'],
      optional: ['description (merchant / payee)', 'status (response code / result)'],
      sample: 'payee_vpa_123, 2026-07-14 12:30:15, 500.00, SUCCESS'
    },
    {
      id: 'banking',
      name: 'Banking & Account Churn',
      icon: '🏦',
      description: 'Summary files documenting customer account balances, credit profiles, and status.',
      required: ['customer_id', 'balance (monetary)', 'num_of_products (frequency)', 'tenure_months'],
      optional: ['credit_score', 'estimated_salary', 'is_active_member', 'exited (churn label)'],
      sample: 'cust_8832, 12500.45, 2, 24, 720, 85000.00, 1, 0'
    },
    {
      id: 'tax',
      name: 'Tax & Income Credits',
      icon: '📄',
      description: 'Form 26AS style credits, TDS details, or recurrent taxable income entries.',
      required: ['pan (user_id)', 'timestamp (date of credit)', 'gross_amount_inr (amount)'],
      optional: ['income_head (description)', 'deductor_tan', 'section'],
      sample: 'ABCDE1234F, 2026-06-30, 75000.00, Salary - Section 192'
    },
    {
      id: 'retail',
      name: 'Retail & E-commerce',
      icon: '🛒',
      description: 'Classic transactional basket records including quantities and unit pricing.',
      required: ['customer_id', 'timestamp (Invoice Date)', 'amount (or unit_price + quantity)'],
      optional: ['quantity', 'unit_price', 'description (product name)'],
      sample: 'user_403, 2026-07-10 09:45:00, 29.99, 1, 29.99, Wireless Mouse'
    },
    {
      id: 'generic',
      name: 'Generic Transactional',
      icon: '⚙️',
      description: 'Any CSV/Excel mapping user identifier columns, time series fields, and numeric values.',
      required: ['user_id (or customer_id / account)', 'timestamp (date)', 'amount (value / spend)'],
      optional: ['any descriptive feature column'],
      sample: 'acc_8801, 2026-07-12, 100.00, Custom Label'
    }
  ];

  const mathFormulas = [
    {
      title: 'Inter-Purchase Interval (IPI) Consistency',
      formula: 'Consistency = 1 / (1 + ipi_std / 30.0)',
      explanation: 'Evaluates the consistency of a customer\'s buying pattern. A high standard deviation in transaction intervals reduces consistency toward 0, while a perfectly consistent user (e.g. exactly every 30 days) scores near 1.0.',
      why: 'Why? A customer who buys every 15 days like clockwork is far less likely to churn than one who buys erratically. This formula captures regularity without penalizing infrequent but consistent buyers.'
    },
    {
      title: 'Recency Deviation',
      formula: 'Deviation = max(0, Recency - ipi_median)',
      explanation: 'Calculates the overdue gap by comparing how many days have elapsed since the user\'s last transaction (Recency) to their historical median purchase interval (ipi_median).',
      why: 'Why? Raw recency alone is misleading — a user who buys monthly being 20 days idle is normal, but a daily buyer being 20 days idle is alarming. This formula personalizes the "overdue" signal per user.'
    },
    {
      title: 'Monetary Velocity',
      formula: 'Velocity = Total Amount / max(Tenure_Days, 7)',
      explanation: 'Represents the daily financial run-rate of the user. We enforce a 7-day floor in the denominator to avoid inflating calculations for newly registered accounts.',
      why: 'Why? Total spend alone doesn\'t differentiate a 3-year customer from a 3-day one. Velocity normalizes by tenure, giving a fair daily spend rate. The 7-day floor prevents division by near-zero for brand-new users.'
    },
    {
      title: 'Defensible Revenue at Risk (RAR)',
      formula: 'RAR = Velocity × Window × Margin × ChurnProbability',
      explanation: 'Measures exposure over a forward risk window. Window defaults to 90 days for UPI/general and scales to 365 days for low-frequency Tax datasets. Capped at the customer\'s historical total spend.',
      why: 'Why? This answers "how much money could we lose?" in a time-bounded, defensible way. The cap ensures we never claim more revenue at risk than the customer has actually spent.'
    },
    {
      title: 'Customer Lifetime Value (LTV)',
      formula: 'LTV = Historical Spend + (Velocity × 365 × (1 - ChurnProbability))',
      explanation: 'A predictive projection of the user\'s total contribution, factoring in their current spend velocity discounted by the calculated likelihood of churn.',
      why: 'Why? LTV helps prioritize retention spend. A high-velocity customer with low churn probability has enormous future value, while a low-velocity churner may not justify expensive interventions.'
    },
    {
      title: 'Priority Score (Percentile-Rank)',
      formula: 'Priority = PercentileRank(ChurnProbability × RAR) × 100',
      explanation: 'Ranks each customer by their combined churn risk and revenue exposure within the dataset. A score of 95 means the customer is more urgent than 95% of all other customers.',
      why: 'Why? Using percentile rank instead of raw multiplication avoids arbitrary scaling constants. Every customer gets a meaningful 0–100 score relative to the current cohort, making it immediately actionable for prioritization.'
    },
    {
      title: 'Live Drift Monitoring (KS-Test)',
      formula: 'Drift Index = KS_2Samp(Training_X, Live_X) with Bonferroni correction',
      explanation: 'Uses a Kolmogorov-Smirnov test to verify if the feature distributions in incoming logs have drifted from baseline levels. Bonferroni correction adjusts alpha thresholds to prevent false alarms across dozens of features.',
      why: 'Why? ML models assume the future looks like the training data. If user behavior shifts (e.g., a new competitor emerges), model predictions degrade silently. KS-tests catch this drift before it causes business damage.'
    },
    {
      title: 'Calibration (3-Way Data Split)',
      formula: 'Train (60%) → Model Fitting | Cal (20%) → Probability Calibration | Test (20%) → Final Evaluation',
      explanation: 'The dataset is split into three independent parts. Models are trained on the Train set, probability calibration uses a dedicated Calibration holdout, and the Test set is never touched until final evaluation.',
      why: 'Why? If calibration uses the test set, reported metrics become optimistically biased (data leakage). A dedicated calibration split ensures that AUC, F1, and all reported metrics are honest and reproducible.'
    },
    {
      title: 'IPI Fill Value (Data-Driven)',
      formula: 'OneTimeBuyer_IPI = min(median(IPI_all_users), P90(IPI_all_users))',
      explanation: 'One-time buyers (who have no inter-purchase interval) are filled with the dataset\'s own median IPI, capped at the 90th percentile. This prevents arbitrary penalties.',
      why: 'Why? A hardcoded value (like 100 days) unfairly penalizes new customers in fast-turnover businesses. Using the dataset\'s own distribution ensures the fill value adapts to each business context automatically.'
    }
  ];

  return (
    <div className="landing-page-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2.5rem 1.25rem' }}>
      
      {/* Hero Section */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          textAlign: 'center',
          padding: '5rem 2rem',
          borderRadius: 'var(--radius-2xl)',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(236, 72, 153, 0.04) 100%)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: 'var(--shadow-lg)',
          marginBottom: '4rem',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{
          position: 'absolute',
          top: '-15%',
          left: '-15%',
          width: '350px',
          height: '350px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.16) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-15%',
          right: '-15%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <motion.div variants={itemVariants} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.5rem 1.25rem', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1.75rem' }}>
          <Activity size={16} /> Enterprise Retention Intelligence
        </motion.div>

        <motion.h1 
          variants={itemVariants} 
          style={{ 
            fontSize: '3.75rem', 
            fontWeight: 900, 
            lineHeight: 1.1, 
            letterSpacing: '-0.03em', 
            marginBottom: '1.5rem',
            color: 'var(--text-primary)'
          }}
        >
          Stop Churn. Protect Revenue.<br />
          <span style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', BackgroundClip: 'text' }}>
            Predictive Intelligence for Fintech.
          </span>
        </motion.h1>

        <motion.p 
          variants={itemVariants}
          style={{ 
            fontSize: '1.25rem', 
            color: 'var(--text-secondary)', 
            maxWidth: '750px', 
            margin: '0 auto 2.75rem',
            lineHeight: 1.6
          }}
        >
          Transforming transactional logs into actionable retention strategies. Spot behavioral decay before customers exit, simulate high-impact interventions, and verify with enterprise-grade explainability.
        </motion.p>

        <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <button 
            className="btn-primary" 
            onClick={onLaunchDashboard}
            style={{ 
              padding: '1rem 2.25rem', 
              fontSize: '1rem', 
              borderRadius: 'var(--radius-lg)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.6rem',
              boxShadow: '0 10px 25px rgba(99, 102, 241, 0.25)',
              cursor: 'pointer',
              border: 'none',
              color: '#fff',
              fontWeight: 700
            }}
          >
            <PlayCircle size={20} /> Launch FinSight Platform <ArrowRight size={18} />
          </button>
        </motion.div>
      </motion.div>

      {/* CORE CONCEPT SECTION */}
      <div style={{ marginBottom: '5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            What exactly is FinSight?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
            An intuitive dashboard built to tackle the Fintech "Revenue Leak" by closing the gap between raw numbers and product decisions.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <ShieldAlert size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Identifying Churn Risk Early</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
              Instead of waiting for a customer to formally close their account, FinSight reads UPI, transaction, and wallet velocity logs to spot early indicators of fading loyalty.
            </p>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <TrendingUp size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Calculating Revenue at Risk (RAR)</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
              We don't treat all users the same. By cross-referencing churn probability with user transaction values, FinSight helps you target interventions where they protect the most revenue.
            </p>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Zap size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Simulating What-If Scenarios</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
              Want to see the impact of reducing transaction failure rates by 10%? Our simulation engine calculates exact revenue savings, ROI, and segment responsiveness instantly.
            </p>
          </div>
        </div>
      </div>

      {/* DYNAMIC INTERACTIVE INFORMATION PANEL */}
      <div style={{ marginBottom: '5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'rgba(99, 102, 241, 0.02)' }}>
          <button 
            onClick={() => setActiveInfoTab('data')}
            style={{
              flex: 1,
              padding: '1.25rem',
              background: activeInfoTab === 'data' ? 'var(--bg-card)' : 'transparent',
              border: 'none',
              borderBottom: activeInfoTab === 'data' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeInfoTab === 'data' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '1.1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            <FileSpreadsheet size={20} /> Supported Import Data
          </button>
          <button 
            onClick={() => setActiveInfoTab('math')}
            style={{
              flex: 1,
              padding: '1.25rem',
              background: activeInfoTab === 'math' ? 'var(--bg-card)' : 'transparent',
              border: 'none',
              borderBottom: activeInfoTab === 'math' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeInfoTab === 'math' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '1.1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Calculator size={20} /> Mathematical Formulas & Engine
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: '2.5rem' }}>
          <AnimatePresence mode="wait">
            {activeInfoTab === 'data' ? (
              <motion.div 
                key="data-tab" 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    Fuzzy Schema-Agnostic Import Ingestion
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    FinSight does not require a rigid, hardcoded CSV structure. Our fuzzy mapping engine processes columns dynamically. When importing, simply ensure your dataset fits one of these primary fintech templates:
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {schemas.map((s, idx) => (
                    <div 
                      key={s.id} 
                      style={{ 
                        background: 'var(--bg-body)', 
                        borderRadius: 'var(--radius-lg)', 
                        padding: '1.5rem', 
                        border: '1px solid var(--border)',
                        display: 'grid',
                        gridTemplateColumns: '80px 1fr',
                        gap: '1rem',
                        alignItems: 'start'
                      }}
                    >
                      <div style={{ fontSize: '2.5rem', textAlign: 'center', alignSelf: 'center' }}>
                        {s.icon}
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</h4>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
                            Auto-Detect Trigger
                          </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                          {s.description}
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>Required Header Matches:</strong>
                            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                              {s.required.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>Optional/Contextual Matches:</strong>
                            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                              {s.optional.map((o, i) => <li key={i}>{o}</li>)}
                            </ul>
                          </div>
                        </div>

                        <div style={{ marginTop: '0.75rem', background: 'var(--bg-card)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <strong>Example Row:</strong> {s.sample}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="math-tab" 
                initial={{ opacity: 0, x: 10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    Open, Auditable Financial Mathematics
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    FinSight rejects "black-box" decisions. We explicitly map transaction sequences to structured formulas to preserve auditing capabilities required by finance partners.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                  {mathFormulas.map((f, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        borderLeft: '4px solid var(--primary)', 
                        paddingLeft: '1.5rem', 
                        paddingVertical: '0.5rem' 
                      }}
                    >
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        {f.title}
                      </h4>
                      <div 
                        style={{ 
                          fontFamily: 'monospace', 
                          fontWeight: 700, 
                          color: 'var(--primary)', 
                          fontSize: '1rem',
                          background: 'rgba(99, 102, 241, 0.04)',
                          padding: '0.5rem 1rem',
                          borderRadius: 'var(--radius-sm)',
                          display: 'inline-block',
                          marginBottom: '0.5rem',
                          border: '1px dashed rgba(99, 102, 241, 0.15)'
                        }}
                      >
                        {f.formula}
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                        {f.explanation}
                      </p>
                      {f.why && (
                        <p style={{ 
                          color: 'var(--primary)', 
                          fontSize: '0.85rem', 
                          lineHeight: 1.5, 
                          marginTop: '0.5rem',
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(99, 102, 241, 0.06)',
                          borderRadius: 'var(--radius-sm)',
                          fontStyle: 'italic'
                        }}>
                          💡 {f.why}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* The Technical Pipeline: How We Do It */}
      <div style={{ marginBottom: '5rem', padding: '3rem 2rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            How FinSight works under the hood
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
            A state-of-the-art analytical flow designed for reliability and absolute clarity.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2.5rem' }}>
          {/* Step 1 */}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                1
              </div>
              <div style={{ width: '2px', flexGrow: 1, background: 'var(--border)', minHeight: '50px', marginTop: '0.5rem' }} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={18} color="var(--primary)" /> Schema-Agnostic Data Ingestion
              </h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
                Simply upload your raw transaction files. The engine autonomously detects the domain (UPI, Tax credits, Banking data) and transforms sparse records into standard behavioral matrices.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                2
              </div>
              <div style={{ width: '2px', flexGrow: 1, background: 'var(--border)', minHeight: '50px', marginTop: '0.5rem' }} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={18} color="var(--primary)" /> Ensemble Machine Learning Classifier
              </h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
                We combine the stability of a Random Forest with the high accuracy of XGBoost models. The engine applies Isotonic Calibration to guarantee real probabilities (0–100%) instead of arbitrary scores.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                3
              </div>
              <div style={{ width: '2px', flexGrow: 1, background: 'var(--border)', minHeight: '50px', marginTop: '0.5rem' }} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Brain size={18} color="var(--primary)" /> Explainable AI (SHAP Framework)
              </h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
                No black boxes. FinSight maps out SHAP contribution values for each feature so you can see exactly which customer interactions (low recency, failing UPIs, drop in transaction frequency) drive risk.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                4
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={18} color="var(--primary)" /> Groq LLM (Llama 3.3) Strategic Layer
              </h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
                Our model outputs are parsed and sent to Llama 3.3, which synthesizes complex mathematical weights into three key hypotheses and actionable intervention strategies for your product managers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div style={{ marginBottom: '5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Designed for Modern Finance Teams
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto' }}>
            Everything you need to audit, predict, and prevent churn.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', gap: '1rem' }}>
            <div style={{ color: 'var(--primary)' }}><BarChart3 size={20} /></div>
            <div>
              <h5 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Live Drift Monitoring</h5>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>Detects when real-world transactional behavior shifts using Bonferroni-corrected KS-Tests.</p>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', gap: '1rem' }}>
            <div style={{ color: 'var(--primary)' }}><Users size={20} /></div>
            <div>
              <h5 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Strategic Personas</h5>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>Groups customers into intuitive profiles (e.g. "Loyal Giants", "Fading Stars") for your business team.</p>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', gap: '1rem' }}>
            <div style={{ color: 'var(--primary)' }}><CheckCircle2 size={20} /></div>
            <div>
              <h5 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>A/B Test Sandbox</h5>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>Ready to track actual interventions against models to create a self-healing feedback loop.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Final CTA */}
      <div style={{ textAlign: 'center', padding: '3rem 1.5rem', borderTop: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          FinSight Platform · Built with React 19, FastAPI, XGBoost, and Groq (Llama 3.3)
        </p>
        <button 
          className="btn-primary" 
          onClick={onLaunchDashboard}
          style={{ cursor: 'pointer', padding: '0.75rem 1.75rem', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
        >
          Enter Dashboard
        </button>
      </div>

    </div>
  );
}
