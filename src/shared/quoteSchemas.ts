import { z } from 'zod';

const money = z.number().int().nonnegative().max(1_000_000_000);

/** Extraction preserves unknown facts as null, never guesses a vendor or price. */
export const extractedQuoteSchema = z
  .object({
    vendorName: z.string().trim().min(1).max(200).nullable(),
    category: z.string().trim().min(1).max(100).nullable(),
    totalPrice: money.nullable(),
    pricePerPlate: money.nullable(),
    guestMinimum: z.number().int().nonnegative().max(10000).nullable(),
    taxIncluded: z.boolean().nullable(),
    advancePercent: z.number().min(0).max(100).nullable(),
    overtimeFee: z.string().max(300).nullable(),
    cancellationPolicy: z.string().max(500).nullable(),
  })
  .strict();
export const quoteSchema = extractedQuoteSchema;
export type ExtractedQuote = z.infer<typeof extractedQuoteSchema>;

export const extractQuoteRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(8000),
    category: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
export const extractQuoteResponseSchema = z.object({
  quote: extractedQuoteSchema,
  source: z.enum(['gemini', 'fallback']),
  model: z.string().optional(),
});

/** Saved quotes attach extraction facts to a known checklist category. */
export const vendorQuoteSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  vendorName: z.string().min(1).max(200),
  category: z.string().min(1),
  quotedAmount: money,
  totalPrice: money.nullish(),
  pricePerPlate: money.nullish(),
  guestMinimum: z.number().int().nonnegative().max(10000).nullish(),
  taxIncluded: z.boolean().nullish(),
  advancePercent: z.number().min(0).max(100).nullish(),
  overtimeFee: z.string().max(300).nullish(),
  cancellationPolicy: z.string().max(500).nullish(),
  budgetedAmount: money,
  notes: z.string().max(500).default(''),
  receivedAt: z.string(),
});
export type VendorQuote = z.infer<typeof vendorQuoteSchema>;
