import { describe, it, expect } from 'vitest';
import {
  createPlanCacheKey,
  getCachedPlan,
  setCachedPlan,
} from '../services/cache.js';
import type { PlanOutput } from '../../shared/schemas.js';

const mockPlan = (): PlanOutput => ({
  summary: 'Test plan summary',
  budget: [],
  timeline: [],
  vendors: [],
  ideas: [],
});

describe('Plan Cache Service', () => {
  describe('createPlanCacheKey', () => {
    it('produces a string starting with "plan_"', () => {
      const key = createPlanCacheKey({ city: 'Mumbai', eventType: 'birthday' });
      expect(key).toMatch(/^plan_[a-z0-9]+$/);
    });

    it('is deterministic — same input always produces the same key', () => {
      const input = { city: 'Delhi', eventType: 'wedding', guestCount: 200 };
      const key1 = createPlanCacheKey(input);
      const key2 = createPlanCacheKey(input);
      expect(key1).toBe(key2);
    });

    it('is order-independent — key-sorted input produces the same key', () => {
      const a = createPlanCacheKey({ city: 'Jaipur', budget: 500_000 });
      const b = createPlanCacheKey({ budget: 500_000, city: 'Jaipur' });
      expect(a).toBe(b);
    });

    it('produces different keys for different inputs', () => {
      const k1 = createPlanCacheKey({ city: 'Pune' });
      const k2 = createPlanCacheKey({ city: 'Chennai' });
      expect(k1).not.toBe(k2);
    });

    it('handles empty object without throwing', () => {
      expect(() => createPlanCacheKey({})).not.toThrow();
      expect(createPlanCacheKey({})).toMatch(/^plan_/);
    });

    it('handles nested objects and arrays', () => {
      const key = createPlanCacheKey({ subEvents: ['Haldi', 'Sangeet'], city: 'Agra' });
      expect(key).toMatch(/^plan_[a-z0-9]+$/);
    });

    it('produces different keys for different guest counts (no hash collision)', () => {
      const k1 = createPlanCacheKey({ guestCount: 50 });
      const k2 = createPlanCacheKey({ guestCount: 500 });
      expect(k1).not.toBe(k2);
    });
  });

  describe('getCachedPlan / setCachedPlan', () => {
    it('returns undefined for a key that has never been set', () => {
      const result = getCachedPlan('plan_nonexistent_key_xyz');
      expect(result).toBeUndefined();
    });

    it('returns the plan after it has been set', () => {
      const plan = mockPlan();
      const key = 'plan_test_set_get';
      setCachedPlan(key, plan);
      const retrieved = getCachedPlan(key);
      expect(retrieved).toBeDefined();
      expect(retrieved?.summary).toBe('Test plan summary');
    });

    it('overwrites an existing cached plan under the same key', () => {
      const key = 'plan_overwrite_test';
      const first = { ...mockPlan(), summary: 'First version' };
      const second = { ...mockPlan(), summary: 'Second version' };
      setCachedPlan(key, first);
      setCachedPlan(key, second);
      expect(getCachedPlan(key)?.summary).toBe('Second version');
    });

    it('stores different plans under different keys independently', () => {
      const plan1 = { ...mockPlan(), summary: 'Birthday plan' };
      const plan2 = { ...mockPlan(), summary: 'Wedding plan' };
      setCachedPlan('plan_birthday_key', plan1);
      setCachedPlan('plan_wedding_key', plan2);
      expect(getCachedPlan('plan_birthday_key')?.summary).toBe('Birthday plan');
      expect(getCachedPlan('plan_wedding_key')?.summary).toBe('Wedding plan');
    });

    it('round-trips a full plan with budget, timeline, vendors and ideas', () => {
      const full: PlanOutput = {
        summary: 'Full plan',
        budget: [{ id: 'b1', category: 'Venue', suggestedPercent: 40, amount: 40000, actual: 40000 }],
        timeline: [{ id: 't1', title: 'Book venue', date: '2026-10-01', completed: false }],
        vendors: [{ id: 'v1', category: 'Photographer', budgetedAmount: 20000, questions: [] }],
        ideas: [{ id: 'i1', section: 'food', title: 'Chaat Corner', description: 'Live chaat', estimatedCost: 5000 }],
      };
      setCachedPlan('plan_full_round_trip', full);
      const retrieved = getCachedPlan('plan_full_round_trip');
      expect(retrieved).toEqual(full);
    });
  });

  describe('createPlanCacheKey integration', () => {
    it('key generated from wizard input retrieves the correct cached plan', () => {
      const input = {
        eventType: 'birthday',
        city: 'Hyderabad',
        guestCount: 30,
        totalBudget: 20000,
      };
      const plan = { ...mockPlan(), summary: 'Hyderabad birthday' };
      const key = createPlanCacheKey(input);
      setCachedPlan(key, plan);
      expect(getCachedPlan(key)?.summary).toBe('Hyderabad birthday');
    });
  });
});
