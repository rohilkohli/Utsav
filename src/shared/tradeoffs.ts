import { requireValue } from './invariants.js';
import type { BudgetCategory } from './schemas.js';
import { allocateAmountsByLargestRemainder, nonnegativeInteger } from './allocation.js';

export interface TradeoffOption {
  id: string;
  label: string;
  description: string;
  /** The user's unchanged target budget. */
  newTotal: number;
  newTotalActual: number;
  feasible: boolean;
  uncoveredShortfall: number;
  savings: number;
  updatedCategories: BudgetCategory[];
}

const flexible =
  /decor|decoration|entertainment|photography|videography|stationery|return gifts?|gifts/i;
const essential = /catering|food|venue|hall|priest|pandit|accommodation/i;

/** Remove an exact amount from a selected pool without touching commitments. */
function reducePool(
  categories: BudgetCategory[],
  savings: number,
  eligible: (category: BudgetCategory) => boolean,
  maximumFraction = 1,
): BudgetCategory[] {
  const pool = categories.filter(
    (category) => !category.locked && !category.verified && eligible(category),
  );
  const capacities = pool.map((category) => Math.floor(category.actual * maximumFraction));
  const total = capacities.reduce((sum, capacity) => sum + capacity, 0);
  const retained = allocateAmountsByLargestRemainder(
    capacities.map((capacity) => ({ suggestedPercent: capacity })),
    Math.max(0, total - Math.max(0, savings)),
  );
  const byId = new Map(
    pool.map((category, index) => [
      category.id,
      category.actual - requireValue(capacities[index]) + requireValue(retained[index]),
    ]),
  );
  return categories.map((category) =>
    byId.has(category.id) ? { ...category, actual: requireValue(byId.get(category.id)) } : category,
  );
}

/** Show each strategy's real outcome, including gaps that cannot safely be covered. */
export function suggestTradeoffs(
  categories: BudgetCategory[],
  totalBudget: number,
  overByAmount: number,
): TradeoffOption[] {
  const before = categories.reduce((sum, category) => sum + category.actual, 0);
  if (overByAmount <= 0 || before <= totalBudget) return [];
  const available = categories
    .filter((category) => !category.locked && !category.verified)
    .reduce((sum, category) => sum + category.actual, 0);
  if (available === 0) return [];
  const target = nonnegativeInteger(totalBudget);
  const needed = before - target;
  const option = (
    id: string,
    label: string,
    description: string,
    updatedCategories: BudgetCategory[],
  ): TradeoffOption => {
    const newTotalActual = updatedCategories.reduce((sum, category) => sum + category.actual, 0);
    const uncoveredShortfall = Math.max(0, newTotalActual - target);
    return {
      id,
      label,
      description,
      newTotal: target,
      newTotalActual,
      feasible: uncoveredShortfall === 0,
      uncoveredShortfall,
      savings: before - newTotalActual,
      updatedCategories,
    };
  };
  const uniform = reducePool(categories, needed, () => true);
  const flex = reducePool(
    categories,
    needed,
    (category) => flexible.test(category.category) && !essential.test(category.category),
    0.4,
  );
  const flexHasPool = categories.some((category) => flexible.test(category.category));
  const overspent = categories.some(
    (category) => category.actual > category.amount && !essential.test(category.category),
  );
  const underspent = categories.some((category) => category.actual < category.amount);
  const rebalanced = categories.map((category) =>
    !category.locked && !category.verified && !essential.test(category.category)
      ? { ...category, actual: Math.min(category.actual, category.amount) }
      : category,
  );
  const balanceRemaining = rebalanced.reduce((sum, category) => sum + category.actual, 0) - target;
  const balanced =
    balanceRemaining > 0 ? reducePool(rebalanced, balanceRemaining, () => true) : rebalanced;
  return [
    option(
      'uniform-cut',
      'Scale adjustable spending down',
      'Reduce uncommitted spending proportionally while preserving locked and accepted quotations.',
      uniform,
    ),
    option(
      flexHasPool ? 'flex-cut' : 'ten-pct-cut',
      'Trim décor & entertainment first',
      'Reduce discretionary costs by at most 40%, preserving essentials, locks and accepted quotations.',
      flex,
    ),
    option(
      overspent && underspent ? 'rebalance' : 'smart-cut',
      'Rebalance overspent categories',
      'Restore overspent discretionary categories to plan before reducing other uncommitted spending.',
      balanced,
    ),
  ];
}
