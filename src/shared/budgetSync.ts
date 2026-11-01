import type { BudgetCategory, PlanOutput } from './schemas.js';
import { matchVendorBudgetCategory } from './vendorMatching.js';

/** Keep vendor comparisons and represented prices aligned without replacing unrelated estimates. */
export function updateBudgetCategories(
  plan: PlanOutput,
  budget: BudgetCategory[],
  manualActualEdits = false,
): PlanOutput {
  const next = { ...plan, budget };
  return {
    ...next,
    vendors: plan.vendors.map((vendor) => {
      const before = matchVendorBudgetCategory(plan, vendor);
      const after = matchVendorBudgetCategory(next, vendor);
      if (!after) return vendor;
      const actualChanged = before !== undefined && before.actual !== after.actual;
      const manual =
        manualActualEdits && actualChanged && before.amount === after.amount && !after.verified;
      const represented =
        before !== undefined && vendor.quotedAmount > 0 && vendor.quotedAmount === before.actual;
      return {
        ...vendor,
        budgetedAmount: after.amount,
        ...(actualChanged && (manual || represented) ? { quotedAmount: after.actual } : {}),
        ...(manual
          ? {
              acceptedQuoteId: undefined,
              status: after.actual > 0 ? ('quoted' as const) : ('to-contact' as const),
            }
          : {}),
      };
    }),
  };
}
