// @vitest-environment jsdom
import type { User } from 'firebase/auth';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanState } from '../hooks/usePlanState';
import { apiGeneratePlan, apiGetPlan, apiSavePlan, apiUpdatePlan } from '../lib/api';
import { loadGuestPlan, saveGuestPlan } from '../lib/guestPlanStorage';
import { loadAccountDraft, saveAccountDraft } from '../hooks/planDraft';
import { input, plan, savedPlan } from './aiFixtures';

const auth = vi.hoisted(() => ({ user: null as User | null, loading: false }));
const router = vi.hoisted(() => ({ navigate: vi.fn(), params: {} }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => router.navigate,
  useParams: () => router.params,
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../lib/api', () => ({
  apiGeneratePlan: vi.fn(),
  apiGetPlan: vi.fn(),
  apiSavePlan: vi.fn(),
  apiUpdatePlan: vi.fn(),
}));
const signedIn = { uid: 'user-1', getIdToken: () => Promise.resolve('token') } as User;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  auth.user = null;
  auth.loading = false;
  router.params = {};
  vi.mocked(apiGeneratePlan).mockResolvedValue({
    plan,
    planId: 'generated-1',
    meta: { source: 'fallback' },
  });
  vi.mocked(apiGetPlan).mockResolvedValue(savedPlan);
  vi.mocked(apiSavePlan).mockResolvedValue({ ...savedPlan, ownerUid: 'user-1' });
  vi.mocked(apiUpdatePlan).mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('connected plan lifecycle', () => {
  it('restores guest drafts and persists guest edits immediately without unauthorized API reads', () => {
    saveGuestPlan('guest-1', input, plan);
    const { result } = renderHook(() => usePlanState());
    expect(result.current.active?.id).toBe('guest-1');
    expect(apiGetPlan).not.toHaveBeenCalled();
    const changed = { ...plan, summary: 'Updated guest plan' };
    act(() => {
      result.current.update(changed, 50000, 60);
    });
    expect(loadGuestPlan()?.input).toMatchObject({ totalBudget: 50000, guestCount: 60 });
    expect(loadGuestPlan()?.plan.summary).toBe('Updated guest plan');
    act(() => {
      result.current.reset();
    });
    expect(result.current.active).toBeNull();
    expect(loadGuestPlan()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('waits for authentication and refuses guest route-ID mismatches', () => {
    saveGuestPlan('guest-1', input, plan);
    auth.loading = true;
    router.params = { id: 'another-plan' };
    const { result, rerender } = renderHook(() => usePlanState());
    expect(result.current.active).toBeNull();
    auth.loading = false;
    rerender();
    expect(result.current.active).toBeNull();
    act(() => {
      result.current.update(plan);
    });
    expect(apiUpdatePlan).not.toHaveBeenCalled();
  });

  it('generates and retains a guest plan, or creates one locally without calling AI', async () => {
    const { result } = renderHook(() => usePlanState());
    await act(async () => {
      await result.current.generate(input);
    });
    expect(result.current.active?.id).toBe('generated-1');
    expect(result.current.isFallback).toBe(true);
    expect(loadGuestPlan()?.planId).toBe('generated-1');
    act(() => {
      result.current.reset();
      result.current.instant(input);
    });
    expect(result.current.active?.guest).toBe(true);
    expect(
      result.current.active?.plan.budget.reduce((sum, category) => sum + category.amount, 0),
    ).toBe(input.totalBudget);
    expect(apiGeneratePlan).toHaveBeenCalledTimes(1);
  });

  it('does not create a plan after a failed generation', async () => {
    vi.mocked(apiGeneratePlan).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => usePlanState());
    await act(async () => {
      await result.current.generate(input);
    });
    expect(result.current.active).toBeNull();
    expect(result.current.generation.error).toBe('offline');
  });

  it('loads authenticated route plans and debounces the latest cloud update', async () => {
    auth.user = signedIn;
    router.params = { id: 'plan-1' };
    const { result } = renderHook(() => usePlanState());
    await waitFor(() => {
      expect(result.current.active?.id).toBe('plan-1');
    });
    expect(apiGetPlan).toHaveBeenCalledWith('plan-1', 'token');
    vi.useFakeTimers();
    act(() => {
      result.current.update({ ...plan, summary: 'Edit 1' });
    });
    act(() => {
      result.current.update({ ...plan, summary: 'Edit 2' }, 45000);
    });
    expect(loadAccountDraft('user-1')?.plan.summary).toBe('Edit 2');
    expect(apiUpdatePlan).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(apiUpdatePlan).toHaveBeenCalledTimes(1);
    expect(apiUpdatePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({ summary: 'Edit 2' }) as unknown,
        input: expect.objectContaining({ totalBudget: 45000 }) as unknown,
      }),
      'token',
    );
  });

  it('keeps local edits recoverable after cloud synchronization fails', async () => {
    auth.user = signedIn;
    saveAccountDraft('user-1', { ...savedPlan, ownerUid: 'user-1' });
    vi.mocked(apiUpdatePlan).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => usePlanState());
    expect(result.current.active?.guest).toBe(false);
    vi.useFakeTimers();
    act(() => {
      result.current.update({ ...plan, summary: 'Offline edit' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.error).toContain('Cloud synchronization failed');
    expect(loadAccountDraft('user-1')?.plan.summary).toBe('Offline edit');
  });

  it('migrates a guest plan on sign-in while preserving edits made during migration', async () => {
    saveGuestPlan('guest-1', input, plan);
    let finish: (value: typeof savedPlan) => void = () => undefined;
    vi.mocked(apiSavePlan).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result, rerender } = renderHook(() => usePlanState());
    auth.user = signedIn;
    rerender();
    await waitFor(() => {
      expect(apiSavePlan).toHaveBeenCalled();
    });
    act(() => {
      result.current.update({ ...plan, summary: 'Edited during sign-in' });
    });
    await act(async () => {
      finish(savedPlan);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.active?.guest).toBe(false);
    });
    expect(apiUpdatePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({ summary: 'Edited during sign-in' }) as unknown,
      }),
      'token',
    );
    expect(result.current.notice).toContain('saved to your account');
    expect(loadGuestPlan()).toBeNull();
    expect(loadAccountDraft('user-1')?.plan.summary).toBe('Edited during sign-in');
  });

  it('preserves a browser copy if migration fails and handles saved-plan load failures', async () => {
    saveGuestPlan('guest-1', input, plan);
    vi.mocked(apiSavePlan).mockRejectedValue(new Error('offline'));
    const { result, rerender, unmount } = renderHook(() => usePlanState());
    auth.user = signedIn;
    rerender();
    await waitFor(() => {
      expect(result.current.error).toContain('could not migrate');
    });
    expect(loadGuestPlan()).not.toBeNull();
    unmount();
    localStorage.clear();
    router.params = { id: 'plan-1' };
    vi.mocked(apiGetPlan).mockRejectedValue(new Error('missing'));
    const failed = renderHook(() => usePlanState());
    await waitFor(() => {
      expect(failed.result.current.error).toContain('Could not load');
    });
  });
});
