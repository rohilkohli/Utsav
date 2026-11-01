import type { PlanOutput, WizardInput } from '../../shared/schemas.js';

export interface StoredGuestPlan {
  planId: string;
  input: WizardInput;
  plan: PlanOutput;
  updatedAt: string;
}

export const GUEST_PLAN_STORAGE_KEY = 'utsav_guest_plan';

/**
 * Persist the guest plan in localStorage.
 * Every write is wrapped in try/catch and maintains only the single latest plan.
 */
export function saveGuestPlan(planId: string, input: WizardInput, plan: PlanOutput): void {
  try {
    const data: StoredGuestPlan = {
      planId,
      input,
      plan,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(GUEST_PLAN_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Gracefully ignore quota exceeded or disabled storage
  }
}

/**
 * Retrieve the latest guest plan from localStorage on refresh or mount.
 * Every read is wrapped in try/catch.
 */
export function loadGuestPlan(): StoredGuestPlan | null {
  try {
    const raw = localStorage.getItem(GUEST_PLAN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGuestPlan;
    if (parsed && parsed.planId && parsed.input && parsed.plan) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear the guest plan from localStorage.
 */
export function clearGuestPlan(): void {
  try {
    localStorage.removeItem(GUEST_PLAN_STORAGE_KEY);
  } catch {
    // Gracefully ignore storage errors
  }
}
