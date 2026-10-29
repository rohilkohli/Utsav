import { z } from 'zod';

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

export type QuoteVerdict = 'within-budget' | 'slightly-over' | 'over-budget' | 'significantly-over';

export interface QuoteComparison {
  verdict: QuoteVerdict;
  delta: number;
  deltaPercent: number;
  recommendation: string;
}

/**
 * Compares a vendor quote against the budgeted amount for the category.
 * Pure function — no LLM.
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
