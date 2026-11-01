const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
export function formatINR(amount: number): string {
  return Number.isFinite(amount) ? inrFormatter.format(Math.round(amount)) : '₹0';
}

/** Accept common Indian amounts, while rejecting malformed numbers and negatives. */
export function parseINR(value: string): number | null {
  const text = value
    .trim()
    .toLowerCase()
    .replace(/^(?:₹|rs\.?|inr)\s*/, '')
    .trim();
  const match = /^(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|l|k)?$/.exec(text);
  if (!match?.[1]) return null;
  const digits = match[1];
  if (
    digits.includes(',') &&
    !/^(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?$/.test(digits)
  )
    return null;
  const amount = Number(digits.replace(/,/g, ''));
  const suffix = match[2] ?? '';
  const multiplier = suffix.startsWith('cr')
    ? 10_000_000
    : /^(?:la|l$)/.test(suffix)
      ? 100_000
      : suffix === 'k'
        ? 1000
        : 1;
  const rupees = Math.round(amount * multiplier);
  return Number.isSafeInteger(rupees) ? rupees : null;
}
