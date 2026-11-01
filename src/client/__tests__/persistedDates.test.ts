// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GUEST_PLAN_STORAGE_KEY, loadGuestPlan, saveGuestPlan } from '../lib/guestPlanStorage';
import { loadAccountDraft, saveAccountDraft } from '../hooks/planDraft';
import { input, plan, savedPlan } from './aiFixtures';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2030-01-31T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('historical local plan recovery', () => {
  const event = { ...input, eventDate: '2030-02-01' };
  it('retains guest and owned account drafts after the event day passes', () => {
    saveGuestPlan('guest-retained', event, plan);
    saveAccountDraft('user-1', { ...savedPlan, ownerUid: 'user-1', input: event });
    expect(loadGuestPlan()?.input.eventDate).toBe('2030-02-01');
    expect(loadAccountDraft('user-1')?.input.eventDate).toBe('2030-02-01');
    vi.setSystemTime(new Date('2030-02-03T12:00:00Z'));
    expect(loadGuestPlan()?.planId).toBe('guest-retained');
    expect(loadAccountDraft('user-1')?.input.eventDate).toBe('2030-02-01');
    expect(loadAccountDraft('user-2')).toBeNull();
    expect(localStorage.getItem(GUEST_PLAN_STORAGE_KEY)).toContain('guest-retained');
  });

  it('still rejects malformed historical input and plan structures in both stores', () => {
    vi.setSystemTime(new Date('2030-03-03T12:00:00Z'));
    const invalidInputs = [
      { ...event, eventDate: '2030-02-30' },
      { ...event, guestCount: 10001 },
      { ...event, eventType: 'wedding', subEvents: [] },
    ];
    for (const invalid of invalidInputs) {
      localStorage.setItem(
        GUEST_PLAN_STORAGE_KEY,
        JSON.stringify({ planId: 'guest', input: invalid, plan, updatedAt: '2030-01-31' }),
      );
      localStorage.setItem(
        'utsav_account_draft_user-1',
        JSON.stringify({ ...savedPlan, ownerUid: 'user-1', input: invalid }),
      );
      expect(loadGuestPlan()).toBeNull();
      expect(loadAccountDraft('user-1')).toBeNull();
    }
    localStorage.setItem(
      GUEST_PLAN_STORAGE_KEY,
      JSON.stringify({
        planId: 'guest',
        input: event,
        plan: { ...plan, budget: 'corrupt' },
        updatedAt: '2030-01-31',
      }),
    );
    expect(loadGuestPlan()).toBeNull();
  });
});
