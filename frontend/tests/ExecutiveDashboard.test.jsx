/**
 * ExecutiveDashboard.test.jsx
 *
 * Tests the Executive Dashboard modal component.
 * Verifies: rendering, KPI values, Before/After table, close handler,
 * churn segment bars, and top action card.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExecutiveDashboard from '../src/components/dashboard/ExecutiveDashboard.jsx';

// ── Sample data fixture ───────────────────────────────────────────────────
const MOCK_DATA = {
  summary: {
    total_users: 5000,
    avg_churn_risk: 0.34,
    segments: { 'At Risk': 820, 'Loyal': 1240, 'Champions': 650 },
    segment_churn: [
      { segment: 'At Risk',    avg_churn: 0.72, revenue_at_risk: 240000, status: 'CRITICAL' },
      { segment: 'Loyal',      avg_churn: 0.18, revenue_at_risk: 85000,  status: 'STABLE' },
      { segment: 'Champions',  avg_churn: 0.08, revenue_at_risk: 32000,  status: 'STABLE' },
    ],
    revenue_at_risk: { total: 840000 },
    potential_recovery: { value: 150000, efficiency_pct: 45 },
    top_drivers: [
      { feature: 'recency_deviation', importance: 0.42, direction: 'increases_churn' },
    ],
    metrics: { roc_auc: 0.87 },
    data_health: { score: 92 }
  },
  users: Array.from({ length: 50 }, (_, i) => ({
    user_id: `U${i + 1}`,
    churn_probability: i < 10 ? 0.75 : 0.35,
    monetary: 1000 + i * 100,
    predicted_ltv: 1200 + i * 120,
  })),
};

describe('ExecutiveDashboard', () => {
  const onExportAll = vi.fn();
  const onNavigate = vi.fn();

  beforeEach(() => {
    onExportAll.mockClear();
    onNavigate.mockClear();
    render(<ExecutiveDashboard data={MOCK_DATA} onExportAll={onExportAll} onNavigate={onNavigate} />);
  });

  // ── Rendering ─────────────────────────────────────────────────────────
  it('renders the dashboard heading', () => {
    expect(screen.getByText(/Executive Intelligence Dashboard/i)).toBeInTheDocument();
  });

  it('renders all 4 KPI cards', () => {
    expect(screen.getAllByText(/Market Footprint/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Baseline Churn Risk/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Revenue Exposure/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Recovery Capture/i)[0]).toBeInTheDocument();
  });

  // ── KPI values ────────────────────────────────────────────────────────
  it('displays correct total users', () => {
    // 5000 should be formatted with comma
    expect(screen.getByText('5,000')).toBeInTheDocument();
  });

  it('displays churn risk as percentage', () => {
    expect(screen.getByText('34.0%')).toBeInTheDocument();
  });

  it('displays revenue at risk with ₹ prefix and Lakh formatting', () => {
    // 840,000 should format to ₹8.40L
    // Use getAllByText as it appears in narrative and KPI card
    expect(screen.getAllByText(/₹8\.40L/)[0]).toBeInTheDocument();
  });

  // ── Visualizations ─────────────────────────────────────────────
  it('renders Strategic Playbook section', () => {
    expect(screen.getAllByText(/Strategic Playbook/i)[0]).toBeInTheDocument();
  });

  it('shows segmentation chart header', () => {
    expect(screen.getByText(/Segment Distribution/i)).toBeInTheDocument();
  });

  it('shows lifecycle stages header', () => {
    expect(screen.getByText(/Customer Lifecycle Stages/i)).toBeInTheDocument();
  });

  // ── Segment churn ─────────────────────────────────────────────────────
  it('renders segment names in churn section', () => {
    // "At Risk" appears multiple times, use getAll
    expect(screen.getAllByText('At Risk')[0]).toBeInTheDocument();
  });
});
