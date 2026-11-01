export function nonnegativeInteger(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Amount must be finite');
  return Math.max(0, Math.round(value));
}

/** Stable Hare–Niemeyer allocation; integer shares always conserve the total. */
export function allocateAmountsByLargestRemainder(
  items: { suggestedPercent: number }[],
  totalBudget: number,
): number[] {
  const total = nonnegativeInteger(totalBudget);
  if (items.length === 0) return [];
  const weights = items.map((item) => Math.max(0, item.suggestedPercent));
  if (weights.some((weight) => !Number.isFinite(weight)))
    throw new RangeError('Weight must be finite');
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((weight) => total * (sum > 0 ? weight / sum : 1 / items.length));
  const amounts = shares.map(Math.floor);
  const order = shares
    .map((share, index) => ({ index, remainder: share - Math.floor(share), share }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  const remainder = total - amounts.reduce((a, b) => a + b, 0);
  for (const entry of order.slice(0, remainder)) amounts[entry.index] = Math.floor(entry.share) + 1;
  return amounts;
}
