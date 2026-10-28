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

  it('formats small amounts correctly', () => {
    const result = formatINR(1000).replace(/ /g, ' ');
    expect(result).toMatch(/₹\s?1,000/);
  });

  it('formats negative numbers as absolute value', () => {
    const result = formatINR(-50000).replace(/ /g, ' ');
    expect(result).toMatch(/₹/);
    expect(result).not.toContain('NaN');
  });

  it('rounds fractional rupees to nearest integer', () => {
    const r1 = formatINR(1000.6).replace(/ /g, ' ');
    const r2 = formatINR(1000.4).replace(/ /g, ' ');
    expect(r1).toMatch(/1,001/);
    expect(r2).toMatch(/1,000/);
  });

  it('parses plain integer string without symbol', () => {
    expect(parseINR('500000')).toBe(500000);
  });

  it('parses string with only non-numeric characters', () => {
    expect(parseINR('₹₹₹')).toBe(0);
  });

  it('parses whitespace-only string', () => {
    expect(parseINR('   ')).toBe(0);
  });

  it('handles -Infinity gracefully', () => {
    expect(formatINR(-Infinity)).toBe('₹0');
  });
});
