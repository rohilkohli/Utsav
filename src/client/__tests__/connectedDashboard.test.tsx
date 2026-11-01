// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generateFallbackPlan } from '@shared/fallback';
import { wizardInputSchema, type PlanOutput } from '@shared/schemas';
import { DashboardShell } from '../components/dashboard/DashboardShell';
import { BudgetTab } from '../components/dashboard/BudgetTab';
import { apiExtractQuote, apiSearchVendors } from '../lib/api';
vi.mock('../lib/api', async (original) => ({
  ...(await original<typeof import('../lib/api')>()),
  apiExtractQuote: vi.fn(),
  apiSearchVendors: vi.fn(),
}));
const input = wizardInputSchema.parse({
  eventType: 'birthday',
  eventDate: '2030-11-15',
  city: 'Mumbai',
  guestCount: 100,
  totalBudget: 100000,
});
const makePlan = () => generateFallbackPlan(input);
function Connected({
  plan: initial = makePlan(),
  readOnly = false,
}: {
  plan?: PlanOutput;
  readOnly?: boolean;
}) {
  const [plan, update] = useState(initial);
  const [currentInput, setInput] = useState(input);
  return (
    <DashboardShell
      input={currentInput}
      plan={plan}
      readOnly={readOnly}
      onUpdatePlan={(next, total, guests) => {
        update(next);
        setInput((previous) => ({
          ...previous,
          totalBudget: total ?? previous.totalBudget,
          guestCount: guests ?? previous.guestCount,
        }));
      }}
      onNewPlan={vi.fn()}
    />
  );
}
const quote = {
  vendorName: 'Mumbai Caterer',
  category: 'Catering',
  totalPrice: 18000,
  pricePerPlate: null,
  guestMinimum: null,
  taxIncluded: null,
  advancePercent: 60,
  overtimeFee: null,
  cancellationPolicy: null,
};

