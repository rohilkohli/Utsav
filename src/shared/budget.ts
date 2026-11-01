import type { BudgetCategory, EventType } from './schemas.js';

export interface BudgetPreset {
  label: string;
  value: number;
}

export const BUDGET_PRESETS: Record<EventType, BudgetPreset[]> = {
  birthday: [
    { label: '₹15,000 (Intimate)', value: 15_000 },
    { label: '₹35,000 (Standard)', value: 35_000 },
    { label: '₹75,000 (Grand)', value: 75_000 },
    { label: '₹1,50,000+ (Luxury)', value: 150_000 },
  ],
  community: [
    { label: '₹50,000 (Small Pandal)', value: 50_000 },
    { label: '₹1,50,000 (Society Mela)', value: 150_000 },
    { label: '₹3,00,000 (City Pandal)', value: 300_000 },
    { label: '₹5,00,000+ (Grand Mahotsav)', value: 500_000 },
  ],
  wedding: [
    { label: '₹5,00,000 (Budget Intimate)', value: 500_000 },
    { label: '₹15,00,000 (Traditional)', value: 1_500_000 },
    { label: '₹30,00,000 (Grand Celebration)', value: 3_000_000 },
    { label: '₹60,00,000+ (Royal Destination)', value: 6_000_000 },
  ],
};

/**
 * Largest-Remainder Method (Hare-Niemeyer method).
 * Distributes totalBudget across categories using percentages such that
 * the sum of rounded integer amounts equals EXACTLY totalBudget (no penny drift).
 *
 * Algorithm:
 * 1. Compute exact rupee share for each category (percent × total).
 * 2. Floor all shares to integers and track remainders.
 * 3. Sort by remainder descending; award 1 extra rupee to top-N categories
 *    until the total discrepancy is resolved.
 *
 * @param items - Array of objects with a `suggestedPercent` field
 * @param totalBudget - Total rupee amount to distribute (must be >= 0)
 * @returns Array of integer rupee amounts in the same order as `items`
 */
export function allocateAmountsByLargestRemainder(
  items: { suggestedPercent: number }[],
  totalBudget: number,
): number[] {
  if (items.length === 0) return [];
  if (totalBudget <= 0) return items.map(() => 0);

  const rawSum = items.reduce((acc, curr) => acc + curr.suggestedPercent, 0);
  // Avoid division by zero: if all percentages are 0, allocate evenly
  const effectivePercents =
    rawSum > 0 ? items.map((i) => i.suggestedPercent / rawSum) : items.map(() => 1 / items.length);

  // Step 1: exact shares and integer floors
  const exactShares = effectivePercents.map((p) => p * totalBudget);
  const integerParts = exactShares.map((s) => Math.floor(s));
  const remainders = exactShares.map((s, idx) => ({
    remainder: s - integerParts[idx],
    index: idx,
  }));

  // Step 2: compute discrepancy
  const allocatedSoFar = integerParts.reduce((a, b) => a + b, 0);
  let discrepancy = Math.round(totalBudget - allocatedSoFar);

  // Step 3: distribute 1 rupee to items with largest remainders
  remainders.sort((a, b) => b.remainder - a.remainder);
  const result = [...integerParts];

  for (let i = 0; i < remainders.length && discrepancy > 0; i++) {
    result[remainders[i].index] += 1;
    discrepancy--;
  }

  return result;
}

/**
 * Normalizes raw categories (re-scaling percentages to sum to 100%) and
 * calculates deterministic integer rupee amounts via the Largest-Remainder method.
 * If all percentages are zero, allocates the budget evenly across all categories.
 *
 * @param categories - Array of category objects with id, category name, suggestedPercent, and optional actual/subEvent
 * @param totalBudget - Total rupee budget to distribute
 * @returns Fully populated BudgetCategory array with normalized percents and exact rupee amounts
 */
export function populateCategoryAmounts(
  categories: Array<{
    id: string;
    category: string;
    suggestedPercent: number;
    actual?: number;
    subEvent?: string;
  }>,
  totalBudget: number,
): BudgetCategory[] {
  const rawSum = categories.reduce((sum, c) => sum + Math.max(0, c.suggestedPercent), 0);
  const normalizedPercents =
    rawSum > 0
      ? categories.map((c) => Number(((Math.max(0, c.suggestedPercent) / rawSum) * 100).toFixed(2)))
      : categories.map(() => Number((100 / Math.max(1, categories.length)).toFixed(2)));

  const amounts = allocateAmountsByLargestRemainder(
    normalizedPercents.map((p) => ({ suggestedPercent: p })),
    totalBudget,
  );

  return categories.map((c, idx) => ({
    id: c.id,
    category: c.category,
    suggestedPercent: normalizedPercents[idx],
    amount: amounts[idx],
    actual: c.actual !== undefined ? c.actual : amounts[idx],
    subEvent: c.subEvent,
  }));
}

export interface BudgetTotals {
  totalBudgeted: number;
  totalActual: number;
  difference: number;
  isOverBudget: boolean;
  overBudgetAmount: number;
  underBudgetAmount: number;
}

/**
 * Computes aggregated budget totals from a set of BudgetCategory entries.
 * Pure calculation — no LLM, no side-effects.
 *
 * @param categories - Array of BudgetCategory with `amount` (planned) and `actual` (spent) fields
 * @param totalBudget - The user's declared total budget
 * @returns BudgetTotals with totalBudgeted, totalActual, difference, isOverBudget, and over/under amounts
 */
export function calculateBudgetTotals(
  categories: BudgetCategory[],
  totalBudget: number,
): BudgetTotals {
  const totalBudgeted = categories.reduce((acc, c) => acc + c.amount, 0);
  const totalActual = categories.reduce((acc, c) => acc + c.actual, 0);
  const difference = totalActual - totalBudget;
  const isOverBudget = difference > 0;

  return {
    totalBudgeted,
    totalActual,
    difference,
    isOverBudget,
    overBudgetAmount: isOverBudget ? difference : 0,
    underBudgetAmount: !isOverBudget ? Math.abs(difference) : 0,
  };
}

/**
 * Deterministically reduces the total budget by a given percentage and
 * re-allocates all category amounts using the Largest-Remainder method.
 *
 * @param categories - Current BudgetCategory array
 * @param currentTotal - Current total budget in rupees
 * @param percentCut - Percentage to cut (0-100); clamped to 0 minimum
 * @returns Object with `newTotal` (integer rupees) and `updatedCategories` (re-allocated)
 */
export function applyBudgetCut(
  categories: BudgetCategory[],
  currentTotal: number,
  percentCut: number,
): { newTotal: number; updatedCategories: BudgetCategory[] } {
  const factor = Math.max(0, (100 - percentCut) / 100);
  const newTotal = Math.round(currentTotal * factor);
  const updatedCategories = populateCategoryAmounts(categories, newTotal);
  return { newTotal, updatedCategories };
}

/**
 * Groups BudgetCategory entries by their `subEvent` field.
 * Categories with no subEvent are placed under the key `'General'`.
 * Used by the dashboard to render per-ceremony budget breakdowns.
 *
 * @param categories - Array of BudgetCategory entries
 * @returns Record mapping subEvent name → array of BudgetCategory items
 */
export function groupCategoriesBySubEvent(
  categories: BudgetCategory[],
): Record<string, BudgetCategory[]> {
  const groups: Record<string, BudgetCategory[]> = {};
  for (const cat of categories) {
    const key = cat.subEvent?.trim() || 'General';
    if (!groups[key]) groups[key] = [];
    groups[key].push(cat);
  }
  return groups;
}
