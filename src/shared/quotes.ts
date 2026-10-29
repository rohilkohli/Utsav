/**
 * Vendor quote analysis utilities.
 * Provides schema validation for vendor quotes and pure comparison logic
 * to evaluate quotes against budgeted amounts without any LLM calls.
 */
import { z } from 'zod';

/** Zod schema for validating an incoming vendor quote */
export const vendorQuoteSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  vendorName: z.string().min(1).max(200),
  category: z.string().min(1),
  quotedAmount: z.number().int().min(0),
  budgetedAmount: z.number().int().min(0),
  notes: z.string().max(500).default(''),
  receivedAt: z.string(), // ISO date string
});

export type VendorQuote = z.infer<typeof vendorQuoteSchema>;

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
  } else if (deltaPercent <= 10) {
    verdict = 'slightly-over';
    recommendation = `${vendorName}'s quote is ${deltaPercent}% over budget (₹${delta.toLocaleString('en-IN')} extra). Consider negotiating a small discount.`;
  } else if (deltaPercent <= 25) {
    verdict = 'over-budget';
    recommendation = `${vendorName}'s quote exceeds budget by ${deltaPercent}% (₹${delta.toLocaleString('en-IN')}). Negotiate or compare with 1-2 alternatives.`;
  } else {
    verdict = 'significantly-over';
    recommendation = `${vendorName}'s quote is ${deltaPercent}% over budget (₹${delta.toLocaleString('en-IN')} extra). Strongly consider finding alternative ${category} vendors.`;
  }

  return { verdict, delta, deltaPercent, recommendation };
}
