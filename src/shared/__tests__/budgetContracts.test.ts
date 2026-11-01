import { describe, expect, it } from 'vitest';
import {
  allocateAmountsByLargestRemainder,
  calculateBudgetTotals,
  redistributeCategoryAmount,
  scaleGuestCount,
  scaleGuests,
  updateBudgetCategories,
} from '../budget.js';
import { acceptQuotation } from '../quotes.js';
import { suggestTradeoffs } from '../tradeoffs.js';
import { category, plan, quote, vendor } from './fixtures.js';

describe('audited budget contracts', () => {
  it('keeps the target intact and uniform rounding exact without an artificial 2% reduction', () => {
    const categories = [category('Food', 500), category('Decor', 301), category('Venue', 201)];
    const options = suggestTradeoffs(categories, 901, 101);
    const uniform = options.find((option) => option.id === 'uniform-cut');
    expect(uniform?.newTotal).toBe(901);
    expect(uniform?.newTotalActual).toBe(901);
    expect(uniform?.savings).toBe(101);
    expect(uniform?.updatedCategories.map((entry) => entry.actual)).toEqual(
      allocateAmountsByLargestRemainder(
        categories.map((entry) => ({ suggestedPercent: entry.actual })),
        901,
      ),
    );
    expect(categories.map((entry) => entry.actual)).toEqual([500, 301, 201]);
  });

  it('caps each discretionary cut at 40% and exposes the precise impossible residual', () => {
    const categories = [
      category('Food', 1000),
      category('Decoration', 101),
      category('Photography', 100),
      { ...category('Entertainment', 500), locked: true },
      { ...category('Return Gifts', 500), verified: true },
      category('Venue Decoration', 100),
    ];
    const flex = suggestTradeoffs(categories, 2100, 201).find((option) => option.id === 'flex-cut');
    expect(flex).toMatchObject({
      newTotal: 2100,
      newTotalActual: 2221,
      savings: 80,
      feasible: false,
      uncoveredShortfall: 121,
    });
    expect(flex?.updatedCategories.map((entry) => entry.actual)).toEqual([
      1000, 61, 60, 500, 500, 100,
    ]);
    const feasible = suggestTradeoffs(categories, 2250, 51).find(
      (option) => option.id === 'flex-cut',
    );
    expect(feasible).toMatchObject({ newTotalActual: 2250, savings: 51, feasible: true });
    expect(suggestTradeoffs(categories, 3000, 10)).toEqual([]);
  });

  it('resets overspent discretionary costs before trimming the residual and protects commitments', () => {
    const categories = [
      { ...category('Food', 100), actual: 180 },
      { ...category('Decor', 100), actual: 200 },
      { ...category('Venue', 100), actual: 150, verified: true },
    ];
    const rebalance = suggestTradeoffs(categories, 400, 130)[2];
    expect(rebalance).toMatchObject({
      newTotal: 400,
      newTotalActual: 400,
      savings: 130,
      feasible: true,
      uncoveredShortfall: 0,
    });
    expect(rebalance?.updatedCategories.map((entry) => entry.actual)).toEqual([161, 89, 150]);
    expect(calculateBudgetTotals(rebalance?.updatedCategories ?? [], 400).isOverBudget).toBe(false);
  });

  it('supports explicit-total redistribution while keeping custom actuals and locked peers intact', () => {
    const initial = [
      { ...category('Food', 50), actual: 500 },
      category('Decor', 30),
      { ...category('Venue', 20), locked: true },
    ];
    const result = redistributeCategoryAmount(initial, 'Food', 100, 200);
    expect(result.map((entry) => entry.amount)).toEqual([100, 80, 20]);
    expect(result[0]?.actual).toBe(500);
    expect(result[2]?.locked).toBe(true);
  });
});

