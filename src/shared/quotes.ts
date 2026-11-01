import type { PlanOutput } from './schemas.js';
import { matchVendorBudgetCategory } from './vendorMatching.js';
export { matchVendorBudgetCategory } from './vendorMatching.js';
import type { VendorQuote } from './quoteSchemas.js';
export * from './quoteSchemas.js';

export type QuoteRisk =
  | 'guestMinimumExceedsGuests'
  | 'overCategoryBudget'
  | 'taxNotStated'
  | 'advanceHigh'
  | 'overtimeFeeApplies'
  | 'noCancellationPolicy';

export function effectiveCost(quote: VendorQuote, guestCount: number): number {
  return (
    quote.totalPrice ??
    (quote.pricePerPlate != null
      ? quote.pricePerPlate * Math.max(0, Math.round(guestCount), quote.guestMinimum ?? 0)
      : quote.quotedAmount)
  );
}

export function riskFlags(quote: VendorQuote, guestCount: number): QuoteRisk[] {
  const risks: QuoteRisk[] = [];
  if ((quote.guestMinimum ?? 0) > guestCount) risks.push('guestMinimumExceedsGuests');
  if (effectiveCost(quote, guestCount) > quote.budgetedAmount) risks.push('overCategoryBudget');
  if (quote.taxIncluded == null) risks.push('taxNotStated');
  if ((quote.advancePercent ?? 0) > 50) risks.push('advanceHigh');
  if (quote.overtimeFee) risks.push('overtimeFeeApplies');
  if (!quote.cancellationPolicy) risks.push('noCancellationPolicy');
  return risks;
}

export function missingFields(quote: VendorQuote): string[] {
  const fields: string[] = [];
  if (quote.taxIncluded == null) fields.push('whether GST and taxes are included');
  if (!quote.cancellationPolicy?.trim()) fields.push('cancellation and refund policy');
  if (quote.guestMinimum == null) fields.push('minimum plates or guest count');
  if (quote.advancePercent == null) fields.push('advance payment percentage');
  return fields;
}

export function inquiryDraft(quote: VendorQuote, input: { familyName?: string }): string {
  const fields = missingFields(quote);
  const greeting = input.familyName
    ? `Hello ${quote.vendorName}, this is ${input.familyName}.`
    : `Hello ${quote.vendorName},`;
  return fields.length === 0
    ? `${greeting} Thank you for the complete quotation. We have the details needed to compare options.`
    : `${greeting} Thank you for the quotation. Could you please confirm ${fields.join(', ')}? We are comparing options for our celebration.`;
}

/**
 * Classification of how a vendor's quoted amount compares to the budgeted amount:
 * - `within-budget`: quote <= budgeted
 * - `slightly-over`: 1-10% over budget (negotiate a small discount)
 * - `over-budget`: 11-25% over budget (compare alternatives)
 * - `significantly-over`: >25% over budget (strongly reconsider vendor)
 */
export type QuoteVerdict = 'within-budget' | 'slightly-over' | 'over-budget' | 'significantly-over';

/** Result of comparing a vendor quote against the category budget */
export interface QuoteComparison {
  /** Severity classification of the quote vs budget */
  verdict: QuoteVerdict;
  /** Absolute difference in rupees (positive = over budget, negative = under) */
  delta: number;
  /** Percentage difference relative to budgetedAmount (0 when budgetedAmount is 0) */
  deltaPercent: number;
  /** Human-readable recommendation with vendor name and actionable advice */
  recommendation: string;
}

/**
 * Compares a vendor quote against the budgeted amount for that category.
 * Produces a verdict and actionable recommendation without any LLM call.
 *
 * @param quote - The vendor quote to evaluate (must pass vendorQuoteSchema validation)
 * @returns QuoteComparison with verdict, delta, deltaPercent, and recommendation string
 */
export function compareQuote(quote: VendorQuote): QuoteComparison {
  const { quotedAmount, budgetedAmount, vendorName, category } = quote;
  const delta = quotedAmount - budgetedAmount;
  const deltaPercent = budgetedAmount > 0 ? Math.round((delta / budgetedAmount) * 100) : 0;

  let verdict: QuoteVerdict;
  let recommendation: string;

  if (delta <= 0) {
    verdict = 'within-budget';
    recommendation = `${vendorName}'s quote for ${category} is within budget${delta < 0 ? ` — you save ₹${Math.abs(delta).toLocaleString('en-IN')}` : ''}.`;
  } else if (budgetedAmount > 0 && delta / budgetedAmount <= 0.1) {
    verdict = 'slightly-over';
    recommendation = `${vendorName}'s quote is ${deltaPercent}% over budget (₹${delta.toLocaleString('en-IN')} extra). Consider negotiating a small discount.`;
  } else if (budgetedAmount > 0 && delta / budgetedAmount <= 0.25) {
    verdict = 'over-budget';
    recommendation = `${vendorName}'s quote exceeds budget by ${deltaPercent}% (₹${delta.toLocaleString('en-IN')}). Negotiate or compare with 1-2 alternatives.`;
  } else {
    verdict = 'significantly-over';
    recommendation = `${vendorName}'s quote is ${deltaPercent}% over budget (₹${delta.toLocaleString('en-IN')} extra). Strongly consider finding alternative ${category} vendors.`;
  }

  return { verdict, delta, deltaPercent, recommendation };
}

/** Accept atomically so every dashboard tab observes the same agreed cost. */
export function acceptQuotation(
  plan: PlanOutput,
  vendorId: string,
  quote: VendorQuote,
  guestCount: number,
): PlanOutput {
  const vendor = plan.vendors.find((entry) => entry.id === vendorId);
  if (!vendor || quote.vendorId !== vendorId) throw new Error('Quotation does not match a vendor');
  const cost = effectiveCost(quote, guestCount);
  const matching = matchVendorBudgetCategory(plan, vendor);
  if (!matching) throw new Error('No matching budget category for this quotation');
  const quotes = [...(vendor.quotes ?? []).filter((entry) => entry.id !== quote.id), quote];
  return {
    ...plan,
    perPlate:
      /cater|food|prasad/i.test(vendor.category) && quote.pricePerPlate != null
        ? quote.pricePerPlate
        : plan.perPlate,
    budget: plan.budget.map((category) =>
      category.id === matching.id ? { ...category, actual: cost, verified: true } : category,
    ),
    vendors: plan.vendors.map((entry) =>
      entry.id === vendorId
        ? {
            ...entry,
            status: 'booked',
            quotedAmount: cost,
            budgetedAmount: matching.amount,
            quotes: quotes.slice(-3),
            acceptedQuoteId: quote.id,
          }
        : entry,
    ),
  };
}
