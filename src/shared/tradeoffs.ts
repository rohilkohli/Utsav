import { requireValue } from './invariants.js';
import type { BudgetCategory } from './schemas.js';
import { allocateAmountsByLargestRemainder } from './budget.js';

export interface TradeoffOption {
  id: string;
  label: string;
  description: string;
  /** Actual spend after the proposed reductions; declared budget is unchanged. */
  newTotal: number;
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
): BudgetCategory[] {
  const pool = categories.filter(
    (category) => !category.locked && !category.verified && eligible(category),
  );
  const total = pool.reduce((sum, category) => sum + category.actual, 0);
  const amounts = allocateAmountsByLargestRemainder(
    pool.map((category) => ({ suggestedPercent: category.actual })),
    Math.max(0, total - savings),
  );
  const byId = new Map(pool.map((category, index) => [category.id, requireValue(amounts[index])]));
  return categories.map((category) =>
    byId.has(category.id) ? { ...category, actual: requireValue(byId.get(category.id)) } : category,
  );
}

/** Three concrete proposals grounded in exact spend; immutable commitments stay intact. */
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
  const target = Math.max(before - available, Math.floor(Math.max(0, totalBudget) * 0.98));
  const needed = before - target;
  const option = (
    id: string,
    label: string,
    description: string,
    updatedCategories: BudgetCategory[],
  ): TradeoffOption => {
    const newTotal = updatedCategories.reduce((sum, category) => sum + category.actual, 0);
    return { id, label, description, newTotal, savings: before - newTotal, updatedCategories };
  };
  const uniform = reducePool(categories, needed, () => true);
  const flex = reducePool(categories, needed, (category) => flexible.test(category.category));
  const flexRemaining = flex.reduce((sum, category) => sum + category.actual, 0) - target;
  const flexHasPool = categories.some((category) => flexible.test(category.category));
  const flexFinished =
    flexRemaining > 0
      ? reducePool(flex, flexRemaining, (category) => !flexible.test(category.category))
      : flex;
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
      'Reduce discretionary items first, then other uncommitted costs only if needed to meet the budget.',
      flexFinished,
    ),
    option(
      overspent && underspent ? 'rebalance' : 'smart-cut',
      'Rebalance overspent categories',
      'Restore overspent discretionary categories to plan before reducing other uncommitted spending.',
      balanced,
    ),
  ];
}