describe('guest edits preserve actual spending and accepted contract terms', () => {
  it('scales manual actuals rather than allocations and handles zero or fractional guest counts', () => {
    const initial = plan({ budget: [{ ...category('Food'), actual: 500 }, category('Decor')] });
    const result = scaleGuestCount(initial, 10, 20);
    expect(result).toMatchObject({ requiredCatering: 1000, budgetedCatering: 100, shortfall: 900 });
    expect(result.plan.budget.map((entry) => entry.actual)).toEqual([1000, 100]);
    expect(scaleGuestCount(initial, 0, 2.2).requiredCatering).toBe(1000);
    expect(scaleGuestCount(initial, 10, -1).requiredCatering).toBe(0);
    expect(scaleGuestCount(plan({ budget: [] }), 10, 20).requiredCatering).toBe(0);
  });

  it('synchronizes represented manual prices on guest and rate edits while preserving unrelated vendor estimates', () => {
    const initial = plan({
      budget: [{ ...category('Food'), actual: 140 }],
      vendors: [
        { ...vendor, status: 'quoted', quotedAmount: 140 },
        { ...vendor, id: 'unrelated', quotedAmount: 50 },
        { ...vendor, id: 'estimate', quotedAmount: 0 },
      ],
    });
    const increased = scaleGuestCount(initial, 10, 20).plan;
    expect(increased.budget[0]?.actual).toBe(280);
    expect(increased.vendors.map((entry) => entry.quotedAmount)).toEqual([280, 50, 0]);
    const rateEdited = scaleGuests(initial, 10, 20).plan;
    expect(rateEdited.budget[0]?.actual).toBe(200);
    expect(rateEdited.vendors.map((entry) => entry.quotedAmount)).toEqual([200, 50, 0]);
  });

  it('honors accepted per-plate minimums and synchronizes vendor spending without changing quote history', () => {
    const accepted = acceptQuotation(
      plan(),
      vendor.id,
      { ...quote, pricePerPlate: 5, guestMinimum: 20 },
      10,
    );
    const belowMinimum = scaleGuestCount(accepted, 10, 15);
    expect(belowMinimum.requiredCatering).toBe(100);
    const increased = scaleGuestCount(belowMinimum.plan, 15, 30);
    expect(increased.requiredCatering).toBe(150);
    expect(increased.plan.vendors[0]).toMatchObject({
      quotedAmount: 150,
      acceptedQuoteId: quote.id,
    });
    expect(increased.plan.vendors[0]?.quotes).toEqual(accepted.vendors[0]?.quotes);
    const noMinimum = acceptQuotation(plan(), vendor.id, { ...quote, pricePerPlate: 5 }, 0);
    expect(scaleGuestCount(noMinimum, 0, 10).requiredCatering).toBe(50);
    expect(scaleGuestCount(scaleGuestCount(noMinimum, 0, 10).plan, 10, 20).requiredCatering).toBe(
      100,
    );
  });

  it('keeps fixed total and flat accepted quotations stable as guests or the editable rate change', () => {
    for (const acceptedQuote of [{ ...quote, totalPrice: 90, pricePerPlate: 5 }, quote]) {
      const accepted = acceptQuotation(plan(), vendor.id, acceptedQuote, 10);
      expect(scaleGuestCount(accepted, 10, 20).requiredCatering).toBe(accepted.budget[0]?.actual);
      const result = scaleGuests(accepted, 20, 7);
      expect(result.requiredCatering).toBe(accepted.budget[0]?.actual);
      expect(result.plan.vendors[0]?.acceptedQuoteId).toBe(quote.id);
      expect(result.plan.budget[0]?.verified).toBe(true);
    }
  });

  it('clears stale acceptance only when a per-plate rate is manually overridden', () => {
    const accepted = acceptQuotation(
      plan({
        budget: [category('Food'), category('Decor')],
        vendors: [vendor, { ...vendor, id: 'decor', category: 'Decor' }],
      }),
      vendor.id,
      { ...quote, pricePerPlate: 5 },
      10,
    );
    const retained = scaleGuests(accepted, 20, 5);
    expect(retained.plan.vendors[0]?.acceptedQuoteId).toBe(quote.id);
    const overridden = scaleGuests(accepted, 20, 7);
    expect(overridden.requiredCatering).toBe(140);
    expect(overridden.plan.budget[0]).toMatchObject({ actual: 140, verified: false });
    expect(overridden.plan.vendors[0]).toMatchObject({
      quotedAmount: 140,
      status: 'quoted',
      acceptedQuoteId: undefined,
    });
    expect(overridden.plan.vendors[0]?.quotes).toEqual(accepted.vendors[0]?.quotes);
    expect(scaleGuestCount(overridden.plan, 20, 30).requiredCatering).toBe(210);
    expect(scaleGuests(plan({ vendors: [] }), 10).requiredCatering).toBe(0);
    const unmatched = plan({
      budget: [],
      vendors: [{ ...vendor, quotes: [quote], acceptedQuoteId: quote.id }],
    });
    expect(scaleGuests(unmatched, 10, 5).requiredCatering).toBe(0);
  });
});

describe('budget and vendor synchronization', () => {
  it('invalidates acceptance on manual actual edits, keeps saved quotes, and scales the replacement price', () => {
    const accepted = acceptQuotation(plan(), vendor.id, { ...quote, pricePerPlate: 5 }, 10);
    const budget = accepted.budget.map((entry) => ({ ...entry, actual: 80, verified: false }));
    const edited = updateBudgetCategories(accepted, budget, true);
    expect(edited.vendors[0]).toMatchObject({
      quotedAmount: 80,
      acceptedQuoteId: undefined,
      status: 'quoted',
    });
    expect(edited.vendors[0]?.quotes).toEqual(accepted.vendors[0]?.quotes);
    const increased = scaleGuestCount(edited, 10, 20).plan;
    expect(increased.budget[0]?.actual).toBe(160);
    expect(increased.vendors[0]?.quotedAmount).toBe(160);
    const zero = updateBudgetCategories(edited, [{ ...category('Food'), actual: 0 }], true);
    expect(zero.vendors[0]).toMatchObject({ quotedAmount: 0, status: 'to-contact' });
  });

  it('updates allocation comparisons without replacing committed prices or inventing unrelated quotes', () => {
    const initial = plan({ vendors: [vendor, { ...vendor, id: 'none', category: 'Venue' }] });
    const resized = updateBudgetCategories(
      initial,
      [{ ...category('Food', 200), actual: 200 }],
      true,
    );
    expect(resized.vendors[0]).toMatchObject({ budgetedAmount: 200, quotedAmount: 0 });
    expect(resized.vendors[1]).toEqual(initial.vendors[1]);
    const verified = updateBudgetCategories(
      plan({ vendors: [{ ...vendor, quotedAmount: 100 }] }),
      [{ ...category('Food'), actual: 120, verified: true }],
      true,
    );
    expect(verified.vendors[0]?.quotedAmount).toBe(120);
    const newlyMatched = updateBudgetCategories(plan({ budget: [] }), [category('Food')], true);
    expect(newlyMatched.vendors[0]).toMatchObject({ budgetedAmount: 100, quotedAmount: 0 });
    expect(updateBudgetCategories(initial, initial.budget, true).vendors).toEqual(initial.vendors);
  });
});
