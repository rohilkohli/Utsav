import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PlanOutput, SavedPlan, WizardInput } from '@shared/schemas';
import { generateFallbackPlan } from '@shared/fallback';
import { apiGeneratePlan, apiGetPlan, apiSavePlan, apiUpdatePlan } from '../lib/api';
import { clearGuestPlan, loadGuestPlan, saveGuestPlan } from '../lib/guestPlanStorage';
import { clearAccountDraft, loadAccountDraft, saveAccountDraft } from './planDraft';
import { useAuth } from './useAuth';
import { useAiCall } from './useAiCall';
import type { TabType } from '../components/dashboard/DashboardShell';
interface ActivePlan {
  id: string;
  input: WizardInput;
  plan: PlanOutput;
  guest: boolean;
}
export function usePlanState() {
  const { id: routePlanId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [active, setActive] = useState<ActivePlan | null>(null);
  const latest = useRef(active);
  latest.current = active;
  const [isFallback, setIsFallback] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('budget');
  const updateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const migration = useRef<Promise<void> | null>(null);
  const generation = useAiCall<Awaited<ReturnType<typeof apiGeneratePlan>>>();
  const uid = user?.uid;
  useEffect(() => {
    if (loading || active) return;
    let cancelled = false;
    if (user && routePlanId) {
      void user
        .getIdToken()
        .then((token) => apiGetPlan(routePlanId, token))
        .then((saved) => {
          if (!cancelled)
            setActive({ id: saved.id, input: saved.input, plan: saved.plan, guest: false });
        })
        .catch(() => {
          if (!cancelled) setError('Could not load the saved plan. Please try again.');
        });
    } else {
      const account = uid ? loadAccountDraft(uid) : null;
      const guest = loadGuestPlan();
      if (account)
        setActive({ id: account.id, input: account.input, plan: account.plan, guest: false });
      else if (guest && (!routePlanId || guest.planId === routePlanId))
        setActive({ id: guest.planId, input: guest.input, plan: guest.plan, guest: true });
    }
    return () => {
      cancelled = true;
    };
  }, [loading, user, uid, routePlanId, active]);
  const isGuestPlan = active?.guest ?? false;
  useEffect(() => {
    const pending = latest.current;
    if (!user || !isGuestPlan || !pending || migration.current) return;
    let cancelled = false;
    const isCurrent = () => !cancelled;
    migration.current = user
      .getIdToken()
      .then((token) => apiSavePlan(pending.input, pending.plan, token))
      .then(async (saved) => {
        if (!isCurrent()) return;
        const current = latest.current;
        if (!current?.guest || current.id !== pending.id) return;
        const updated: SavedPlan = { ...saved, input: current.input, plan: current.plan };
        if (current.plan !== pending.plan || current.input !== pending.input)
          await apiUpdatePlan(updated, await user.getIdToken());
        if (!isCurrent()) return;
        saveAccountDraft(user.uid, { ...updated, ownerUid: user.uid });
        clearGuestPlan();
        setActive({ id: saved.id, input: current.input, plan: current.plan, guest: false });
        setNotice('Your guest plan is now saved to your account.');
        void navigate(`/plan/${saved.id}`, { replace: true });
      })
      .catch(() => {
        if (!cancelled)
          setError('We could not migrate your guest plan yet. Your browser copy is safe.');
      })
      .finally(() => {
        migration.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [user, isGuestPlan, navigate]);
  useEffect(
    () => () => {
      if (updateTimer.current) clearTimeout(updateTimer.current);
    },
    [],
  );
  const store = (state: ActivePlan) => {
    if (state.guest) saveGuestPlan(state.id, state.input, state.plan);
    else if (uid)
      saveAccountDraft(uid, {
        id: state.id,
        ownerUid: uid,
        input: state.input,
        plan: state.plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
  };
  const generate = async (input: WizardInput) => {
    setError('');
    setNotice('');
    const response = await generation.run(async (options) =>
      apiGeneratePlan(input, user ? await user.getIdToken() : undefined, options),
    );
    if (!response) return;
    const state = {
      id: response.planId ?? crypto.randomUUID(),
      input,
      plan: response.plan,
      guest: !user,
    };
    setActive(state);
    store(state);
    setIsFallback(response.meta.source === 'fallback');
    setActiveTab('budget');
    if (user) void navigate(`/plan/${state.id}`, { replace: true });
  };
  const instant = (input: WizardInput) => {
    generation.reset();
    setError('');
    setNotice('');
    const state = {
      id: crypto.randomUUID(),
      input,
      plan: generateFallbackPlan(input),
      guest: true,
    };
    setActive(state);
    saveGuestPlan(state.id, input, state.plan);
    setIsFallback(true);
    setActiveTab('budget');
  };
  const update = (plan: PlanOutput, budget?: number, guestCount?: number) => {
    if (!active) return;
    const input = {
      ...active.input,
      ...(budget === undefined ? {} : { totalBudget: budget }),
      ...(guestCount === undefined ? {} : { guestCount }),
    };
    const next = { ...active, input, plan };
    setActive(next);
    store(next);
    if (updateTimer.current) clearTimeout(updateTimer.current);
    if (user && !active.guest) {
      updateTimer.current = setTimeout(() => {
        const saved: SavedPlan = {
          id: active.id,
          ownerUid: user.uid,
          input,
          plan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        void user
          .getIdToken()
          .then((token) => apiUpdatePlan(saved, token))
          .catch(() => {
            setError(
              'Changes are saved in this browser. Cloud synchronization failed; please try again.',
            );
          });
      }, 500);
    }
  };
  const reset = () => {
    generation.reset();
    if (updateTimer.current) clearTimeout(updateTimer.current);
    setActive(null);
    setIsFallback(false);
    setError('');
    setNotice('');
    setActiveTab('budget');
    clearGuestPlan();
    if (uid) clearAccountDraft(uid);
    void navigate('/', { replace: true });
  };
  return {
    active,
    isFallback,
    error,
    notice,
    activeTab,
    setActiveTab,
    generation,
    generate,
    instant,
    update,
    reset,
  };
}
