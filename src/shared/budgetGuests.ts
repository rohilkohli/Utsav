import type { PlanOutput } from './schemas.js';
import { effectiveCost } from './quotes.js';
import { requireValue } from './invariants.js';
import { allocateAmountsByLargestRemainder, nonnegativeInteger } from './allocation.js';
export interface GuestScaleResult {
  plan: PlanOutput;
  requiredCatering: number;
  budgetedCatering: number;
  shortfall: number;
}

export function scaleGuests(
  plan: PlanOutput,
  newGuestCount: number,
  perPlate = plan.perPlate ?? 0,
): GuestScaleResult {
  const guests = nonnegativeInteger(newGuestCount);
  const rate = nonnegativeInteger(perPlate);
  const catering = plan.budget.filter((category) => /cater|food|prasad/i.test(category.category));
  const budgetedCatering = catering.reduce((sum, category) => sum + category.amount, 0);
  const selected = plan.vendors.flatMap((vendor) => {
    const quote = vendor.quotes?.find((entry) => entry.id === vendor.acceptedQuoteId);
    return /cater|food|prasad/i.test(vendor.category) && quote ? [quote] : [];
  });
  const requiredCatering =
    selected.length > 0
      ? selected.reduce(
          (sum, quote) =>
            sum +
            effectiveCost(
              { ...quote, pricePerPlate: rate > 0 ? rate : quote.pricePerPlate },
              guests,
            ),
          0,
        )
      : guests * rate;
  const amounts = allocateAmountsByLargestRemainder(
    catering.map((category) => ({ suggestedPercent: category.amount })),
    requiredCatering,
  );
  const byId = new Map(
    catering.map((category, index) => [category.id, requireValue(amounts[index])]),
  );
  return {
    plan: {
      ...plan,
      perPlate: rate,
      budget: plan.budget.map((category) =>
        byId.has(category.id)
          ? { ...category, actual: requireValue(byId.get(category.id)) }
          : category,
      ),
    },
    requiredCatering,
    budgetedCatering,
    shortfall: Math.max(0, requiredCatering - budgetedCatering),
  };
}
