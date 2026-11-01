// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { DashboardPanel } from '../components/dashboard/DashboardPanel';
import { TradeoffSuggestions } from '../components/dashboard/TradeoffSuggestions';
import { acceptQuotation } from '@shared/quotes';
import { category, input, plan, quote, vendor } from '../../shared/__tests__/fixtures';

function ConnectedBudget({ customActual = false }: { customActual?: boolean }) {
  const [currentPlan, setPlan] = useState(
    plan({
      budget: [
        { ...category('Food', 100), actual: customActual ? 500 : 100 },
        category('Decor', 900),
      ],
    }),
  );
  const [currentInput, setInput] = useState({ ...input, guestCount: 10, totalBudget: 1000 });
  return (
    <DashboardPanel
      tab="budget"
      plan={currentPlan}
      input={currentInput}
      onUpdatePlan={(next, total, guests) => {
        setPlan(next);
        setInput((previous) => ({
          ...previous,
          totalBudget: total ?? previous.totalBudget,
          guestCount: guests ?? previous.guestCount,
        }));
      }}
    />
  );
}

it('preserves manual catering costs through guest edits and still recomputes explicit per-plate edits', () => {
  render(<ConnectedBudget customActual />);
  expect(screen.getByLabelText('Per-plate cost (₹)')).toHaveValue(50);
  fireEvent.change(screen.getByLabelText('Guest count'), { target: { value: '20' } });
  expect(screen.getByLabelText('Actual spend for Food')).toHaveValue('₹1,000');
  expect(screen.getByText(/Catering required:/)).toHaveTextContent('Catering required: ₹1,000');
  expect(screen.getByLabelText('Total budget (₹)')).toHaveValue(1000);
  fireEvent.change(screen.getByLabelText('Per-plate cost (₹)'), { target: { value: '30' } });
  expect(screen.getByLabelText('Actual spend for Food')).toHaveValue('₹600');
  fireEvent.change(screen.getByLabelText('Guest count'), { target: { value: '10' } });
  expect(screen.getByLabelText('Actual spend for Food')).toHaveValue('₹300');
});

it.each([10, 20, 30])(
  'cuts a balanced budget by %s%% without a false over-budget warning',
  async (percent) => {
    const user = userEvent.setup();
    render(<ConnectedBudget />);
    await user.click(screen.getByRole('button', { name: `Cut ${percent}%` }));
    expect(screen.getByLabelText('Total budget (₹)')).toHaveValue(1000 * (1 - percent / 100));
    expect(screen.getByLabelText('Actual spend for Food')).toHaveValue(`₹${100 - percent}`);
    expect(screen.queryByText(/Over Budget Warning/)).not.toBeInTheDocument();
  },
);

it('disables impossible strategies and explanation while showing the outstanding amount', async () => {
  const user = userEvent.setup();
  const update = vi.fn();
  render(
    <TradeoffSuggestions
      totalBudget={100}
      onUpdate={update}
      plan={plan({ budget: [{ ...category('Venue', 200), locked: true }, category('Food', 100)] })}
    />,
  );
  const uniform = screen.getByRole('button', {
    name: /Scale adjustable.*Uncovered shortfall: ₹100/,
  });
  expect(uniform).toBeDisabled();
  expect(
    screen.getByRole('button', { name: /Trim décor.*Uncovered shortfall: ₹200/ }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: /Rebalance.*Uncovered shortfall: ₹100/ }),
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Explain these options' })).toBeDisabled();
  await user.click(uniform);
  expect(update).not.toHaveBeenCalled();
});

it('invalidates accepted prices from manual actual input and keeps the replacement vendor price in sync', () => {
  const update = vi.fn();
  const accepted = acceptQuotation(plan(), vendor.id, { ...quote, pricePerPlate: 5 }, 10);
  const currentInput = { ...input, guestCount: 10 };
  const { rerender } = render(
    <DashboardPanel tab="budget" input={currentInput} plan={accepted} onUpdatePlan={update} />,
  );
  fireEvent.change(screen.getByLabelText('Actual spend for Food'), { target: { value: '80' } });
  const edited = update.mock.calls[0]?.[0] as typeof accepted;
  expect(edited.vendors[0]).toMatchObject({ quotedAmount: 80, acceptedQuoteId: undefined });
  expect(edited.vendors[0]?.quotes).toEqual(accepted.vendors[0]?.quotes);
  rerender(
    <DashboardPanel tab="budget" input={currentInput} plan={edited} onUpdatePlan={update} />,
  );
  fireEvent.change(screen.getByLabelText('Guest count'), { target: { value: '20' } });
  const increased = update.mock.lastCall?.[0] as typeof accepted;
  expect(increased.budget[0]?.actual).toBe(160);
  expect(increased.vendors[0]?.quotedAmount).toBe(160);
  rerender(
    <DashboardPanel tab="budget" input={currentInput} plan={accepted} onUpdatePlan={update} />,
  );
  fireEvent.change(screen.getByLabelText('Per-plate cost (₹)'), { target: { value: '0' } });
  const zero = update.mock.lastCall?.[0] as typeof accepted;
  expect(zero.budget[0]).toMatchObject({ actual: 0, verified: false });
  expect(zero.vendors[0]).toMatchObject({ quotedAmount: 0, acceptedQuoteId: undefined });
});

it('applies tradeoffs to represented vendor prices while preserving the declared target', async () => {
  const user = userEvent.setup();
  const update = vi.fn();
  render(
    <TradeoffSuggestions
      totalBudget={100}
      onUpdate={update}
      plan={plan({
        budget: [{ ...category('Food'), actual: 200 }],
        vendors: [{ ...vendor, quotedAmount: 200, status: 'quoted' }],
      })}
    />,
  );
  await user.click(screen.getByRole('button', { name: /Scale adjustable/ }));
  const updated = update.mock.calls[0]?.[0] as ReturnType<typeof plan>;
  expect(updated.budget[0]?.actual).toBe(100);
  expect(updated.vendors[0]?.quotedAmount).toBe(100);
  expect(update.mock.calls[0]).toHaveLength(1);
});