describe('Connected celebration dashboard', () => {
  it('extracts and accepts a vendor quotation, synchronizing booked status, verified spend and budget', async () => {
    vi.mocked(apiExtractQuote).mockResolvedValue({ quote, source: 'fallback' });
    const user = userEvent.setup();
    render(<Connected />);
    await user.click(screen.getByRole('tab', { name: 'Vendor Checklist' }));
    await user.click(
      requireElement((await screen.findAllByText('Analyze WhatsApp or email quote'))[0]),
    );
    await user.type(
      screen.getByLabelText('Quote text for Catering & Live Counters'),
      'Total ₹18,000. Advance 60%.',
    );
    await user.click(requireElement(screen.getAllByRole('button', { name: 'Analyze quote' })[0]));
    expect(await screen.findByText('advanceHigh', { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add to comparison' }));
    await user.click(screen.getByRole('button', { name: 'Accept quotation from Mumbai Caterer' }));
    expect(await screen.findByText('Accepted quotation')).toBeInTheDocument();
    expect(screen.getByLabelText('Status for Catering & Live Counters')).toHaveValue('booked');
    await user.click(screen.getByRole('tab', { name: 'Budget Planner' }));
    expect(screen.getByLabelText('Actual spend for Food, Snacks & Refreshments')).toHaveValue(
      '₹18,000',
    );
    expect(screen.getByText(/Verified quotation/)).toBeInTheDocument();
  });

  it('shows extraction errors without adding guessed quotation data', async () => {
    vi.mocked(apiExtractQuote).mockRejectedValue(new Error('Quote service unavailable'));
    const user = userEvent.setup();
    render(<Connected />);
    await user.click(screen.getByRole('tab', { name: 'Vendor Checklist' }));
    await user.click(
      requireElement((await screen.findAllByText('Analyze WhatsApp or email quote'))[0]),
    );
    fireEvent.change(screen.getByLabelText('Quote text for Catering & Live Counters'), {
      target: { value: 'No total stated.' },
    });
    await user.click(requireElement(screen.getAllByRole('button', { name: 'Analyze quote' })[0]));
    expect(await screen.findByRole('alert')).toHaveTextContent('Quote service unavailable');
    expect(screen.queryByRole('button', { name: 'Add to comparison' })).not.toBeInTheDocument();
  });

  it('updates catering and cross-plan over-budget warnings synchronously when guests increase', () => {
    render(<Connected />);
    fireEvent.change(screen.getByLabelText('Per-plate cost (₹)'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Guest count'), { target: { value: '200' } });
    expect(screen.getByText(/Catering shortfall:/)).toBeInTheDocument();
    expect(screen.getByRole('alert', { name: 'Budget tradeoff suggestions' })).toBeInTheDocument();
    expect(screen.getByLabelText('Actual spend for Food, Snacks & Refreshments')).toHaveValue(
      '₹2,00,000',
    );
  });

  it('preserves total allocation through sliders, locks, priorities and a zero-to-positive total', () => {
    const update = vi.fn();
    const plan = makePlan();
    const { rerender } = render(
      <BudgetTab
        categories={plan.budget}
        totalBudget={input.totalBudget}
        guestCount={100}
        perPlate={315}
        onUpdateCategories={update}
        onUpdateGuestCount={vi.fn()}
        onUpdatePerPlate={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Allocated amount for Food, Snacks & Refreshments'), {
      target: { value: '40000' },
    });
    const moved = update.mock.calls[0]?.[0] as PlanOutput['budget'];
    expect(moved.reduce((sum, category) => sum + category.amount, 0)).toBe(100000);
    const locked = moved.map((category) => ({
      ...category,
      locked: category.category.includes('Food'),
    }));
    rerender(
      <BudgetTab
        categories={locked}
        totalBudget={100000}
        guestCount={100}
        perPlate={315}
        onUpdateCategories={update}
        onUpdateGuestCount={vi.fn()}
        onUpdatePerPlate={vi.fn()}
      />,
    );
    expect(
      screen.getByLabelText('Allocation slider for Food, Snacks & Refreshments'),
    ).toBeDisabled();
    const empty = plan.budget.map((category) => ({ ...category, amount: 0, actual: 0 }));
    rerender(
      <BudgetTab
        categories={empty}
        totalBudget={0}
        guestCount={100}
        perPlate={0}
        onUpdateCategories={update}
        onUpdateGuestCount={vi.fn()}
        onUpdatePerPlate={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Total budget (₹)'), { target: { value: '80000' } });
    const resized = update.mock.lastCall?.[0] as PlanOutput['budget'];
    expect(resized.reduce((sum, category) => sum + category.amount, 0)).toBe(80000);
  });

  it('supports arrow/Home/End navigation and keeps shared snapshots read-only', async () => {
    const user = userEvent.setup();
    render(<Connected readOnly />);
    const budget = screen.getByRole('tab', { name: 'Budget Planner' });
    budget.focus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Day-of Run Sheet' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(budget).toHaveFocus();
    expect(await screen.findByText(/Target Budget:/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Guest count')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Share Plan/ })).not.toBeInTheDocument();
  });

  it('marks descendants pushed when an upstream dependency is delayed and lets users complete tasks', async () => {
    const user = userEvent.setup();
    render(<Connected />);
    await user.click(screen.getByRole('tab', { name: 'Timeline & Milestones' }));
    fireEvent.change(await screen.findByLabelText('Delay days for Finalize Guest List & Theme'), {
      target: { value: '30' },
    });
    expect(
      screen.getAllByText('⚠ Pushed by delayed task: Finalize Guest List & Theme').length,
    ).toBeGreaterThan(0);
    await user.click(screen.getByLabelText('Mark Finalize Guest List & Theme complete'));
    expect(screen.getByText(/1 of 3 milestones complete/)).toBeInTheDocument();
  });

  it('keeps the category when a real Places business is linked and reports search failures', async () => {
    vi.mocked(apiSearchVendors).mockResolvedValue([
      {
        name: 'Real Mumbai Catering',
        rating: 4.5,
        address: 'Mumbai',
        phone: '12345',
        mapsUrl: 'https://maps.google.com',
        website: 'https://example.com',
      },
    ]);
    const user = userEvent.setup();
    render(<Connected />);
    await user.click(screen.getByRole('tab', { name: 'Vendor Checklist' }));
    await user.click(
      requireElement((await screen.findAllByRole('button', { name: 'Find Real Vendors' }))[0]),
    );
    await user.click(await screen.findByRole('button', { name: 'Use This Vendor' }));
    expect(screen.getByText('Selected business: Real Mumbai Catering')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Catering & Live Counters', level: 3 }),
    ).toBeInTheDocument();
    vi.mocked(apiSearchVendors).mockRejectedValue(new Error('Places not configured'));
    await user.click(
      requireElement(screen.getAllByRole('button', { name: 'Find Real Vendors' })[0]),
    );
    await waitFor(() => {
      expect(screen.getByText('Places not configured')).toBeInTheDocument();
    });
  });
});

function requireElement(element: HTMLElement | undefined): HTMLElement {
  if (!element) throw new Error('Expected an interactive element');
  return element;
}
