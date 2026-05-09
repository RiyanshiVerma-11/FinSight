/**
 * InterventionEngine.test.jsx
 *
 * Tests the Intervention Engine prescriptive playbook table.
 * Verifies: segment rows, urgency badges, action text, emoji icons,
 * and graceful handling of empty/unknown segments.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import InterventionEngine from '../src/components/InterventionEngine.jsx';

const MOCK_SEGMENTS = {
  'At Risk':    820,
  'Loyal':      1240,
  'Champions':  650,
  'Promising':  430,
  'Hibernating': 280,
};

const MOCK_SEG_CHURN = [
  { segment: 'At Risk',     avg_churn: 0.72 },
  { segment: 'Loyal',       avg_churn: 0.18 },
  { segment: 'Champions',   avg_churn: 0.08 },
  { segment: 'Promising',   avg_churn: 0.35 },
  { segment: 'Hibernating', avg_churn: 0.58 },
];

describe('InterventionEngine', () => {
  // ── Rendering ───────────────────────────────────────────────────────────
  it('renders the section heading', () => {
    render(<InterventionEngine segments={MOCK_SEGMENTS} segChurn={MOCK_SEG_CHURN} />);
    expect(screen.getByText(/Intervention Engine/i)).toBeInTheDocument();
  });

  it('renders AI-OPTIMIZED or DATA-DRIVEN badge', () => {
    render(<InterventionEngine segments={MOCK_SEGMENTS} segChurn={MOCK_SEG_CHURN} />);
    expect(screen.getByText(/DATA-DRIVEN/i)).toBeInTheDocument();
  });

  it('renders table headers: Strategic Persona, Scale, Business Impact, Recommended Action', () => {
    render(<InterventionEngine segments={MOCK_SEGMENTS} segChurn={MOCK_SEG_CHURN} />);
    expect(screen.getByText(/Strategic Persona/i)).toBeInTheDocument();
    expect(screen.getByText(/Scale/i)).toBeInTheDocument();
    expect(screen.getByText(/Business Impact/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommended Action/i)).toBeInTheDocument();
    expect(screen.getByText(/Recovery ROI/i)).toBeInTheDocument();
  });

  // ── Segment rows ────────────────────────────────────────────────────────
  it('renders a row for each segment', () => {
    render(<InterventionEngine segments={MOCK_SEGMENTS} segChurn={MOCK_SEG_CHURN} />);
    Object.keys(MOCK_SEGMENTS).forEach(seg => {
      expect(screen.getByText(seg)).toBeInTheDocument();
    });
  });

  it('shows user counts for each segment', () => {
    render(<InterventionEngine segments={MOCK_SEGMENTS} segChurn={MOCK_SEG_CHURN} />);
    expect(screen.getByText('820')).toBeInTheDocument();
    expect(screen.getByText('1,240')).toBeInTheDocument();
  });

  // ── Urgency badges ──────────────────────────────────────────────────────
  it('shows CRITICAL text for At Risk (churn 0.72)', () => {
    render(<InterventionEngine segments={MOCK_SEGMENTS} segChurn={MOCK_SEG_CHURN} />);
    const criticals = screen.getAllByText(/Critical churn/i);
    expect(criticals.length).toBeGreaterThan(0);
  });

  it('shows HIGH RECOVERY ROI or LOSS PREVENTION based on profitability', () => {
    render(<InterventionEngine segments={MOCK_SEGMENTS} segChurn={MOCK_SEG_CHURN} />);
    const lossPrevention = screen.getAllByText(/LOSS PREVENTION|HIGH RECOVERY ROI/i);
    expect(lossPrevention.length).toBeGreaterThan(0);
  });

  // ── Action content ──────────────────────────────────────────────────────
  it('shows action text based on churn risk', () => {
    render(<InterventionEngine segments={MOCK_SEGMENTS} segChurn={MOCK_SEG_CHURN} />);
    // Problem text based on churn
    expect(screen.getByText(/Critical churn at 72%|Elevated risk at/i)).toBeInTheDocument();
  });

  // ── Edge cases ──────────────────────────────────────────────────────────
  it('renders with empty segments without crashing', () => {
    render(<InterventionEngine segments={{}} segChurn={[]} />);
    expect(screen.getByText(/Intervention Engine/i)).toBeInTheDocument();
  });

  it('renders unknown segment using default intervention', () => {
    render(
      <InterventionEngine
        segments={{ 'UnknownSegmentXYZ': 100 }}
        segChurn={[{ segment: 'UnknownSegmentXYZ', avg_churn: 0.5 }]}
      />
    );
    expect(screen.getByText('UnknownSegmentXYZ')).toBeInTheDocument();
  });
});
