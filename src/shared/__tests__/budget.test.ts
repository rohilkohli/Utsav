import { describe, it, expect } from 'vitest';
import {
  allocateAmountsByLargestRemainder,
  populateCategoryAmounts,
  calculateBudgetTotals,
  applyBudgetCut,
  groupCategoriesBySubEvent,
} from '../budget.js';

describe('Budget Math - Deterministic Allocation', () => {
  it('allocates amounts such that sum equals EXACTLY the total budget (Largest-Remainder)', () => {
    const items = [
      { suggestedPercent: 33.33 },
      { suggestedPercent: 33.33 },
      { suggestedPercent: 33.34 },
    ];
    const totalBudget = 100_000;
    const amounts = allocateAmountsByLargestRemainder(items, totalBudget);
    const sum = amounts.reduce((a, b) => a + b, 0);

    expect(sum).toBe(totalBudget);
    // Integer amounts check
    amounts.forEach((amt) => {
      expect(Number.isInteger(amt)).toBe(true);
    });
  });

  it('handles zero budget safely', () => {
    const items = [{ suggestedPercent: 50 }, { suggestedPercent: 50 }];
    const amounts = allocateAmountsByLargestRemainder(items, 0);
    expect(amounts).toEqual([0, 0]);
  });

  it('handles empty items array', () => {
    const amounts = allocateAmountsByLargestRemainder([], 100_000);
    expect(amounts).toEqual([]);
  });

  it('handles massive budget (₹100 Crore) with no floating drift', () => {
    const items = [
      { suggestedPercent: 40 },
      { suggestedPercent: 30 },
      { suggestedPercent: 20 },
      { suggestedPercent: 10 },
    ];
    const hugeBudget = 1_000_000_000; // 100 Cr
    const amounts = allocateAmountsByLargestRemainder(items, hugeBudget);
    const sum = amounts.reduce((a, b) => a + b, 0);
    expect(sum).toBe(hugeBudget);
    expect(amounts[0]).toBe(400_000_000);
  });

  it('populates category amounts and computes actuals', () => {
    const categories = [
      { id: '1', category: 'Venue', suggestedPercent: 50, subEvent: 'Haldi' },
      { id: '2', category: 'Catering', suggestedPercent: 50, subEvent: 'Haldi' },
    ];
    const result = populateCategoryAmounts(categories, 200_000);
    expect(result.length).toBe(2);
    expect(result[0].amount).toBe(100_000);
    expect(result[0].actual).toBe(100_000);
    expect(result[0].subEvent).toBe('Haldi');
  });

  it('calculates totals and over-budget status accurately', () => {
    const categories = [
      { id: '1', category: 'Venue', suggestedPercent: 50, amount: 50_000, actual: 60_000 },
      { id: '2', category: 'Food', suggestedPercent: 50, amount: 50_000, actual: 45_000 },
    ];
    const totals = calculateBudgetTotals(categories, 100_000);

    expect(totals.totalBudgeted).toBe(100_000);
    expect(totals.totalActual).toBe(105_000);
    expect(totals.isOverBudget).toBe(true);
    expect(totals.overBudgetAmount).toBe(5_000);
    expect(totals.underBudgetAmount).toBe(0);
  });

  it('calculates under-budget status accurately', () => {
    const categories = [
      { id: '1', category: 'Venue', suggestedPercent: 50, amount: 50_000, actual: 40_000 },
      { id: '2', category: 'Food', suggestedPercent: 50, amount: 50_000, actual: 40_000 },
    ];
    const totals = calculateBudgetTotals(categories, 100_000);

    expect(totals.totalActual).toBe(80_000);
    expect(totals.isOverBudget).toBe(false);
    expect(totals.underBudgetAmount).toBe(20_000);
  });

  it('applies deterministic budget cut (e.g. 20%) without LLM call', () => {
    const categories = [
      { id: '1', category: 'Venue', suggestedPercent: 60, amount: 60_000, actual: 60_000 },
      { id: '2', category: 'Food', suggestedPercent: 40, amount: 40_000, actual: 40_000 },
    ];
    const currentTotal = 100_000;
    const { newTotal, updatedCategories } = applyBudgetCut(categories, currentTotal, 20);

    expect(newTotal).toBe(80_000);
    const sum = updatedCategories.reduce((acc, c) => acc + c.amount, 0);
    expect(sum).toBe(80_000);
  });

  it('allocates single item — full budget goes to it', () => {
    const amounts = allocateAmountsByLargestRemainder([{ suggestedPercent: 100 }], 75_000);
    expect(amounts).toEqual([75_000]);
  });

  it('allocates zero percent items as zero', () => {
    const items = [{ suggestedPercent: 0 }, { suggestedPercent: 0 }];
    const amounts = allocateAmountsByLargestRemainder(items, 100_000);
    const sum = amounts.reduce((a, b) => a + b, 0);
    expect(sum).toBe(100_000);
  });

  it('handles 10-category wedding budget summing exactly to budget', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ suggestedPercent: 10 }));
    const budget = 357_891;
    const amounts = allocateAmountsByLargestRemainder(items, budget);
    const sum = amounts.reduce((a, b) => a + b, 0);
    expect(sum).toBe(budget);
    amounts.forEach((a) => expect(Number.isInteger(a)).toBe(true));
  });

  it('applyBudgetCut preserves integer amounts after cut', () => {
    const categories = [
      { id: '1', category: 'Venue', suggestedPercent: 60, amount: 60_000, actual: 60_000 },
      { id: '2', category: 'Catering', suggestedPercent: 40, amount: 40_000, actual: 40_000 },
    ];
    const { updatedCategories } = applyBudgetCut(categories, 100_000, 15);
    updatedCategories.forEach((c) => expect(Number.isInteger(c.amount)).toBe(true));
  });

  it('calculateBudgetTotals with zero actuals reports zero actual and under-budget', () => {
    const cats = [
      { id: '1', category: 'X', suggestedPercent: 100, amount: 50_000, actual: 0 },
    ];
    const totals = calculateBudgetTotals(cats, 50_000);
    expect(totals.totalActual).toBe(0);
    expect(totals.isOverBudget).toBe(false);
    expect(totals.underBudgetAmount).toBe(50_000);
  });

  it('groups categories correctly by subEvent', () => {
    const categories = [
      {
        id: '1',
        category: 'Haldi Stage',
        suggestedPercent: 30,
        amount: 30,
        actual: 30,
        subEvent: 'Haldi',
      },
      {
        id: '2',
        category: 'DJ & Sound',
        suggestedPercent: 40,
        amount: 40,
        actual: 40,
        subEvent: 'Sangeet',
      },
      { id: '3', category: 'Priest Dakshina', suggestedPercent: 30, amount: 30, actual: 30 },
    ];
    const grouped = groupCategoriesBySubEvent(categories);
    expect(grouped['Haldi']?.length).toBe(1);
    expect(grouped['Sangeet']?.length).toBe(1);
    expect(grouped['General']?.length).toBe(1);
  });
});
