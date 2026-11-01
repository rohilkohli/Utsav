import { expect, it } from 'vitest';
import { requireValue } from '../invariants.js';
import { matchVendorBudgetCategory } from '../vendorMatching.js';
import { resizeBudget, scaleGuests, groupCategoriesBySubEvent } from '../budget.js';
import { acceptQuotation } from '../quotes.js';
import { buildSchedule } from '../timeline.js';
import { planInsights } from '../insights.js';
import { category, input, plan, quote, task, today, vendor } from './fixtures.js';

it('rejects missing internal graph values instead of silently inventing data', () => {
  expect(() => {
    requireValue(undefined);
  }).toThrow('Internal invariant');
  expect(requireValue(0)).toBe(0);
});
it('resolves explicit, ceremony, semantic and substring matches with stable ties', () => {
  const categories = [
    { ...category('fixed'), category: 'Photography', subEvent: 'Sangeet' },
    { ...category('general'), category: 'Photography', subEvent: 'General' },
    { ...category('other'), category: 'Photography', subEvent: 'Haldi' },
    { ...category('buffer'), category: 'Contingency Buffer' },
  ];
  const current = plan({ budget: categories });
  expect(matchVendorBudgetCategory(current, { ...vendor, budgetCategoryId: 'fixed' })?.id).toBe(
    'fixed',
  );
  expect(
    matchVendorBudgetCategory(current, { ...vendor, category: 'Photography', subEvent: 'Sangeet' })
      ?.id,
  ).toBe('fixed');
  expect(
    matchVendorBudgetCategory(current, {
      ...vendor,
      category: 'Photography extra',
      subEvent: 'Mehendi',
    })?.id,
  ).toBe('general');
  expect(
    matchVendorBudgetCategory(current, { ...vendor, category: 'Photographer', subEvent: 'Mehendi' })
      ?.id,
  ).toBe('general');
  expect(
    matchVendorBudgetCategory(plan({ budget: [category('First'), category('Second')] }), {
      ...vendor,
      category: 'No match',
    }),
  ).toBeUndefined();
  expect(
    matchVendorBudgetCategory(
      plan({
        budget: [
          { ...category('a'), category: 'Food' },
          { ...category('b'), category: 'Food' },
        ],
      }),
      vendor,
    )?.id,
  ).toBe('a');
});
it('resizes zero pools and immutable commitments without losing exact totals', () => {
  expect(resizeBudget([{ ...category('fixed'), locked: true }], 0).newTotal).toBe(100);
  expect(
    resizeBudget([{ ...category('empty', 0), suggestedPercent: 100 }], 100).updatedCategories[0]
      ?.amount,
  ).toBe(100);
  expect(resizeBudget([category('empty', 0)], 0).updatedCategories[0]?.suggestedPercent).toBe(0);
  expect(
    resizeBudget([{ ...category('paid'), verified: true }], 50).updatedCategories[0]?.actual,
  ).toBe(100);
});
it('preserves accepted catering quote rates when zero per-plate override is supplied', () => {
  const accepted = acceptQuotation(
    plan(),
    vendor.id,
    { ...quote, pricePerPlate: 5, guestMinimum: 20 },
    10,
  );
  expect(scaleGuests(accepted, 10, 0).requiredCatering).toBe(100);
});
it('schedules default-duration dependencies and distinguishes explicit unquantified delay flags', () => {
  const parent = { ...task('parent', 20), durationDays: undefined };
  const child = { ...task('child', 19, ['parent']), durationDays: undefined };
  const schedule = buildSchedule([parent, child], input.eventDate, today);
  expect(schedule[1]?.effectiveDate).toBe('2030-01-15');
  const insights = planInsights(
    plan({ timeline: [{ ...task('delayed'), status: 'delayed', delayDays: undefined }] }),
    input,
    today,
  );
  expect(insights.some((insight) => insight.id === 'timeline-delay')).toBe(false);
});

it('groups multiple categories from the same ceremony without replacing prior entries', () => {
  expect(
    groupCategoriesBySubEvent([
      { ...category('a'), subEvent: 'Haldi' },
      { ...category('b'), subEvent: 'Haldi' },
    ]).Haldi,
  ).toHaveLength(2);
});
