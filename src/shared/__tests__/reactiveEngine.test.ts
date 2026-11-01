import { describe, expect, it } from 'vitest';
import {
  allocateAmountsByLargestRemainder,
  ensureContingencyCategory,
  populateCategoryAmounts,
  redistribute,
  scaleGuests,
  applyBudgetCut,
  groupCategoriesBySubEvent,
} from '../budget.js';
import {
  acceptQuotation,
  compareQuote,
  effectiveCost,
  inquiryDraft,
  missingFields,
  riskFlags,
  quoteSchema,
  extractQuoteRequestSchema,
  extractQuoteResponseSchema,
} from '../quotes.js';
import { suggestTradeoffs } from '../tradeoffs.js';
import { category, plan, quote, vendor } from './fixtures.js';

describe('reactive budgets', () => {
  it('clamps negative inputs and rejects nonfinite arithmetic', () => {
    expect(
      allocateAmountsByLargestRemainder([{ suggestedPercent: -5 }, { suggestedPercent: 5 }], 3.2),
    ).toEqual([0, 3]);
    expect(() => allocateAmountsByLargestRemainder([], Infinity)).toThrow('finite');
    expect(() => allocateAmountsByLargestRemainder([{ suggestedPercent: NaN }], 10)).toThrow(
      'finite',
    );
    expect(allocateAmountsByLargestRemainder([{ suggestedPercent: 5 }], -1)).toEqual([0]);
  });
  it('normalizes contingency before priority weighting without reducing the reserve', () => {
    const initial = [category('Food'), category('Decor')];
    const reserve = ensureContingencyCategory(initial);
    expect(ensureContingencyCategory(reserve)).toBe(reserve);
    const weighted = populateCategoryAmounts(reserve, 100000, ['Decor']);
    expect(weighted.find((entry) => entry.category === 'Contingency Buffer')?.amount).toBe(10000);
    expect(weighted.find((entry) => entry.id === 'Decor')?.amount).toBe(50000);
    expect(weighted.find((entry) => entry.id === 'Food')?.amount).toBe(40000);
    expect(populateCategoryAmounts([], 100)).toEqual([]);
    expect(
      populateCategoryAmounts([{ ...category('zero'), suggestedPercent: 0 }], 7)[0]?.amount,
    ).toBe(7);
    expect(
      ensureContingencyCategory([{ ...category('zero'), suggestedPercent: 0 }])[0]
        ?.suggestedPercent,
    ).toBe(90);
    expect(ensureContingencyCategory([])).toHaveLength(1);
  });
  it('conserves every rupee over repeated slider movements, locks and empty peers', () => {
    const initial = [
      category('Food', 33),
      category('Decor', 34),
      { ...category('Venue', 33), locked: true },
    ];
    for (let amount = -20; amount < 200; amount++) {
      const result = redistribute(initial, 'Food', amount);
      expect(result.categories.reduce((sum, entry) => sum + entry.amount, 0)).toBe(100);
      expect(result.changes.reduce((sum, entry) => sum + entry.delta, 0)).toBe(0);
      expect(result.categories.every((entry) => entry.amount >= 0)).toBe(true);
      expect(result.categories.find((entry) => entry.id === 'Venue')?.amount).toBe(33);
    }
    expect(
      redistribute(initial, 'Food', 1000).categories.find((entry) => entry.id === 'Food')?.amount,
    ).toBe(67);
    expect(redistribute(initial, 'missing', 10).changes).toEqual([]);
    expect(redistribute(initial, 'Venue', 10).changes).toEqual([]);
    expect(redistribute([category('only')], 'only', 5).changes).toEqual([]);
    expect(redistribute(initial, 'Food', 33).changes).toEqual([]);
    expect(redistribute([category('a', 0), category('b', 0)], 'a', 0).changes).toEqual([]);
    expect(() => redistribute(initial, 'Food', NaN)).toThrow('finite');
  });
  it('preserves actual commitments and custom actuals during reallocation', () => {
    const initial = [
      { ...category('Food'), actual: 150, verified: true },
      category('Decor'),
      { ...category('Other'), actual: 80 },
    ];
    const result = redistribute(initial, 'Food', 150).categories;
    expect(result.find((entry) => entry.id === 'Food')?.actual).toBe(150);
    expect(result.find((entry) => entry.id === 'Other')?.actual).toBe(80);
    expect(result.find((entry) => entry.id === 'Decor')?.actual).toBe(75);
    const populated = populateCategoryAmounts(initial, 500);
    expect(populated[0]?.verified).toBe(true);
    expect(populated[0]?.actual).toBe(150);
    expect(applyBudgetCut(initial, 100, -5).newTotal).toBe(100);
    expect(applyBudgetCut(initial, 100, 120).newTotal).toBe(0);
    expect(
      groupCategoriesBySubEvent([{ ...category('test'), subEvent: '__proto__' }]).__proto__,
    ).toHaveLength(1);
  });
  it('scales all catering allocations and warns about shortfalls', () => {
    const initial = plan({
      budget: [category('Food', 60), category('Prasad', 40), category('Decor', 10)],
    });
    const result = scaleGuests(initial, 120, 2);
    expect(result.requiredCatering).toBe(240);
    expect(result.shortfall).toBe(140);
    expect(result.plan.budget.map((entry) => entry.actual)).toEqual([144, 96, 10]);
    expect(scaleGuests(plan({ budget: [] }), -1).requiredCatering).toBe(0);
    const accepted = acceptQuotation(
      plan(),
      vendor.id,
      { ...quote, pricePerPlate: 2, guestMinimum: 150 },
      100,
    );
    expect(scaleGuests(accepted, 200).requiredCatering).toBe(400);
    expect(scaleGuests(accepted, 100).requiredCatering).toBe(300);
  });
});

