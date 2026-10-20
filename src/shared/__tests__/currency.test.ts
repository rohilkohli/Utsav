import { describe, it, expect } from 'vitest';
import { formatINR, parseINR } from '../currency.js';

describe('Currency Utility - Indian Rupee (₹)', () => {
  it('formats amounts in Indian numbering system (e.g. ₹1,50,000)', () => {
    // Normalization might produce non-breaking space depending on Node version, so check number grouping
    const result150k = formatINR(150000).replace(/\u00A0/g, ' ');
    expect(result150k).toMatch(/₹\s?1,50,000/);

    const result1Cr = formatINR(10000000).replace(/\u00A0/g, ' ');
    expect(result1Cr).toMatch(/₹\s?1,00,00,000/);

    const resultZero = formatINR(0).replace(/\u00A0/g, ' ');
    expect(resultZero).toMatch(/₹\s?0/);
  });

  it('handles negative or invalid numbers gracefully', () => {
    expect(formatINR(NaN)).toBe('₹0');
    expect(formatINR(Infinity)).toBe('₹0');
  });

  it('parses user input strings back into clean integer rupees', () => {
    expect(parseINR('₹ 1,50,000')).toBe(150000);
    expect(parseINR('₹1,00,00,000')).toBe(10000000);
    expect(parseINR('')).toBe(0);
    expect(parseINR('abc')).toBe(0);
  });
});
