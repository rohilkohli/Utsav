// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearGuestPlan,
  GUEST_PLAN_STORAGE_KEY,
  loadGuestPlan,
  saveGuestPlan,
} from '../lib/guestPlanStorage';
import { clearAccountDraft, loadAccountDraft, saveAccountDraft } from '../hooks/planDraft';
import { input, plan, savedPlan } from './aiFixtures';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());
describe('validated local plan storage', () => {
  it('rejects malformed JSON and invalid guest payloads rather than trusting browser state', () => {
    localStorage.setItem(GUEST_PLAN_STORAGE_KEY, 'not JSON');
    expect(loadGuestPlan()).toBeNull();
    localStorage.setItem(GUEST_PLAN_STORAGE_KEY, JSON.stringify({ planId: '', input, plan }));
    expect(loadGuestPlan()).toBeNull();
    saveGuestPlan('guest', input, plan);
    expect(loadGuestPlan()?.planId).toBe('guest');
  });

  it('does not expose one account draft to another account', () => {
    expect(loadAccountDraft('user-1')).toBeNull();
    saveAccountDraft('user-1', { ...savedPlan, ownerUid: 'user-1' });
    expect(loadAccountDraft('user-1')?.id).toBe(savedPlan.id);
    expect(loadAccountDraft('user-2')).toBeNull();
    saveAccountDraft('user-1', { ...savedPlan, ownerUid: 'user-2' });
    expect(loadAccountDraft('user-1')).toBeNull();
    clearAccountDraft('user-1');
    expect(loadAccountDraft('user-1')).toBeNull();
  });

  it('survives corrupt account JSON and unavailable browser storage', () => {
    localStorage.setItem('utsav_account_draft_user-1', 'not JSON');
    expect(loadAccountDraft('user-1')).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadAccountDraft('user-1')).toBeNull();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => {
      saveAccountDraft('user-1', savedPlan);
    }).not.toThrow();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => {
      clearAccountDraft('user-1');
      clearGuestPlan();
    }).not.toThrow();
  });
});
