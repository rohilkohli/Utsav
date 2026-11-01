import { lazy, Suspense, useCallback } from 'react';
import {
  getTodayInKolkata,
  type PlanOutput,
  type WizardInput,
  type BudgetCategory,
  type Vendor,
  type Idea,
} from '@shared/schemas';
import { scaleGuests, scaleGuestCount, updateBudgetCategories } from '@shared/budget';
import { acceptQuotation, matchVendorBudgetCategory, type VendorQuote } from '@shared/quotes';
import { BudgetTab } from './BudgetTab';
import { TimelineTab } from './TimelineTab';
import type { TabType } from './DashboardShell';
const ReadOnlyPanel = lazy(() =>
  import('./ReadOnlyPanel').then((module) => ({ default: module.ReadOnlyPanel })),
);
const VendorsTab = lazy(() =>
  import('./VendorsTab').then((module) => ({ default: module.VendorsTab })),
);
const IdeasTab = lazy(() => import('./IdeasTab').then((module) => ({ default: module.IdeasTab })));
const RunSheetTab = lazy(() =>
  import('./RunSheetTab').then((module) => ({ default: module.RunSheetTab })),
);
export interface DashboardPanelProps {
  tab: TabType;
  input: WizardInput;
  plan: PlanOutput;
  readOnly?: boolean;
  onUpdatePlan: (updated: PlanOutput, newBudget?: number, newGuestCount?: number) => void;
}
export function DashboardPanel({ tab, input, plan, readOnly, onUpdatePlan }: DashboardPanelProps) {
  const categories = useCallback(
    (budget: BudgetCategory[], newTotal?: number) => {
      onUpdatePlan(updateBudgetCategories(plan, budget, true), newTotal);
    },
    [plan, onUpdatePlan],
  );
  const inferredRate =
    plan.perPlate ??
    (input.guestCount > 0
      ? Math.round(
          plan.budget
            .filter((category) => /cater|food|prasad/i.test(category.category))
            .reduce((sum, category) => sum + category.actual, 0) / input.guestCount,
        )
      : 0);
  const guests = (count: number) => {
    onUpdatePlan(scaleGuestCount(plan, input.guestCount, count).plan, undefined, count);
  };
  const perPlate = (rate: number) => {
    onUpdatePlan(scaleGuests(plan, input.guestCount, rate).plan);
  };
  const toggle = (id: string) => {
    onUpdatePlan({
      ...plan,
      timeline: plan.timeline.map((m) =>
        m.id === id
          ? {
              ...m,
              completed: !m.completed,
              status: m.completed ? ('todo' as const) : ('done' as const),
            }
          : m,
      ),
    });
  };
  const vendor = (id: string, updates: Partial<Vendor>) => {
    const current = plan.vendors.find((v) => v.id === id);
    const category = current ? matchVendorBudgetCategory(plan, current) : undefined;
    const manualAmount = updates.quotedAmount;
    const clearAcceptance =
      manualAmount !== undefined || (updates.status !== undefined && updates.status !== 'booked');
    onUpdatePlan({
      ...plan,
      vendors: plan.vendors.map((v) =>
        v.id === id
          ? {
              ...v,
              ...updates,
              ...(clearAcceptance ? { acceptedQuoteId: undefined } : {}),
              ...(manualAmount === undefined
                ? {}
                : { status: manualAmount > 0 ? ('quoted' as const) : ('to-contact' as const) }),
            }
          : v,
      ),
      budget:
        category && clearAcceptance
          ? plan.budget.map((c) =>
              c.id === category.id
                ? { ...c, actual: manualAmount ?? c.actual, verified: false }
                : c,
            )
          : plan.budget,
    });
  };
  const accept = (id: string, quote: VendorQuote) => {
    onUpdatePlan(acceptQuotation(plan, id, quote, input.guestCount));
  };
  const ideas = (ideas: Idea[]) => {
    onUpdatePlan({ ...plan, ideas });
  };
  if (readOnly)
    return (
      <Suspense fallback={<p role="status">Loading shared plan…</p>}>
        <ReadOnlyPanel tab={tab} plan={plan} input={input} />
      </Suspense>
    );
  return (
    <Suspense fallback={<p role="status">Loading celebration tools…</p>}>
      {tab === 'budget' && (
        <BudgetTab
          categories={plan.budget}
          totalBudget={input.totalBudget}
          guestCount={input.guestCount}
          perPlate={inferredRate}
          onUpdateCategories={categories}
          onUpdateGuestCount={guests}
          onUpdatePerPlate={perPlate}
        />
      )}
      {tab === 'timeline' && (
        <TimelineTab
          milestones={plan.timeline}
          compression={plan.timelineCompression}
          eventDate={input.eventDate}
          onToggleMilestone={toggle}
          onUpdateMilestones={(timeline) => {
            onUpdatePlan({ ...plan, timeline });
          }}
          today={getTodayInKolkata()}
        />
      )}
      {tab === 'vendors' && (
        <VendorsTab
          vendors={plan.vendors}
          city={input.city}
          guestCount={input.guestCount}
          onUpdateVendor={vendor}
          onAcceptQuotation={accept}
        />
      )}
      {tab === 'ideas' && (
        <IdeasTab ideas={plan.ideas} input={input} currentPlan={plan} onUpdateIdeas={ideas} />
      )}
      {tab === 'runsheet' && (
        <RunSheetTab eventType={input.eventType} eventDate={input.eventDate} />
      )}
    </Suspense>
  );
}
