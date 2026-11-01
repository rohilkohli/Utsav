/**
 * Currency utility for Indian Rupee (₹) formatting with Indian digit grouping (e.g. ₹1,50,000)
 */
const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/**
 * Format a number as Indian Rupees with proper symbol and grouping.
 * e.g. 150000 -> "₹1,50,000"
 */
export function formatINR(amount: number): string {
  if (isNaN(amount) || !isFinite(amount)) return '₹0';
  return inrFormatter.format(Math.round(amount));
}

/**
 * Parse an input string with currency symbols, commas or whitespace into a clean integer amount.
 */
export function parseINR(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}
