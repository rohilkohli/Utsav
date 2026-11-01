// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { TradeoffSuggestions } from '../components/dashboard/TradeoffSuggestions';
import { VendorPlaceSearch } from '../components/dashboard/VendorPlaceSearch';
import { QuoteComparison } from '../components/dashboard/QuoteComparison';
import { apiExplainTradeoffs } from '../lib/api';
import { category, plan, quote, vendor } from '../../shared/__tests__/fixtures';
vi.mock('../lib/api', async (original) => ({
  ...(await original<typeof import('../lib/api')>()),
  apiExplainTradeoffs: vi.fn(),
}));
it('explains exact tradeoff facts and applies the selected reduction', async () => {
  const user = userEvent.setup();
  const update = vi.fn();
  vi.mocked(apiExplainTradeoffs).mockResolvedValue({
    explanation: 'Reduce discretionary spending by ₹100.',
    source: 'fallback',
  });
  render(
    <TradeoffSuggestions
      plan={plan({ budget: [{ ...category('Decor'), actual: 200 }] })}
      totalBudget={100}
      onUpdate={update}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Explain these options' }));
  expect(await screen.findByText('Reduce discretionary spending by ₹100.')).toBeVisible();
  expect(apiExplainTradeoffs).toHaveBeenCalledWith(
    100,
    expect.arrayContaining([expect.objectContaining({ savings: expect.any(Number) as unknown })]),
    expect.anything(),
  );
  await user.click(screen.getByRole('button', { name: /Trim décor/ }));
  expect(update).toHaveBeenCalledOnce();
});
it('recovers from Places clipboard refusal and lets a family link a verified business', async () => {
  const user = userEvent.setup();
  const write = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: write },
    configurable: true,
  });
  const onLink = vi.fn();
  const business = {
    name: 'Asha Caterer',
    phone: '+91 12345',
    address: 'Mumbai',
    rating: 4.5,
    mapsUrl: 'https://maps.google.com',
    website: 'https://example.com',
  };
  render(<VendorPlaceSearch suggestions={[business]} onLink={onLink} />);
  await user.click(screen.getByRole('button', { name: 'Copy phone' }));
  expect(await screen.findByText('Phone copied.')).toBeVisible();
  expect(write).toHaveBeenCalledWith('+91 12345');
  write.mockRejectedValue(new Error('denied'));
  await user.click(screen.getByRole('button', { name: 'Copy phone' }));
  expect(await screen.findByText(/Copy unavailable/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Use This Vendor' }));
  expect(onLink).toHaveBeenCalledWith(business);
});
it('removes an unaccepted quote without changing the retained vendor commitment', async () => {
  const user = userEvent.setup();
  const remove = vi.fn();
  render(<QuoteComparison vendor={{ ...vendor, quotes: [quote] }} onRemove={remove} />);
  await user.click(screen.getByRole('button', { name: 'Remove quotation from Asha' }));
  expect(remove).toHaveBeenCalledWith(quote.id);
});
