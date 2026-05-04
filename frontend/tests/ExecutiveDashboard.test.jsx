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
import ExecutiveDashboard from '../src/components/ExecutiveDashboard.jsx';

// ── Sample data fixture ───────────────────────────────────────────────────
const MOCK_DATA = {
  summary: {
    total_users: 5000,
    avg_churn_risk: 0.34,
    segments: { 'At Risk': 820, 'Loyal': 1240, 'Champions': 650 },
    segment_churn: [
      { segment: 'At Risk',    avg_churn: 0.72, revenue_at_risk: 240000 },
      { segment: 'Loyal',      avg_churn: 0.18, revenue_at_risk: 85000  },
      { segment: 'Champions',  avg_churn: 0.08, revenue_at_risk: 32000  },
    ],
    revenue_at_risk: { total: 840000 },
    top_drivers: [
      { feature: 'recency_deviation', importance: 0.42, direction: 'increases_churn' },
    ],
    metrics: { roc_auc: 0.87 },
  },
  users: Array.from({ length: 50 }, (_, i) => ({
    user_id: `U${i + 1}`,
    churn_probability: i < 10 ? 0.75 : 0.35,
    monetary: 1000 + i * 100,
    predicted_ltv: 1200 + i * 120,
  })),
};

describe('ExecutiveDashboard', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    render(<ExecutiveDashboard data={MOCK_DATA} onClose={onClose} />);
  });

  // ── Rendering ─────────────────────────────────────────────────────────
  it('renders the modal heading', () => {
    expect(screen.getByText(/Executive Dashboard/i)).toBeInTheDocument();
  });

  it('renders all 4 KPI cards', () => {
    expect(screen.getByText(/Total Users/i)).toBeInTheDocument();
    expect(screen.getByText(/Avg Churn Risk/i)).toBeInTheDocument();
    expect(screen.getByText(/Revenue at Risk/i)).toBeInTheDocument();
    expect(screen.getByText(/Potential Saved/i)).toBeInTheDocument();
  });

  // ── KPI values ────────────────────────────────────────────────────────
  it('displays correct total users', () => {
    expect(screen.getByText('5,000')).toBeInTheDocument();
  });

  it('displays churn risk as percentage', () => {
    expect(screen.getByText('34.0%')).toBeInTheDocument();
  });

  it('displays revenue at risk with $ prefix', () => {
    expect(screen.getByText(/\$840,000/)).toBeInTheDocument();
  });

  // ── Before vs After table ─────────────────────────────────────────────
  it('renders Before vs After section', () => {
    expect(screen.getByText(/Without vs With FinSight/i)).toBeInTheDocument();
  });

  it('shows "Segmentation" row in before/after table', () => {
    expect(screen.getByText('Segmentation')).toBeInTheDocument();
  });

  it('shows "Dynamic RFM" in after column', () => {
    expect(screen.getByText(/Dynamic RFM/i)).toBeInTheDocument();
  });

  // ── Segment churn ─────────────────────────────────────────────────────
  it('renders segment names in churn section', () => {
    expect(screen.getByText('At Risk')).toBeInTheDocument();
  });

  // ── Close handler ─────────────────────────────────────────────────────
  it('calls onClose when close button clicked', () => {
    const closeBtn = screen.getByRole('button', { name: /close|×|x/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