describe('quote decisions', () => {
  it('treats lump sums and plate rates correctly, including a stated zero total', () => {
    expect(effectiveCost(quote, 100)).toBe(120);
    expect(effectiveCost({ ...quote, pricePerPlate: 10 }, 100)).toBe(1000);
    expect(effectiveCost({ ...quote, totalPrice: 0, pricePerPlate: 10 }, 100)).toBe(0);
    expect(riskFlags({ ...quote, quotedAmount: 0, pricePerPlate: 10 }, 100)).toContain(
      'overCategoryBudget',
    );
    expect(compareQuote({ ...quote, quotedAmount: 1, budgetedAmount: 0 }).verdict).toBe(
      'significantly-over',
    );
    expect(compareQuote({ ...quote, quotedAmount: 1101, budgetedAmount: 1000 }).verdict).toBe(
      'over-budget',
    );
    expect(compareQuote({ ...quote, quotedAmount: 1251, budgetedAmount: 1000 }).verdict).toBe(
      'significantly-over',
    );
  });
  it('asks only missing questions and flags accepted terms precisely', () => {
    const complete = {
      ...quote,
      taxIncluded: false,
      cancellationPolicy: 'Refund until 7 days before',
      guestMinimum: 0,
      advancePercent: 50,
    };
    expect(missingFields(complete)).toEqual([]);
    expect(riskFlags({ ...complete, budgetedAmount: 200 }, 100)).toEqual([]);
    expect(inquiryDraft(complete, {})).not.toContain('?');
    expect(inquiryDraft(quote, { familyName: 'Kohli' })).toContain('Kohli');
    expect(missingFields({ ...quote, taxIncluded: null, cancellationPolicy: '' })).toHaveLength(4);
  });
  it('updates vendor and matching ceremony budget atomically and keeps three quote history', () => {
    const original = plan({
      vendors: [
        {
          ...vendor,
          quotes: Array.from({ length: 3 }, (_, index) => ({ ...quote, id: String(index) })),
        },
      ],
    });
    const result = acceptQuotation(
      original,
      vendor.id,
      { ...quote, pricePerPlate: 2, guestMinimum: 150 },
      100,
    );
    expect(result.vendors[0]?.status).toBe('booked');
    expect(result.vendors[0]?.acceptedQuoteId).toBe(quote.id);
    expect(result.vendors[0]?.quotes).toHaveLength(3);
    expect(result.budget[0]).toMatchObject({ actual: 300, verified: true });
    expect(original.budget[0]?.actual).toBe(100);
    expect(() => acceptQuotation(original, 'missing', quote, 100)).toThrow('match');
    expect(() => acceptQuotation(plan({ budget: [] }), vendor.id, quote, 100)).toThrow(
      'matching budget',
    );
    const contained = plan({ budget: [category('Food & Beverages')], vendors: [vendor] });
    expect(acceptQuotation(contained, vendor.id, quote, 100).budget[0]?.actual).toBe(120);
    const reverse = plan({
      budget: [category('Food')],
      vendors: [{ ...vendor, category: 'Food & Beverages' }],
    });
    expect(acceptQuotation(reverse, vendor.id, quote, 100).budget[0]?.verified).toBe(true);
    const nonCatering = plan({
      budget: [category('Decor')],
      vendors: [{ ...vendor, category: 'Decor' }],
    });
    expect(acceptQuotation(nonCatering, vendor.id, quote, 100).perPlate).toBeUndefined();
  });
  it('validates extraction unknown fields as nullable and rejects invented extra fields', () => {
    const extracted = {
      vendorName: null,
      category: null,
      totalPrice: null,
      pricePerPlate: null,
      guestMinimum: null,
      taxIncluded: null,
      advancePercent: null,
      overtimeFee: null,
      cancellationPolicy: null,
    };
    expect(quoteSchema.safeParse(extracted).success).toBe(true);
    expect(quoteSchema.safeParse({ ...extracted, phone: 'invented' }).success).toBe(false);
    expect(extractQuoteRequestSchema.safeParse({ text: ' ' }).success).toBe(false);
    expect(extractQuoteResponseSchema.parse({ quote: extracted, source: 'fallback' }).source).toBe(
      'fallback',
    );
  });
});

