import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, Activity, Cpu, Brain,
  Zap, Database, CheckCircle2, ArrowRight,
  TrendingUp, BarChart3, Users, PlayCircle,
  FileSpreadsheet, BookOpen, Percent, Calculator, Info,
  ChevronDown, ChevronUp, Sparkles, DollarSign, IndianRupee, Target,
  Layers, ShieldCheck, HelpCircle, Server, RefreshCw
} from 'lucide-react';

export default function LandingPage({ onLaunchDashboard }) {
  const [activeInfoTab, setActiveInfoTab] = useState('data'); // 'data' | 'math'
  const [activeFaq, setActiveFaq] = useState(null);

  // Interactive ROI Calculator State
  const [mau, setMau] = useState(15000);
  const [arpu, setArpu] = useState(60);
  const [churnRate, setChurnRate] = useState(3.0);
  const [reductionRate, setReductionRate] = useState(30);

  // Calculations for ROI Calculator
  const monthlyChurnedUsers = Math.round(mau * (churnRate / 100));
  const annualRevenueAtRisk = monthlyChurnedUsers * 12 * arpu;
  const annualRevenueSaved = annualRevenueAtRisk * (reductionRate / 100);
  const projectedRoiMultiple = (annualRevenueSaved / 24000).toFixed(1);
  const highRiskCohort = Math.round(monthlyChurnedUsers * 1.35);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
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
      sample: 'payee_vpa_123, 2026-07-14 12:30:15, ₹500.00, SUCCESS',
      derivedFeatures: ['ipi_consistency', 'recency_dev', 'upi_failure_rate', 'velocity_7d']
    },
    {
      id: 'banking',
      name: 'Banking & Account Churn',
      icon: '🏦',
      description: 'Summary files documenting customer account balances, credit profiles, and status.',
      required: ['customer_id', 'balance (monetary)', 'num_of_products (frequency)', 'tenure_months'],
      optional: ['credit_score', 'estimated_salary', 'is_active_member', 'exited (churn label)'],
      sample: 'cust_8832, ₹12,500.45, 2, 24, 720, ₹85,000.00, 1, 0',
      derivedFeatures: ['balance_tenure_ratio', 'product_utilization', 'credit_risk_tier']
    },
    {
      id: 'tax',
      name: 'Tax & Income Credits',
      icon: '📄',
      description: 'Form 26AS style credits, TDS details, or recurrent taxable income entries.',
      required: ['pan (user_id)', 'timestamp (date of credit)', 'gross_amount_inr (amount)'],
      optional: ['income_head (description)', 'deductor_tan', 'section'],
      sample: 'ABCDE1234F, 2026-06-30, ₹75,000.00, Salary - Section 192',
      derivedFeatures: ['credit_gap_days', 'annual_headroom', 'tds_concentration']
    },
    {
      id: 'retail',
      name: 'Retail & E-commerce',
      icon: '🛒',
      description: 'Classic transactional basket records including quantities and unit pricing.',
      required: ['customer_id', 'timestamp (Invoice Date)', 'amount (or unit_price + quantity)'],
      optional: ['quantity', 'unit_price', 'description (product name)'],
      sample: 'user_403, 2026-07-10 09:45:00, ₹2,999.00, 1, ₹2,999.00, Wireless Mouse',
      derivedFeatures: ['basket_avg_value', 'repurchase_interval', 'category_breadth']
    },
    {
      id: 'generic',
      name: 'Generic Transactional',
      icon: '⚙️',
      description: 'Any CSV/Excel mapping user identifier columns, time series fields, and numeric values.',
      required: ['user_id (or customer_id / account)', 'timestamp (date)', 'amount (value / spend)'],
      optional: ['any descriptive feature column'],
      sample: 'acc_8801, 2026-07-12, ₹1,000.00, Custom Label',
      derivedFeatures: ['activity_velocity', 'recency_decay', 'spending_trend']
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

  const faqs = [
    {
      q: 'How does FinSight import data without rigid, fixed column schemas?',
      a: 'FinSight features a fuzzy schema-matching engine that evaluates column names using normalized string distance and semantic header detection. Whether your file labels user IDs as "payer_vpa", "customer_id", or "account_number", FinSight auto-maps them to standardized analytics attributes instantly.'
    },
    {
      q: 'Why does FinSight emphasize Isotonic Probability Calibration?',
      a: 'Standard ML algorithms (like raw XGBoost or Random Forest decision trees) output raw score rankings, not true calibrated probabilities. FinSight passes prediction scores through isotonic regression on a dedicated calibration split, ensuring an 80% risk prediction accurately translates to an 80% real-world likelihood of churn.'
    },
    {
      q: 'How does the SHAP (SHapley Additive exPlanations) explainability layer work?',
      a: 'FinSight calculates exact Shapley values for every user and feature. Instead of giving a mysterious risk score, FinSight explicitly isolates feature impact — showing, for example, that +45% of customer #8832\'s churn risk is driven by a 14-day recency spike, while +25% comes from failing UPI transaction codes.'
    },
    {
      q: 'How is customer transaction data kept secure and private?',
      a: 'All data processing and ML pipeline execution run strictly within your configured environment or backend session. Raw customer identifiers (PII) can be hashed or anonymized prior to upload without impacting mathematical velocity calculations.'
    },
    {
      q: 'What role does Groq & Llama 3.3 play in the FinSight platform?',
      a: 'While XGBoost and SHAP compute precise mathematical weights, Groq-accelerated Llama 3.3 synthesizes these metrics into executive-ready strategic hypotheses and tailored intervention plans for product managers.'
    }
  ];

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-page-wrapper" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.25rem 4rem' }}>
      
      {/* STICKY GLASSMORPHIC NAVBAR */}
      <header className="landing-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}>
            <Brain size={22} />
          </div>
          <div>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Fin<span className="logo-gradient">Sight</span>
            </span>
            <span style={{
              fontSize: '0.68rem', fontWeight: 800, background: 'rgba(99, 102, 241, 0.1)',
              color: 'var(--primary)', padding: '0.15rem 0.45rem', borderRadius: '1rem', marginLeft: '0.4rem'
            }}>
              v2.4 Enterprise
            </span>
          </div>
        </div>

        <ul className="landing-navbar-links">
          <li><span onClick={() => scrollToSection('features')} className="landing-nav-link">Features</span></li>
          <li><span onClick={() => scrollToSection('roi-calculator')} className="landing-nav-link">ROI Calculator</span></li>
          <li><span onClick={() => scrollToSection('schemas')} className="landing-nav-link">Data Schemas</span></li>
          <li><span onClick={() => scrollToSection('math-engine')} className="landing-nav-link">Math Engine</span></li>
          <li><span onClick={() => scrollToSection('faq')} className="landing-nav-link">FAQ</span></li>
        </ul>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            className="btn-outline" 
            onClick={onLaunchDashboard}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            Demo Mode
          </button>
          <button 
            className="btn-primary" 
            onClick={onLaunchDashboard}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
          >
            Launch Platform <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          textAlign: 'center',
          padding: '4.5rem 1.5rem 3.5rem',
          borderRadius: 'var(--radius-2xl)',
          background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, rgba(236, 72, 153, 0.02) 100%)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.03)',
          marginBottom: '5rem',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{
          position: 'absolute', top: '-10%', left: '20%', width: '450px', height: '450px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none', filter: 'blur(40px)'
        }} />

        <motion.div variants={itemVariants} className="hero-glow-badge">
          <Sparkles size={16} /> ✦ Next-Gen Retention & Revenue Protection for FinTech ✦
        </motion.div>

        <motion.h1 
          variants={itemVariants}
          style={{ 
            fontSize: '3.6rem', 
            fontWeight: 900, 
            lineHeight: 1.1, 
            letterSpacing: '-0.03em', 
            marginBottom: '1.5rem',
            color: 'var(--text-primary)'
          }}
        >
          Predict Customer Churn.<br />
          <span className="hero-gradient-title">
            Protect High-Value Revenue. Auditable by Design.
          </span>
        </motion.h1>

        <motion.p 
          variants={itemVariants}
          style={{ 
            fontSize: '1.25rem', 
            color: 'var(--text-secondary)', 
            maxWidth: '780px', 
            margin: '0 auto 2.5rem',
            lineHeight: 1.6
          }}
        >
          Transform raw transaction logs into calibrated churn probabilities, defensible Revenue at Risk (RAR) estimates, and SHAP-explained strategic interventions powered by XGBoost & Groq Llama 3.3.
        </motion.p>

        <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '3.5rem' }}>
          <button 
            className="btn-primary" 
            onClick={onLaunchDashboard}
            style={{ 
              padding: '0.9rem 2.25rem', 
              fontSize: '1rem', 
              borderRadius: 'var(--radius-lg)', 
              fontWeight: 700,
              boxShadow: '0 10px 25px rgba(99, 102, 241, 0.3)'
            }}
          >
            <PlayCircle size={20} /> Launch FinSight Platform <ArrowRight size={18} />
          </button>
          <button 
            className="btn-outline"
            onClick={() => scrollToSection('roi-calculator')}
            style={{ 
              padding: '0.9rem 1.75rem', 
              fontSize: '1rem', 
              borderRadius: 'var(--radius-lg)',
              fontWeight: 600 
            }}
          >
            <Calculator size={18} /> Calculate ROI & Impact
          </button>
        </motion.div>

        {/* HERO LIVE DASHBOARD MOCKUP PREVIEW */}
        <motion.div variants={itemVariants} style={{ maxWidth: '980px', margin: '0 auto', textAlign: 'left' }}>
          <div className="mock-dashboard-card">
            <div className="mock-dashboard-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="window-dots">
                  <div className="window-dot" style={{ background: '#ef4444' }} />
                  <div className="window-dot" style={{ background: '#f59e0b' }} />
                  <div className="window-dot" style={{ background: '#10b981' }} />
                </div>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                  finsight-analytics-engine // live_portfolio_v2.4
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '1rem', color: '#10b981', fontSize: '0.75rem', fontWeight: 700 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                ENGINE ACTIVE · LATENCY 24ms
              </div>
            </div>

            <div style={{ padding: '1.75rem' }}>
              {/* Mock KPI Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Total Revenue at Risk</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f43f5e', marginTop: '0.25rem' }}>₹14,20,500</div>
                  <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '0.2rem' }}>↓ 14.2% after intervention</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Calibration Accuracy</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#6366f1', marginTop: '0.25rem' }}>94.8% AUC</div>
                  <div style={{ fontSize: '0.7rem', color: '#818cf8', marginTop: '0.2rem' }}>Isotonic Scaled</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Bonferroni KS Drift</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>Healthy (0.012)</div>
                  <div style={{ fontSize: '0.7rem', color: '#34d399', marginTop: '0.2rem' }}>Zero feature drift detected</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Groq AI Strategic Engine</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ec4899', marginTop: '0.25rem' }}>Llama 3.3 70B</div>
                  <div style={{ fontSize: '0.7rem', color: '#f472b6', marginTop: '0.2rem' }}>3 Hypotheses Formulated</div>
                </div>
              </div>

              {/* Mock SHAP Visual Bar */}
              <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <BarChart3 size={16} color="#818cf8" /> Top SHAP Churn Drivers (Portfolio Level)
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>TreeSHAP Explainer</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.2rem' }}>
                      <span>Recency Deviation (`recency_dev`)</span>
                      <span style={{ color: '#f43f5e', fontWeight: 700 }}>+0.42 SHAP</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '85%', height: '100%', background: 'linear-gradient(90deg, #6366f1, #f43f5e)', borderRadius: '3px' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.2rem' }}>
                      <span>IPI Consistency Score (`ipi_consistency`)</span>
                      <span style={{ color: '#f43f5e', fontWeight: 700 }}>+0.28 SHAP</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '62%', height: '100%', background: 'linear-gradient(90deg, #6366f1, #ec4899)', borderRadius: '3px' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.2rem' }}>
                      <span>Monetary Spend Velocity (`velocity_90d`)</span>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>-0.19 SHAP (Protective)</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '42%', height: '100%', background: '#38bdf8', borderRadius: '3px' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* CORE VALUE PROPOSITION GRID */}
      <div id="features" style={{ marginBottom: '6rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            Built for Modern Fintech Revenue Teams
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', maxWidth: '640px', margin: '0 auto' }}>
            Closing the gap between raw transaction data and high-impact retention decisions.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '1rem', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <ShieldAlert size={26} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Early Behavioral Decay Spotting</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.98rem' }}>
              Detect subtle drops in purchase frequency, UPI payment failures, and recency gaps weeks before a user formally closes their account or stops transacting.
            </p>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '1rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <TrendingUp size={26} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Defensible Revenue at Risk (RAR)</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.98rem' }}>
              Quantify financial exposure accurately. By combining calibrated churn probability with run-rate spend velocity, FinSight tells finance leadership exactly how many rupees are on the line.
            </p>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Zap size={26} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Groq AI Strategic Interventions</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.98rem' }}>
              Turn math into execution. Powered by Groq-accelerated Llama 3.3, FinSight synthesizes complex model weights into 3 actionable product hypotheses and targeted campaign workflows.
            </p>
          </div>
        </div>
      </div>

      {/* INTERACTIVE ROI & REVENUE PROTECTION CALCULATOR WIDGET */}
      <div id="roi-calculator" style={{ marginBottom: '6rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)', padding: '3rem 2.5rem', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', padding: '0.4rem 1rem', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem' }}>
            <IndianRupee size={16} /> Interactive Business Impact Model
          </div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Estimate Your Revenue Retention Impact
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
            Adjust your customer base and retention goals to see estimated annual revenue protected with FinSight.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem', alignItems: 'center' }}>
          {/* Sliders Side */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 700 }}>
                <span>Monthly Active Users (MAU):</span>
                <span style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>{mau.toLocaleString('en-IN')}</span>
              </div>
              <input 
                type="range" min="2000" max="250000" step="1000" 
                value={mau} onChange={(e) => setMau(Number(e.target.value))} 
                className="roi-slider"
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 700 }}>
                <span>Average Monthly Spend / ARPU (₹):</span>
                <span style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>₹{arpu.toLocaleString('en-IN')}</span>
              </div>
              <input 
                type="range" min="10" max="500" step="5" 
                value={arpu} onChange={(e) => setArpu(Number(e.target.value))} 
                className="roi-slider"
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 700 }}>
                <span>Current Monthly Churn Rate (%):</span>
                <span style={{ color: 'var(--accent-rose)', fontSize: '1.05rem' }}>{churnRate}%</span>
              </div>
              <input 
                type="range" min="1.0" max="10.0" step="0.5" 
                value={churnRate} onChange={(e) => setChurnRate(Number(e.target.value))} 
                className="roi-slider"
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 700 }}>
                <span>Target FinSight Churn Reduction (%):</span>
                <span style={{ color: 'var(--accent-emerald)', fontSize: '1.05rem' }}>{reductionRate}%</span>
              </div>
              <input 
                type="range" min="10" max="50" step="5" 
                value={reductionRate} onChange={(e) => setReductionRate(Number(e.target.value))} 
                className="roi-slider"
              />
            </div>
          </div>

          {/* Results Output Display Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(236, 72, 153, 0.05) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 'var(--radius-xl)',
            padding: '2.25rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Projected Annual Revenue Saved
            </div>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1, marginBottom: '1.25rem' }}>
              ₹{Math.round(annualRevenueSaved).toLocaleString('en-IN')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(99, 102, 241, 0.15)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Exposure (RAR)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹{Math.round(annualRevenueAtRisk).toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Projected FinSight ROI</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>{projectedRoiMultiple}x ROI</div>
              </div>
            </div>

            <button 
              className="btn-primary"
              onClick={onLaunchDashboard}
              style={{ width: '100%', marginTop: '1.75rem', justifyContent: 'center', padding: '0.85rem' }}
            >
              Protect Revenue Now <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* DYNAMIC TABBED PANEL: SCHEMAS & MATH ENGINE */}
      <div id="schemas" style={{ marginBottom: '6rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
        
        {/* Navigation Tabs Header */}
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
              gap: '0.6rem',
              transition: 'all 0.2s ease'
            }}
          >
            <FileSpreadsheet size={20} /> Supported Import Data & Schemas
          </button>
          <button 
            id="math-engine"
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
              gap: '0.6rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Calculator size={20} /> Auditable Math Engine & Formulas
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '2.5rem' }}>
          <AnimatePresence mode="wait">
            {activeInfoTab === 'data' ? (
              <motion.div 
                key="data-tab" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    Fuzzy Schema-Agnostic Import Ingestion
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    FinSight does not force you to alter your database exports. Our fuzzy column mapping engine dynamically parses transactions across 5 core FinTech templates:
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                  {schemas.map((s) => (
                    <div 
                      key={s.id} 
                      style={{ 
                        background: 'var(--bg-body)', 
                        borderRadius: 'var(--radius-lg)', 
                        padding: '1.75rem', 
                        border: '1px solid var(--border)',
                        display: 'grid',
                        gridTemplateColumns: '70px 1fr',
                        gap: '1.25rem',
                        alignItems: 'start'
                      }}
                    >
                      <div style={{ fontSize: '2.5rem', textAlign: 'center', alignSelf: 'center' }}>
                        {s.icon}
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</h4>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.1)', padding: '0.25rem 0.65rem', borderRadius: '1rem' }}>
                            Auto-Detect Match
                          </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '0.85rem', lineHeight: 1.5 }}>
                          {s.description}
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>Required Column Triggers:</strong>
                            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                              {s.required.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>FinSight Engineered Features:</strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                              {s.derivedFeatures.map((f, i) => (
                                <span key={i} style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary-dark)', padding: '0.15rem 0.5rem', borderRadius: '0.35rem', fontWeight: 600 }}>
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div style={{ background: 'var(--bg-card)', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Sample Row:</strong> {s.sample}
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
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    Open, Auditable Financial Mathematics
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    FinSight rejects "black-box" predictions. Every metric is backed by explicit, auditable mathematical formulas designed for financial compliance:
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.75rem' }}>
                  {mathFormulas.map((f, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        borderLeft: '4px solid var(--primary)', 
                        paddingLeft: '1.5rem', 
                        background: 'rgba(99, 102, 241, 0.02)',
                        padding: '1.25rem 1.5rem',
                        borderRadius: '0 0.75rem 0.75rem 0',
                        border: '1px solid var(--border)',
                        borderLeftColor: 'var(--primary)'
                      }}
                    >
                      <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                        {f.title}
                      </h4>
                      <div 
                        style={{ 
                          fontFamily: 'monospace', 
                          fontWeight: 700, 
                          color: 'var(--primary-dark)', 
                          fontSize: '0.95rem',
                          background: 'rgba(99, 102, 241, 0.06)',
                          padding: '0.5rem 0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          display: 'inline-block',
                          marginBottom: '0.6rem',
                          border: '1px dashed rgba(99, 102, 241, 0.2)'
                        }}
                      >
                        {f.formula}
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                        {f.explanation}
                      </p>
                      {f.why && (
                        <p style={{ 
                          color: 'var(--primary)', 
                          fontSize: '0.85rem', 
                          lineHeight: 1.5, 
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(99, 102, 241, 0.08)',
                          borderRadius: 'var(--radius-sm)',
                          fontStyle: 'italic',
                          fontWeight: 500
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

      {/* TECHNICAL PIPELINE STEPS */}
      <div style={{ marginBottom: '6rem', padding: '3rem 2.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            How FinSight Works Under the Hood
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
            A state-of-the-art analytical architecture combining XGBoost, SHAP, and Groq LLMs.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
          <div style={{ background: 'var(--bg-body)', padding: '1.75rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '1.25rem' }}>
              1
            </div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} color="var(--primary)" /> Schema Ingestion
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Raw payment logs are dynamically parsed into standard behavioral features like recency gaps and IPI consistency.
            </p>
          </div>

          <div style={{ background: 'var(--bg-body)', padding: '1.75rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '1.25rem' }}>
              2
            </div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={18} color="var(--primary)" /> Calibrated XGBoost
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Ensemble decision trees predict raw risk, followed by Isotonic Regression for 100% calibrated probabilities.
            </p>
          </div>

          <div style={{ background: 'var(--bg-body)', padding: '1.75rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '1.25rem' }}>
              3
            </div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain size={18} color="var(--primary)" /> TreeSHAP Explainer
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Identifies exact feature contribution scores per user so every risk score can be explained to compliance officers.
            </p>
          </div>

          <div style={{ background: 'var(--bg-body)', padding: '1.75rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '1.25rem' }}>
              4
            </div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} color="var(--primary)" /> Groq Llama 3.3
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Synthesizes feature weights into executive hypotheses and concrete retention playbooks for your growth team.
            </p>
          </div>
        </div>
      </div>

      {/* INTERACTIVE FAQ ACCORDION SECTION */}
      <div id="faq" style={{ marginBottom: '6rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.4rem 1rem', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem' }}>
            <HelpCircle size={16} /> Frequently Asked Questions
          </div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Got Questions? We Have Answers.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
            Everything you need to know about FinSight\'s security, math models, and ingestion engine.
          </p>
        </div>

        <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div key={idx}>
                <button 
                  className={`faq-question-btn ${isOpen ? 'active' : ''}`}
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp size={20} color="var(--primary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                </button>
                {isOpen && (
                  <div className="faq-answer-box">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FINAL CALL TO ACTION BANNER */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 50%, var(--secondary) 100%)',
        borderRadius: 'var(--radius-2xl)',
        padding: '4rem 2rem',
        textAlign: 'center',
        color: '#ffffff',
        boxShadow: '0 20px 50px rgba(99, 102, 241, 0.35)',
        marginBottom: '4rem'
      }}>
        <h2 style={{ fontSize: '2.6rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
          Ready to Stop Churn & Protect Revenue?
        </h2>
        <p style={{ fontSize: '1.2rem', opacity: 0.9, maxWidth: '650px', margin: '0 auto 2.25rem', lineHeight: 1.6 }}>
          Experience the full FinSight platform with built-in sample datasets or upload your own transaction logs in seconds.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={onLaunchDashboard}
            style={{
              background: '#ffffff',
              color: 'var(--primary-dark)',
              border: 'none',
              padding: '1rem 2.5rem',
              borderRadius: 'var(--radius-lg)',
              fontWeight: 800,
              fontSize: '1.05rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
            }}
          >
            Enter FinSight Platform <ArrowRight size={20} />
          </button>
        </div>
      </div>

      {/* SLEEK ENTERPRISE FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border)', paddingTop: '3rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Brain size={20} color="var(--primary)" />
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>FinSight Platform</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.35rem 0.85rem', borderRadius: '1rem', color: '#10b981', fontSize: '0.8rem', fontWeight: 700 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            All Systems Operational
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <div>
            Built with React 19, FastAPI, XGBoost, and Groq (Llama 3.3)
          </div>
          <div>
            © {new Date().getFullYear()} FinSight Enterprise Retention Intelligence. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
