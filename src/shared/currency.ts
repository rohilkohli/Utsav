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
export function parseINR(value: string): number | null {
  const normalized = value.trim().toLowerCase().replace(/₹/g, '').replace(/,/g, '').trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(crore|cr|lakh|lac|l|k)?$/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const multiplier =
    match[2] === 'crore' || match[2] === 'cr'
      ? 10_000_000
      : match[2] === 'lakh' || match[2] === 'lac' || match[2] === 'l'
        ? 100_000
        : match[2] === 'k'
          ? 1_000
          : 1;
  return Math.round(amount * multiplier);
}
