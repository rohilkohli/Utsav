import { allocateAmountsByLargestRemainder, nonnegativeInteger } from './allocation.js';
export { allocateAmountsByLargestRemainder } from './allocation.js';
export { scaleGuests, scaleGuestCount, type GuestScaleResult } from './budgetGuests.js';
export { updateBudgetCategories } from './budgetSync.js';
import type { BudgetCategory } from './schemas.js';
import { requireValue } from './invariants.js';
export { BUDGET_PRESETS, type BudgetPreset } from './budgetPresets.js';

export interface BudgetCategoryInput {
  id: string;
  category: string;
  suggestedPercent: number;
  actual?: number;
  subEvent?: string;
  locked?: boolean;
  verified?: boolean;
  priority?: boolean;
}

/** Reserve exactly 10% by normalizing arbitrary creative weights first. */
export function ensureContingencyCategory(
  categories: BudgetCategoryInput[],
): BudgetCategoryInput[] {
  if (categories.some((category) => /contingency/i.test(category.category))) return categories;
  const sum = categories.reduce(
    (total, category) => total + Math.max(0, category.suggestedPercent),
    0,
  );
  return [
    ...categories.map((category) => ({
      ...category,
      suggestedPercent:
        sum > 0 ? (Math.max(0, category.suggestedPercent) * 90) / sum : 90 / categories.length,
    })),
    { id: 'contingency-buffer', category: 'Contingency Buffer', suggestedPercent: 10 },
  ];
}

/** Apply user priorities before allocation; contingency stays at its reserved weight. */
export function populateCategoryAmounts(
  categories: BudgetCategoryInput[],
  totalBudget: number,
  priorities: string[] = [],
): BudgetCategory[] {
  const weighted = categories.map((category) => ({
    ...category,
    priority:
      category.priority ??
      priorities.some((priority) =>
        category.category.toLowerCase().includes(priority.toLowerCase()),
      ),
  }));
  const regular = weighted.filter((category) => !/contingency/i.test(category.category));
  const base = regular.reduce((sum, category) => sum + Math.max(0, category.suggestedPercent), 0);
  const priorityTotal = regular.reduce(
    (sum, category) =>
      sum + Math.max(0, category.suggestedPercent) * (category.priority ? 1.25 : 1),
    0,
  );
  const allocationWeights = weighted.map((category) => ({
    suggestedPercent:
      /contingency/i.test(category.category) || priorityTotal === 0
        ? Math.max(0, category.suggestedPercent)
        : (Math.max(0, category.suggestedPercent) * (category.priority ? 1.25 : 1) * base) /
          priorityTotal,
  }));
  const amounts = allocateAmountsByLargestRemainder(allocationWeights, totalBudget);
  const sum = allocationWeights.reduce((total, item) => total + item.suggestedPercent, 0);
  return weighted.map((category, index) => ({
    ...category,
    suggestedPercent:
      sum > 0
        ? (requireValue(allocationWeights[index]).suggestedPercent * 100) / sum
        : 100 / weighted.length,
    amount: requireValue(amounts[index]),
    actual: category.actual ?? requireValue(amounts[index]),
    locked: category.locked ?? false,
    verified: category.verified ?? false,
  }));
}

export interface BudgetChange {
  id: string;
  category: string;
  delta: number;
}
export interface RedistributionResult {
  categories: BudgetCategory[];
  changes: BudgetChange[];
}
/** Cap changes at the unlocked pool and never alter accepted actual costs. */
export function redistribute(
  categories: BudgetCategory[],
  categoryId: string,
  newAmount: number,
): RedistributionResult {
  const requested = nonnegativeInteger(newAmount);
  const target = categories.find((category) => category.id === categoryId);
  const peers = categories.filter((category) => category.id !== categoryId && !category.locked);
  if (!target || target.locked || peers.length === 0) return { categories, changes: [] };
  const pool = peers.reduce((sum, category) => sum + category.amount, 0);
  const delta = Math.min(requested - target.amount, pool);
  if (delta === 0) return { categories, changes: [] };
  const amounts = allocateAmountsByLargestRemainder(
    peers.map((category) => ({ suggestedPercent: category.amount })),
    pool - delta,
  );
  const peerAmounts = new Map(
    peers.map((category, index) => [category.id, requireValue(amounts[index])]),
  );
  const total = categories.reduce((sum, category) => sum + category.amount, 0);
  const updated = categories.map((category) => {
    const amount =
      category.id === categoryId ? target.amount + delta : peerAmounts.get(category.id);
    if (amount === undefined) return category;
    return {
      ...category,
      amount,
      suggestedPercent: (amount * 100) / total,
      actual: !category.verified && category.actual === category.amount ? amount : category.actual,
    };
  });
  return {
    categories: updated,
    changes: updated.flatMap((category, index) => {
      const change = category.amount - requireValue(categories[index]).amount;
      return change === 0 ? [] : [{ id: category.id, category: category.category, delta: change }];
    }),
  };
}

