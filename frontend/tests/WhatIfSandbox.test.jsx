/**
 * WhatIfPanel.test.jsx
 *
 * Tests the What-If Simulation Engine panel.
 * Covers: mode toggle, campaign card rendering + selection,
 * segment selector, run button state, and impact summary display.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import WhatIfPanel from '../src/components/dashboard/WhatIfSandbox.jsx';

vi.mock('axios');
vi.mock('canvas-confetti', () => ({
  __esModule: true,
  default: vi.fn(),
}));



const MOCK_SEGMENTS = {
  'At Risk': 820,
  'Loyal': 1240,
};

const MOCK_RESULT = {
  original_churn: 0.72,
  simulated_churn: 0.54,
  churn_reduction_pct: -18.0,
  users_affected: 312,
  revenue_saved: 840000,
  revenue_protected: 840000,
  feature_importance: 0.24,
  recommendation: 'Increasing frequency by 20% could reduce churn significantly.',
};

describe('WhatIfPanel', () => {
  beforeEach(() => {
    vi.mocked(axios.post).mockResolvedValue({ data: MOCK_RESULT });
  });

  // ── Rendering ───────────────────────────────────────────────────────────
  it('renders the panel heading', () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);
    expect(screen.getByText(/What-If Simulation Engine/i)).toBeInTheDocument();
  });

  it('renders Manual and Campaigns mode buttons', () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);
    expect(screen.getByText(/Manual/i)).toBeInTheDocument();
    expect(screen.getByText(/Campaigns/i)).toBeInTheDocument();
  });

  it('renders segment selector', () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);
    expect(screen.getByText(/Target Segment Persona/i)).toBeInTheDocument();
    // Use regex to find text that might be broken across nodes like "The Fading Star (At Risk)"
    expect(screen.getAllByText(/At Risk/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Loyal/i)[0]).toBeInTheDocument();
  });

  // ── Manual mode ─────────────────────────────────────────────────────────
  it('shows feature selector in Manual mode', () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);
    expect(screen.getByText(/Feature to Modify/i)).toBeInTheDocument();
  });

  it('shows delta slider in Manual mode', () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('Run Simulation button disabled when no segment selected', () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);
    const btn = screen.getByRole('button', { name: /Run Simulation/i });
    expect(btn).toBeDisabled();
  });

  // ── Campaign mode ────────────────────────────────────────────────────────
  it('switches to Campaign mode on click', async () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);
    const campaignBtn = screen.getByRole('button', { name: /Campaigns/i });
    await userEvent.click(campaignBtn);
    expect(screen.getByText(/₹200 Cashback/i)).toBeInTheDocument();
  });

  it('renders all 5 campaign cards in Campaign mode', async () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);
    await userEvent.click(screen.getByRole('button', { name: /Campaigns/i }));
    expect(screen.getByText(/₹200 Cashback/i)).toBeInTheDocument();
    expect(screen.getByText(/Push & SMS/i)).toBeInTheDocument();
    expect(screen.getByText(/Plan Upgrade/i)).toBeInTheDocument();
    expect(screen.getByText(/Loyalty Program/i)).toBeInTheDocument();
    expect(screen.getByText(/VIP Concierge/i)).toBeInTheDocument();
  });

  it('selecting a campaign card activates it', async () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);
    await userEvent.click(screen.getByRole('button', { name: /Campaigns/i }));
    const cashbackCard = screen.getByText(/₹200 Cashback/i).closest('button');
    await userEvent.click(cashbackCard);
    expect(cashbackCard).toHaveClass('campaign-card--active');
  });

  // ── Simulation result ───────────────────────────────────────────────────
  it('displays impact hero card after successful simulation', async () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);

    // Select segment - use more specific selector
    const select = screen.getAllByRole('combobox')[0];
    await userEvent.selectOptions(select, 'At Risk');

    // Click Run
    const runBtn = screen.getByRole('button', { name: /Run Simulation/i });
    await userEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Predicted Revenue Saved/i)).toBeInTheDocument();
    });
  });

  it('shows Prescriptive Insight section after simulation', async () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);
    const select = screen.getAllByRole('combobox')[0];
    await userEvent.selectOptions(select, 'At Risk');
    await userEvent.click(screen.getByRole('button', { name: /Run Simulation/i }));

    await waitFor(() => {
      expect(screen.getByText(/Prescriptive Insight/i)).toBeInTheDocument();
    });
  });

  it('shows recommendation text after simulation', async () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);
    const select = screen.getAllByRole('combobox')[0];
    await userEvent.selectOptions(select, 'At Risk');
    await userEvent.click(screen.getByRole('button', { name: /Run Simulation/i }));

    await waitFor(() => {
      expect(screen.getByText(/Increasing frequency by 20% could reduce churn significantly/i)).toBeInTheDocument();
    });
  });

  // ── API call ─────────────────────────────────────────────────────────────
  it('calls axios.post /whatif with correct payload', async () => {
    render(<WhatIfPanel segments={MOCK_SEGMENTS} />);
    const select = screen.getAllByRole('combobox')[0];
    await userEvent.selectOptions(select, 'At Risk');
    await userEvent.click(screen.getByRole('button', { name: /Run Simulation/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/whatif'),
        expect.objectContaining({ segment: 'At Risk' })
      );
    });
  });
});
