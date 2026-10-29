import { describe, it, expect } from 'vitest';
import { suggestTradeoffs } from '../tradeoffs.js';
import type { BudgetCategory } from '../schemas.js';

const BASE_CATEGORIES: BudgetCategory[] = [
  { id: '1', category: 'Catering', suggestedPercent: 40, amount: 200_000, actual: 230_000 },
  { id: '2', category: 'Decoration', suggestedPercent: 20, amount: 100_000, actual: 120_000 },
  { id: '3', category: 'Photography', suggestedPercent: 15, amount: 75_000, actual: 80_000 },
  { id: '4', category: 'Return Gifts', suggestedPercent: 10, amount: 50_000, actual: 55_000 },
  { id: '5', category: 'Venue', suggestedPercent: 15, amount: 75_000, actual: 75_000 },
];

const TOTAL = 500_000;
const OVER_BY = BASE_CATEGORIES.reduce((s, c) => s + c.actual, 0) - TOTAL; // 60_000

describe('suggestTradeoffs', () => {
  it('returns empty array when not over budget', () => {
    expect(suggestTradeoffs(BASE_CATEGORIES, TOTAL, 0)).toHaveLength(0);
    expect(suggestTradeoffs(BASE_CATEGORIES, TOTAL, -1000)).toHaveLength(0);
  });

  it('returns exactly 3 options when over budget', () => {
    const options = suggestTradeoffs(BASE_CATEGORIES, TOTAL, OVER_BY);
    expect(options).toHaveLength(3);
  });

  it('every option has a positive savings amount', () => {
    const options = suggestTradeoffs(BASE_CATEGORIES, TOTAL, OVER_BY);
    for (const opt of options) {
      expect(opt.savings).toBeGreaterThan(0);
    }
  });

  it('uniform-cut option reduces total', () => {
    const options = suggestTradeoffs(BASE_CATEGORIES, TOTAL, OVER_BY);
    const uniformCut = options.find((o) => o.id === 'uniform-cut');
    expect(uniformCut).toBeDefined();
    expect(uniformCut!.newTotal).toBeLessThan(TOTAL);
  });

  it('flex-cut option targets decoration/photography/return gifts', () => {
    const options = suggestTradeoffs(BASE_CATEGORIES, TOTAL, OVER_BY);
    const flexCut = options.find((o) => o.id === 'flex-cut');
    expect(flexCut).toBeDefined();
    // Catering (essential) should not be cut
    const cateringBefore = BASE_CATEGORIES.find((c) => c.id === '1')!.actual;
    const cateringAfter = flexCut!.updatedCategories.find((c) => c.id === '1')!.actual;
    expect(cateringAfter).toBe(cateringBefore);
  });

  it('third option addresses over-budget situation', () => {
    const options = suggestTradeoffs(BASE_CATEGORIES, TOTAL, OVER_BY);
    // Third option is either 'rebalance' (when under-spent cats exist) or 'smart-cut' fallback
    const thirdOpt = options[2];
    expect(thirdOpt).toBeDefined();
    expect(thirdOpt.updatedCategories).toHaveLength(BASE_CATEGORIES.length);
    expect(thirdOpt.savings).toBeGreaterThan(0);
  });

  it('rebalance option appears when both over-spent and under-spent categories exist', () => {
    const mixedCats: BudgetCategory[] = [
      { id: '1', category: 'Catering', suggestedPercent: 50, amount: 250_000, actual: 230_000 },
      { id: '2', category: 'Decoration', suggestedPercent: 30, amount: 150_000, actual: 200_000 },
      { id: '3', category: 'Venue', suggestedPercent: 20, amount: 100_000, actual: 90_000 },
    ];
    const opts = suggestTradeoffs(mixedCats, 500_000, 20_000);
    const rebalance = opts.find((o) => o.id === 'rebalance');
    expect(rebalance).toBeDefined();
    expect(rebalance!.updatedCategories).toHaveLength(3);
  });

  it('each option has an id, label, description and updatedCategories', () => {
    const options = suggestTradeoffs(BASE_CATEGORIES, TOTAL, OVER_BY);
    for (const opt of options) {
      expect(opt.id).toBeTruthy();
      expect(opt.label.length).toBeGreaterThan(5);
      expect(opt.description.length).toBeGreaterThan(10);
      expect(opt.updatedCategories).toHaveLength(BASE_CATEGORIES.length);
    }
  });

  it('handles single-category budget gracefully', () => {
    const single: BudgetCategory[] = [
      { id: 'a', category: 'Catering', suggestedPercent: 100, amount: 10_000, actual: 12_000 },
    ];
    const opts = suggestTradeoffs(single, 10_000, 2_000);
    expect(opts.length).toBeGreaterThan(0);
  });
});
