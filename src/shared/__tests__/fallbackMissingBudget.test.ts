import { expect, it, vi } from 'vitest';
import { generateFallbackPlan } from '../fallback.js';
import { input } from './fixtures.js';
vi.mock('../fallbackBudget.js', () => ({ createFallbackBudget: () => [] }));
it('preserves vendor checklists with zero estimates when a category has not been allocated', () => {
  for (const eventType of ['birthday', 'wedding', 'community'] as const) {
    const result = generateFallbackPlan({
      ...input,
      eventType,
      subEvents: eventType === 'wedding' ? ['Wedding Ceremony'] : [],
    });
    expect(result.budget).toEqual([]);
    expect(result.vendors).not.toHaveLength(0);
    expect(result.vendors.every((v) => v.budgetedAmount === 0)).toBe(true);
  }
});