export interface BudgetTotals {
  totalBudgeted: number;
  totalActual: number;
  difference: number;
  isOverBudget: boolean;
  overBudgetAmount: number;
  underBudgetAmount: number;
}
/** Reconcile the supplied target, then hold the edited category while peers absorb its delta. */
export function redistributeCategoryAmount(
  categories: BudgetCategory[],
  categoryId: string,
  newAmount: number,
  totalBudget: number,
): BudgetCategory[] {
  return redistribute(
    resizeBudget(categories, totalBudget).updatedCategories,
    categoryId,
    newAmount,
  ).categories;
}
export function calculateBudgetTotals(
  categories: BudgetCategory[],
  totalBudget: number,
): BudgetTotals {
  const totalBudgeted = categories.reduce((sum, category) => sum + category.amount, 0);
  const totalActual = categories.reduce((sum, category) => sum + category.actual, 0);
  const difference = totalActual - totalBudget;
  return {
    totalBudgeted,
    totalActual,
    difference,
    isOverBudget: difference > 0,
    overBudgetAmount: Math.max(0, difference),
    underBudgetAmount: Math.max(0, -difference),
  };
}

export function resizeBudget(
  categories: BudgetCategory[],
  requestedTotal: number,
): {
  newTotal: number;
  updatedCategories: BudgetCategory[];
} {
  const fixedTotal = categories
    .filter((category) => category.locked)
    .reduce((sum, category) => sum + category.amount, 0);
  const newTotal = Math.max(fixedTotal, nonnegativeInteger(requestedTotal));
  const unlocked = categories.filter((category) => !category.locked);
  const weights = unlocked.map((category) => ({
    suggestedPercent: category.amount > 0 ? category.amount : category.suggestedPercent,
  }));
  const amounts = allocateAmountsByLargestRemainder(weights, newTotal - fixedTotal);
  const byId = new Map(
    unlocked.map((category, index) => [category.id, requireValue(amounts[index])]),
  );
  return {
    newTotal: unlocked.length === 0 ? fixedTotal : newTotal,
    updatedCategories: categories.map((category) => {
      const amount = byId.get(category.id);
      if (amount === undefined) return category;
      return {
        ...category,
        amount,
        suggestedPercent: newTotal > 0 ? (amount * 100) / newTotal : 0,
        actual:
          !category.verified && category.actual === category.amount ? amount : category.actual,
      };
    }),
  };
}

export function applyBudgetCut(
  categories: BudgetCategory[],
  currentTotal: number,
  percentCut: number,
): {
  newTotal: number;
  updatedCategories: BudgetCategory[];
} {
  return resizeBudget(
    categories,
    currentTotal * (1 - Math.min(100, Math.max(0, percentCut)) / 100),
  );
}

export function groupCategoriesBySubEvent(
  categories: BudgetCategory[],
): Record<string, BudgetCategory[]> {
  const groups: Record<string, BudgetCategory[]> = {};
  for (const category of categories) {
    const label = category.subEvent?.trim() ?? '';
    const key = label.length > 0 ? label : 'General';
    Object.defineProperty(groups, key, {
      value: [...(Object.hasOwn(groups, key) ? requireValue(groups[key]) : []), category],
      enumerable: true,
      configurable: true,
    });
  }
  return groups;
}
