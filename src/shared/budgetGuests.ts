import type { PlanOutput } from './schemas.js';
import { effectiveCost, matchVendorBudgetCategory, type VendorQuote } from './quotes.js';
import { requireValue } from './invariants.js';
import { allocateAmountsByLargestRemainder, nonnegativeInteger } from './allocation.js';
import { updateBudgetCategories } from './budgetSync.js';
export interface GuestScaleResult {
  plan: PlanOutput;
  requiredCatering: number;
  budgetedCatering: number;
  shortfall: number;
}
const isCatering = (name: string) => /cater|food|prasad/i.test(name);

function acceptedCatering(plan: PlanOutput) {
  const selected = new Map<string, { vendorId: string; quote: VendorQuote }>();
  for (const vendor of plan.vendors) {
    const quote = vendor.quotes?.find((entry) => entry.id === vendor.acceptedQuoteId);
    const category = matchVendorBudgetCategory(plan, vendor);
    if (isCatering(vendor.category) && quote && category)
      selected.set(category.id, { vendorId: vendor.id, quote });
  }
  return selected;
}

function result(plan: PlanOutput): GuestScaleResult {
  const catering = plan.budget.filter((category) => isCatering(category.category));
  const requiredCatering = catering.reduce((sum, category) => sum + category.actual, 0);
  const budgetedCatering = catering.reduce((sum, category) => sum + category.amount, 0);
  return {
    plan,
    requiredCatering,
    budgetedCatering,
    shortfall: Math.max(0, requiredCatering - budgetedCatering),
  };
}

/** Guest edits scale existing estimates, including manual costs, rather than allocations. */
export function scaleGuestCount(
  plan: PlanOutput,
  oldGuestCount: number,
  newGuestCount: number,
): GuestScaleResult {
  const oldGuests = nonnegativeInteger(oldGuestCount);
  const guests = nonnegativeInteger(newGuestCount);
  const selected = acceptedCatering(plan);
  const vendorCosts = new Map<string, number>();
  const budget = plan.budget.map((category) => {
    if (!isCatering(category.category)) return category;
    const accepted = selected.get(category.id);
    let actual = Math.round(category.actual * (guests / Math.max(1, oldGuests)));
    if (accepted) {
      const { quote, vendorId } = accepted;
      if (quote.totalPrice != null || quote.pricePerPlate == null) {
        actual = effectiveCost(quote, guests);
      } else {
        const previousPlates = Math.max(oldGuests, quote.guestMinimum ?? 0);
        const plates = Math.max(guests, quote.guestMinimum ?? 0);
        actual =
          previousPlates > 0
            ? Math.round(category.actual * (plates / previousPlates))
            : quote.pricePerPlate * plates;
      }
      vendorCosts.set(vendorId, actual);
    }
    return { ...category, actual };
  });
  const synchronized = updateBudgetCategories(plan, budget);
  return result({
    ...synchronized,
    vendors: synchronized.vendors.map((vendor) =>
      vendorCosts.has(vendor.id)
        ? { ...vendor, quotedAmount: requireValue(vendorCosts.get(vendor.id)) }
        : vendor,
    ),
  });
}

/** An explicit rate edit recomputes estimates; saved fixed-price contracts stay fixed. */
export function scaleGuests(
  plan: PlanOutput,
  newGuestCount: number,
  perPlate = plan.perPlate ?? 0,
): GuestScaleResult {
  const guests = nonnegativeInteger(newGuestCount);
  const rate = nonnegativeInteger(perPlate);
  const catering = plan.budget.filter((category) => isCatering(category.category));
  const amounts = allocateAmountsByLargestRemainder(
    catering.map((category) => ({ suggestedPercent: category.amount })),
    guests * rate,
  );
  const selected = acceptedCatering(plan);
  const byId = new Map(
    catering.map((category, index) => [category.id, requireValue(amounts[index])]),
  );
  const overrides = new Set<string>();
  const vendorCosts = new Map<string, number>();
  for (const [categoryId, { quote, vendorId }] of selected) {
    const overridden =
      quote.totalPrice == null && quote.pricePerPlate != null && rate !== quote.pricePerPlate;
    const cost = effectiveCost(
      {
        ...quote,
        pricePerPlate: quote.pricePerPlate != null ? rate : quote.pricePerPlate,
      },
      guests,
    );
    byId.set(categoryId, cost);
    vendorCosts.set(vendorId, cost);
    if (overridden) overrides.add(vendorId);
  }
  const budget = plan.budget.map((category) => {
    const actual = byId.get(category.id);
    if (actual === undefined) return category;
    const accepted = selected.get(category.id);
    return {
      ...category,
      actual,
      verified: accepted && overrides.has(accepted.vendorId) ? false : category.verified,
    };
  });
  const synchronized = updateBudgetCategories(plan, budget);
  return result({
    ...synchronized,
    perPlate: rate,
    vendors: synchronized.vendors.map((vendor) => {
      const cost = vendorCosts.get(vendor.id);
      if (cost === undefined) return vendor;
      return {
        ...vendor,
        quotedAmount: cost,
        ...(overrides.has(vendor.id)
          ? {
              acceptedQuoteId: undefined,
              status: cost > 0 ? ('quoted' as const) : ('to-contact' as const),
            }
          : {}),
      };
    }),
  });
}
