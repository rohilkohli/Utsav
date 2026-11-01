import { lazy, memo, Suspense, useEffect, useRef, useState } from 'react';
import type { PlanOutput, WizardInput } from '@shared/schemas';
import { useAuth } from '../../hooks/useAuth.js';
import { AssistantPanel } from './AssistantPanel';
import { PrintSummary } from './PrintSummary';
import { DashboardPanel } from './DashboardPanel';
import { TradeoffSuggestions } from './TradeoffSuggestions';
import './dashboard.css';
const ShareModal = lazy(() =>
  import('../shared/ShareModal').then((module) => ({ default: module.ShareModal })),
);
export type TabType = 'budget' | 'timeline' | 'vendors' | 'ideas' | 'runsheet';
const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'budget', label: 'Budget Planner', icon: '💰' },
  { id: 'timeline', label: 'Timeline & Milestones', icon: '⏳' },
  { id: 'vendors', label: 'Vendor Checklist', icon: '🤝' },
  { id: 'ideas', label: 'Personalized Ideas', icon: '✨' },
  { id: 'runsheet', label: 'Day-of Run Sheet', icon: '📋' },
];
interface DashboardShellProps {
  input: WizardInput;
  plan: PlanOutput;
  isFallback?: boolean;
  readOnly?: boolean;
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  onUpdatePlan: (updated: PlanOutput, newBudget?: number, newGuestCount?: number) => void;
  onNewPlan: () => void;
}
export const DashboardShell = memo(function DashboardShell({
  input,
  plan,
  isFallback,
  readOnly = false,
  activeTab: controlledTab,
  onTabChange,
  onUpdatePlan,
  onNewPlan,
}: DashboardShellProps) {
  const [internalTab, setInternalTab] = useState<TabType>('budget');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (tab: TabType) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };
  const tabRefs = useRef<Partial<Record<TabType, HTMLButtonElement>>>({});
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const { user, login } = useAuth();
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  const keyboard = (event: React.KeyboardEvent<HTMLButtonElement>, id: TabType) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : ['ArrowRight', 'ArrowDown'].includes(event.key)
            ? (index + 1) % tabs.length
            : ['ArrowLeft', 'ArrowUp'].includes(event.key)
              ? (index + tabs.length - 1) % tabs.length
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    const tab = tabs[next];
    if (tab) {
      setActiveTab(tab.id);
      tabRefs.current[tab.id]?.focus();
    }
  };
  return (
    <main id="main" className="container dashboard dashboard-stack">
      {!user && !readOnly && (
        <section
          aria-label="Guest session notification"
          data-testid="guest-save-prompt"
          className="dashboard-card dashboard-row dashboard-between"
        >
          <p>
            Guest mode: Your celebration plan is saved on this browser. Sign in to save across
            devices.
          </p>
          <button
            type="button"
            className="dashboard-button"
            onClick={() => {
              void login();
            }}
          >
            Sign in to save across devices
          </button>
        </section>
      )}
      {isFallback && (
        <p role="status" className="dashboard-card">
          Showing curated expert defaults for {input.city} {input.eventType}. You can customize
          everything below!
        </p>
      )}
      <section className="dashboard-card">
        <h1 id="plan-title" ref={titleRef} tabIndex={-1}>
          {readOnly ? 'Shared celebration plan' : 'Your celebration plan'}
        </h1>
        <p>{plan.summary}</p>
        <p>
          {input.eventType} · {input.city} · {input.guestCount.toLocaleString('en-IN')} guests ·{' '}
          {input.eventDate}
          {input.subEvents.length > 0 && ` · ${input.subEvents.join(', ')}`}
          {input.language === 'hindi' && ' · Hindi Output'}
        </p>
        <div className="dashboard-row">
          {!readOnly && (
            <>
              <button
                type="button"
                className="dashboard-button dashboard-button--primary"
                onClick={() => {
                  setIsShareOpen(true);
                }}
              >
                🔗 Share Plan
              </button>
              <button type="button" className="dashboard-button" onClick={onNewPlan}>
                New Plan
              </button>
            </>
          )}
          <button
            type="button"
            className="dashboard-button"
            onClick={() => {
              window.print();
            }}
          >
            Print summary
          </button>
        </div>
      </section>
      {!readOnly && (
        <>
          <AssistantPanel plan={plan} input={input} onNavigate={setActiveTab} />
          <TradeoffSuggestions
            plan={plan}
            totalBudget={input.totalBudget}
            onUpdate={onUpdatePlan}
          />
        </>
      )}
      <div role="tablist" aria-label="Celebration Plan Features" className="dashboard-tabs">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className="dashboard-button"
            ref={(element) => {
              if (element) tabRefs.current[tab.id] = element;
            }}
            onClick={() => {
              setActiveTab(tab.id);
            }}
            onKeyDown={(event) => {
              keyboard(event, tab.id);
            }}
          >
            <span aria-hidden="true">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== tab.id}
        >
          {activeTab === tab.id && (
            <DashboardPanel
              tab={tab.id}
              plan={plan}
              input={input}
              onUpdatePlan={onUpdatePlan}
              readOnly={readOnly}
            />
          )}
        </div>
      ))}
      <PrintSummary plan={plan} input={input} />
      {isShareOpen && !readOnly && (
        <Suspense fallback={<p role="status">Opening share options…</p>}>
          <ShareModal
            input={input}
            plan={plan}
            isOpen
            onClose={() => {
              setIsShareOpen(false);
            }}
          />
        </Suspense>
      )}
    </main>
  );
});
