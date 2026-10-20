import { LRUCache } from 'lru-cache';
import type { PlanOutput } from '../../shared/schemas.js';

const MAX_ENTRIES = 100;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

const cache = new LRUCache<string, PlanOutput>({
  max: MAX_ENTRIES,
  ttl: TTL_MS,
});

/**
 * Creates a deterministic cache key from the user's wizard input.
 */
export function createPlanCacheKey(input: Record<string, unknown>): string {
  const sorted = JSON.stringify(input, Object.keys(input).sort());
  let hash = 5381;
  for (let i = 0; i < sorted.length; i++) {
    hash = (hash * 33) ^ sorted.charCodeAt(i);
  }
  return `plan_${(hash >>> 0).toString(36)}`;
}

export function getCachedPlan(key: string): PlanOutput | undefined {
  return cache.get(key);
}

export function setCachedPlan(key: string, plan: PlanOutput): void {
  cache.set(key, plan);
}
