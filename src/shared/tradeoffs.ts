import type { BudgetCategory } from './schemas.js';
import { populateCategoryAmounts } from './budget.js';

/**
 * Represents a single concrete budget tradeoff option shown to the user
 * when their actual spend exceeds the total budget.
 */
export interface TradeoffOption {
  /** Stable identifier for the option (e.g. 'uniform-cut', 'flex-cut', 'rebalance') */
  id: string;
  /** Short human-readable label for the action button */
  label: string;
  /** Longer explanation of what this option does and what stays unchanged */
  description: string;
  /** New total budget after applying this option */
  newTotal: number;
  /** Amount saved compared to current actual spend */
  savings: number;
  /** Updated BudgetCategory array with recalculated amounts */
  updatedCategories: BudgetCategory[];
}

/** Category names that are discretionary and can be cut first */
const HIGH_FLEX_CATEGORIES = ['decor', 'decoration', 'entertainment', 'photography', 'videography', 'stationery', 'return gifts', 'return gift', 'gifts'];
/** Category names that are essential and should be protected from cuts */
const LOW_FLEX_CATEGORIES = ['catering', 'food', 'venue', 'hall', 'priest', 'pandit', 'accommodation'];

/**
 * Returns true if the category is discretionary (can be reduced without major impact).
 * @param category - The category name from the budget plan
 */
function isHighFlex(category: string): boolean {
  const lower = category.toLowerCase();
  return HIGH_FLEX_CATEGORIES.some((k) => lower.includes(k));
}

/**
 * Returns true if the category is essential (catering, venue, priest, etc.) and
 * should not be cut in flex-first scenarios.
 * @param category - The category name from the budget plan
 */
function isLowFlex(category: string): boolean {
  const lower = category.toLowerCase();
  return LOW_FLEX_CATEGORIES.some((k) => lower.includes(k));
}

/**
 * Generates 3 concrete, actionable tradeoff options when the plan is over budget.
 *
 * Option 1 — Uniform cut: scales every category proportionally.
 * Option 2 — Flex-first cut: reduces discretionary categories (décor, photography,
 *             return gifts) while protecting essentials (catering, venue, pandit).
 * Option 3 — Rebalance: brings overspent non-essential categories back to plan,
 *             or falls back to a 15% deep-cut if no under-spent categories exist.
 *
 * Pure function — no LLM calls, deterministic output.
 *
 * @param categories - Current budget categories with actual spend values
 * @param totalBudget - The user's declared total budget
 * @param overByAmount - How much actual spend exceeds totalBudget (must be > 0)
 * @returns Array of exactly 3 TradeoffOption objects, or empty array if not over budget
 */
export function suggestTradeoffs(
  categories: BudgetCategory[],
  totalBudget: number,
  overByAmount: number,
): TradeoffOption[] {
  if (overByAmount <= 0) return [];

  const options: TradeoffOption[] = [];

  // Option 1 — Uniform cut: scale every category down proportionally
  const uniformCutPct = Math.min(Math.ceil((overByAmount / totalBudget) * 100) + 2, 30);
  const uniformNewTotal = Math.round(totalBudget * (1 - uniformCutPct / 100));
  const uniformCategories = populateCategoryAmounts(categories, uniformNewTotal);
  options.push({
    id: 'uniform-cut',
    label: `Scale everything down ${uniformCutPct}%`,
    description: `Reduce all categories proportionally to bring total to ₹${uniformNewTotal.toLocaleString('en-IN')}. Lowest disruption.`,
    newTotal: uniformNewTotal,
    savings: totalBudget - uniformNewTotal,
    updatedCategories: uniformCategories,
  });

  // Option 2 — Flex-first cut: cut high-flexibility categories more, protect essentials
  const highFlexCats = categories.filter((c) => isHighFlex(c.category));
  if (highFlexCats.length > 0) {
    const highFlexTotal = highFlexCats.reduce((s, c) => s + c.actual, 0);
    const targetSavings = Math.min(overByAmount * 1.1, highFlexTotal * 0.4);
    const flexCutCategories = categories.map((c) => {
      if (!isHighFlex(c.category)) return c;
      const cut = highFlexTotal > 0 ? Math.round((c.actual / highFlexTotal) * targetSavings) : 0;
      return { ...c, actual: Math.max(0, c.actual - cut), amount: Math.max(0, c.amount - cut) };
    });
    const flexNewTotal = flexCutCategories.reduce((s, c) => s + c.actual, 0);
    options.push({
      id: 'flex-cut',
      label: 'Trim décor & entertainment first',
      description: `Cut high-flexibility items (décor, photography, return gifts) by ~${Math.round((targetSavings / highFlexTotal) * 100)}%. Essential categories like catering and venue stay untouched.`,
      newTotal: flexNewTotal,
      savings: categories.reduce((s, c) => s + c.actual, 0) - flexNewTotal,
      updatedCategories: flexCutCategories,
    });
  } else {
    // Fallback: suggest a 10% cut option
    const tenPctTotal = Math.round(totalBudget * 0.9);
    options.push({
      id: 'ten-pct-cut',
      label: 'Cut budget by 10%',
      description: `Reduce total budget to ₹${tenPctTotal.toLocaleString('en-IN')} across all categories.`,
      newTotal: tenPctTotal,
      savings: totalBudget - tenPctTotal,
      updatedCategories: populateCategoryAmounts(categories, tenPctTotal),
    });
  }

  // Option 3 — Smart rebalance: redistribute from over-spent to under-spent
  const overSpent = categories.filter((c) => c.actual > c.amount && !isLowFlex(c.category));
  const underSpent = categories.filter((c) => c.actual < c.amount);
  if (overSpent.length > 0 && underSpent.length > 0) {
    const rebalanced = categories.map((c) => {
      if (overSpent.find((o) => o.id === c.id)) {
        return { ...c, actual: c.amount };
      }
      return c;
    });
    const rebalancedTotal = rebalanced.reduce((s, c) => s + c.actual, 0);
    options.push({
      id: 'rebalance',
      label: 'Rebalance overspent categories',
      description: `Bring ${overSpent.length} overspent category${overSpent.length > 1 ? 'ies' : 'y'} back to their planned amount. No total budget change needed.`,
      newTotal: rebalancedTotal,
      savings: categories.reduce((s, c) => s + c.actual, 0) - rebalancedTotal,
      updatedCategories: rebalanced,
    });
  } else {
    const smartNewTotal = Math.round(totalBudget * 0.85);
    options.push({
      id: 'smart-cut',
      label: 'Restructure for 15% savings',
      description: `Deep restructure to ₹${smartNewTotal.toLocaleString('en-IN')} — recommended when 2-3 categories are significantly over.`,
      newTotal: smartNewTotal,
      savings: totalBudget - smartNewTotal,
      updatedCategories: populateCategoryAmounts(categories, smartNewTotal),
    });
  }

  return options;
}
