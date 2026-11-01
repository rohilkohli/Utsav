/** Assert graph/index invariants after validation without silently inventing defaults. */
export function requireValue<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Internal invariant: expected an existing value');
  return value;
}
