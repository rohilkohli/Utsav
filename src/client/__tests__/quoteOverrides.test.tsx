// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { planOutputSchema, type PlanOutput } from '@shared/schemas';
import { acceptQuotation } from '@shared/quotes';
import { input, plan, quote, vendor } from '../../shared/__tests__/fixtures';
import { DashboardPanel } from '../components/dashboard/DashboardPanel';
import { QuoteComparison } from '../components/dashboard/QuoteComparison';

const accepted = { ...quote, quotedAmount: 100 };
const saved = [
  accepted,
  { ...quote, id: 'q2', vendorName: 'Bela', quotedAmount: 110 },
  { ...quote, id: 'q3', vendorName: 'Chaya', quotedAmount: 125 },
];
const initial = () =>
  acceptQuotation(plan({ vendors: [{ ...vendor, quotes: saved }] }), vendor.id, accepted, 100);

function PersistedQuotation({ onPersist }: { onPersist: (next: PlanOutput) => void }) {
  const [current, update] = useState(initial);
  return (
    <DashboardPanel
      tab="vendors"
      plan={current}
      input={input}
      onUpdatePlan={(next) => {
        // The same schema and JSON boundary used when a plan is saved and reopened.
        const restored = planOutputSchema.parse(JSON.parse(JSON.stringify(next)) as unknown);
        onPersist(restored);
        update(restored);
      }}
    />
  );
}

describe('Manual quotation overrides', () => {
  it('compares the current manual amount, clears acceptance and restores saved terms on reacceptance', async () => {
    const persist = vi.fn<(next: PlanOutput) => void>();
    const user = userEvent.setup();
    render(<PersistedQuotation onPersist={persist} />);
    const amount = await screen.findByLabelText('Quoted amount for Food');
    expect(screen.getByText('Accepted quotation')).toBeVisible();

    fireEvent.change(amount, { target: { value: '140' } });
    const summary = screen.getByRole('status', { name: 'Current manual quote for Food' });
    expect(within(summary).getByText('₹140')).toBeVisible();
    expect(within(summary).getByText('significantly over · 40% vs target')).toBeVisible();
    expect(within(summary).getByText(/overCategoryBudget/)).toBeVisible();
    expect(screen.queryByText('Accepted quotation')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Status for Food')).toHaveValue('quoted');
    expect(persist.mock.lastCall?.[0].vendors[0]).toMatchObject({
      quotedAmount: 140,
      status: 'quoted',
      quotes: initial().vendors[0]?.quotes,
    });
    expect(persist.mock.lastCall?.[0].vendors[0]).not.toHaveProperty('acceptedQuoteId');
    expect(persist.mock.lastCall?.[0].budget[0]).toMatchObject({ actual: 140, verified: false });
    expect(screen.getAllByRole('button', { name: /^Accept quotation from/ })).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Accept quotation from Asha' }));
    expect(screen.getByText('Accepted quotation')).toBeVisible();
    expect(screen.queryByRole('status', { name: 'Current manual quote for Food' })).toBeNull();
    expect(screen.getByLabelText('Quoted amount for Food')).toHaveValue('₹100');
    expect(screen.getByLabelText('Status for Food')).toHaveValue('booked');
    expect(persist.mock.lastCall?.[0].budget[0]).toMatchObject({ actual: 100, verified: true });
    expect(persist.mock.lastCall?.[0].vendors[0]?.quotes).toHaveLength(3);
    expect(persist.mock.lastCall?.[0].vendors[0]?.quotes).toEqual(expect.arrayContaining(saved));

    fireEvent.change(screen.getByLabelText('Quoted amount for Food'), { target: { value: '0' } });
    expect(screen.getByLabelText('Status for Food')).toHaveValue('to-contact');
    expect(screen.queryByText('Accepted quotation')).toBeNull();
    expect(screen.queryByRole('status', { name: 'Current manual quote for Food' })).toBeNull();
    expect(persist.mock.lastCall?.[0].budget[0]).toMatchObject({ actual: 0, verified: false });
    expect(persist.mock.lastCall?.[0].vendors[0]?.quotes).toHaveLength(3);
  });

  it('clears accepted and verified markers when the booking status is manually withdrawn', async () => {
    const persist = vi.fn<(next: PlanOutput) => void>();
    render(<PersistedQuotation onPersist={persist} />);
    fireEvent.change(await screen.findByLabelText('Status for Food'), {
      target: { value: 'quoted' },
    });
    expect(screen.queryByText('Accepted quotation')).toBeNull();
    expect(persist.mock.lastCall?.[0].vendors[0]).not.toHaveProperty('acceptedQuoteId');
    expect(persist.mock.lastCall?.[0].budget[0]).toMatchObject({ actual: 100, verified: false });
    expect(screen.getByRole('status', { name: 'Current manual quote for Food' })).toBeVisible();
  });

  it('preserves acceptance controls for a manual quote when there are no saved alternatives', async () => {
    const accept = vi.fn();
    const remove = vi.fn();
    const user = userEvent.setup();
    render(
      <QuoteComparison
        vendor={{ ...vendor, quotedAmount: 120, businessName: 'Selected Caterer' }}
        onAccept={accept}
        onRemove={remove}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Accept quotation from Selected Caterer' }),
    );
    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({ id: vendor.id, quotedAmount: 120, vendorName: 'Selected Caterer' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Remove quotation from Selected Caterer' }),
    );
    expect(remove).toHaveBeenCalledWith(vendor.id);
  });

  it('evaluates saved quote risk against the current allocation', () => {
    render(
      <QuoteComparison
        vendor={{
          ...vendor,
          budgetedAmount: 200,
          quotes: [{ ...quote, taxIncluded: true, cancellationPolicy: 'Refundable' }],
        }}
      />,
    );
    expect(screen.getByText('within budget · -40% vs target')).toBeVisible();
    expect(screen.getByText('Risk flags: None')).toBeVisible();
    expect(screen.queryByText(/overCategoryBudget/)).toBeNull();
  });
});
