import { describe, it, expect } from 'vitest';
import { compareQuote, vendorQuoteSchema } from '../quotes.js';
import type { VendorQuote } from '../quotes.js';

const BASE_QUOTE: VendorQuote = {
  id: 'q1',
  vendorId: 'v1',
  vendorName: 'Raj Decorators',
  category: 'Decoration',
  quotedAmount: 80_000,
  budgetedAmount: 100_000,
  notes: '',
  receivedAt: '2026-10-01T10:00:00Z',
};

describe('compareQuote', () => {
  it('returns within-budget when quote <= budgeted', () => {
    const result = compareQuote(BASE_QUOTE);
    expect(result.verdict).toBe('within-budget');
    expect(result.delta).toBe(-20_000);
  });

  it('returns slightly-over for <10% over budget', () => {
    const result = compareQuote({ ...BASE_QUOTE, quotedAmount: 108_000, budgetedAmount: 100_000 });
    expect(result.verdict).toBe('slightly-over');
    expect(result.deltaPercent).toBe(8);
  });

  it('returns over-budget for 10-25% over budget', () => {
    const result = compareQuote({ ...BASE_QUOTE, quotedAmount: 120_000, budgetedAmount: 100_000 });
    expect(result.verdict).toBe('over-budget');
    expect(result.deltaPercent).toBe(20);
  });

  it('returns significantly-over for >25% over budget', () => {
    const result = compareQuote({ ...BASE_QUOTE, quotedAmount: 140_000, budgetedAmount: 100_000 });
    expect(result.verdict).toBe('significantly-over');
    expect(result.deltaPercent).toBe(40);
  });

  it('recommendation mentions vendor name and category', () => {
    const result = compareQuote({ ...BASE_QUOTE, quotedAmount: 130_000 });
    expect(result.recommendation).toContain('Raj Decorators');
  });

  it('handles zero budgeted amount (no divide-by-zero)', () => {
    const result = compareQuote({ ...BASE_QUOTE, budgetedAmount: 0, quotedAmount: 50_000 });
    expect(result.deltaPercent).toBe(0);
    expect(result.delta).toBe(50_000);
  });

  it('exact match is within-budget with delta 0', () => {
    const result = compareQuote({ ...BASE_QUOTE, quotedAmount: 100_000, budgetedAmount: 100_000 });
    expect(result.verdict).toBe('within-budget');
    expect(result.delta).toBe(0);
  });
});

describe('vendorQuoteSchema', () => {
  it('parses a valid quote', () => {
    const parsed = vendorQuoteSchema.parse({
      id: 'q1',
      vendorId: 'v1',
      vendorName: 'Test Vendor',
      category: 'Catering',
      quotedAmount: 50_000,
      budgetedAmount: 45_000,
      notes: 'Includes service charge',
      receivedAt: '2026-10-01T10:00:00Z',
    });
    expect(parsed.vendorName).toBe('Test Vendor');
  });

  it('defaults notes to empty string when omitted', () => {
    const parsed = vendorQuoteSchema.parse({
      id: 'q2',
      vendorId: 'v2',
      vendorName: 'X',
      category: 'Y',
      quotedAmount: 0,
      budgetedAmount: 0,
      receivedAt: '2026-10-01T10:00:00Z',
    });
    expect(parsed.notes).toBe('');
  });

  it('rejects negative quotedAmount', () => {
    expect(() =>
      vendorQuoteSchema.parse({
        id: 'q3',
        vendorId: 'v3',
        vendorName: 'X',
        category: 'Y',
        quotedAmount: -1,
        budgetedAmount: 0,
        receivedAt: '2026-10-01T10:00:00Z',
      }),
    ).toThrow();
  });
});