describe('tradeoff integrity', () => {
  it('conserves spend, protects accepted quotations and returns within budget when possible', () => {
    const initial = [
      category('Food', 100),
      { ...category('Decor', 100), actual: 200 },
      { ...category('Venue', 100), actual: 150, verified: true },
    ];
    const options = suggestTradeoffs(initial, 350, 100);
    expect(options).toHaveLength(3);
    for (const option of options) {
      expect(option.savings).toBe(450 - option.newTotalActual);
      expect(option.updatedCategories.reduce((sum, entry) => sum + entry.actual, 0)).toBe(
        option.newTotalActual,
      );
      expect(option.newTotal).toBe(350);
      expect(option.feasible).toBe(option.newTotalActual <= 350);
      expect(option.uncoveredShortfall).toBe(Math.max(0, option.newTotalActual - 350));
      expect(option.updatedCategories[2]?.actual).toBe(150);
    }
    expect(
      suggestTradeoffs(
        initial.map((entry) => ({ ...entry, verified: true })),
        350,
        100,
      ),
    ).toEqual([]);
    expect(suggestTradeoffs([], 0, 1)).toEqual([]);
    expect(
      suggestTradeoffs([category('Food', 10)], 0, 10).every((option) => option.newTotal === 0),
    ).toBe(true);
  });
  it('reports the actual residual if commitments exceed the target budget', () => {
    const initial = [{ ...category('Venue', 200), locked: true }, category('Food', 100)];
    for (const option of suggestTradeoffs(initial, 100, 200)) {
      expect(option.newTotal).toBe(100);
      expect(option.newTotalActual).toBeGreaterThanOrEqual(200);
      expect(option.savings).toBe(300 - option.newTotalActual);
      expect(option.uncoveredShortfall).toBe(option.newTotalActual - 100);
      expect(option.feasible).toBe(false);
    }
  });
});
