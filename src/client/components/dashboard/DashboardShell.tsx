import React, { useState } from 'react';
import type { PlanOutput, WizardInput, BudgetCategory, Vendor, Idea } from '@shared/schemas';
import { BudgetTab } from './BudgetTab';
import { TimelineTab } from './TimelineTab';
import { VendorsTab } from './VendorsTab';
import { IdeasTab } from './IdeasTab';
import { ShareModal } from '../shared/ShareModal';
import { useAuth } from '../../hooks/useAuth.js';

interface DashboardShellProps {
  input: WizardInput;
  plan: PlanOutput;
  isFallback?: boolean;
  activeTab?: 'budget' | 'timeline' | 'vendors' | 'ideas';
  onTabChange?: (tab: 'budget' | 'timeline' | 'vendors' | 'ideas') => void;
  onUpdatePlan: (updated: PlanOutput, newBudget?: number) => void;
  onNewPlan: () => void;
}

type TabType = 'budget' | 'timeline' | 'vendors' | 'ideas';

export const DashboardShell: React.FC<DashboardShellProps> = ({
  input,
  plan,
  isFallback,
  activeTab: controlledTab,
  onTabChange,
  onUpdatePlan,
  onNewPlan,
}) => {
  const [internalTab, setInternalTab] = useState<TabType>('budget');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (t: TabType) => { setInternalTab(t); onTabChange?.(t); };
  const [isShareOpen, setIsShareOpen] = useState(false);
  const { user, login } = useAuth();

  const handleUpdateCategories = (categories: BudgetCategory[], newTotalBudget?: number) => {
    onUpdatePlan({ ...plan, budget: categories }, newTotalBudget);
  };

  const handleToggleMilestone = (id: string) => {
    const updated = plan.timeline.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m));
    onUpdatePlan({ ...plan, timeline: updated });
  };

  const handleUpdateVendor = (id: string, updates: Partial<Vendor>) => {
    const updated = plan.vendors.map((v) => (v.id === id ? { ...v, ...updates } : v));
    onUpdatePlan({ ...plan, vendors: updated });
  };

  const handleUpdateIdeas = (ideas: Idea[]) => {
    onUpdatePlan({ ...plan, ideas });
  };

  const tabs: Array<{ id: TabType; label: string; icon: string }> = [
    { id: 'budget', label: 'Budget Planner', icon: '💰' },
    { id: 'timeline', label: 'Timeline & Milestones', icon: '⏳' },
    { id: 'vendors', label: 'Vendor Checklist', icon: '🤝' },
    { id: 'ideas', label: 'Personalized Ideas', icon: '✨' },
  ];

  return (
    <div className="container" style={{ padding: '2rem 1.25rem' }}>
      {/* Guest Mode Persistence Prompt */}
      {!user && (
        <div
          role="region"
          aria-label="Guest session notification"
          data-testid="guest-save-prompt"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 111, 0, 0.08) 0%, rgba(194, 24, 91, 0.08) 100%)',
            border: '1px solid var(--primary-saffron)',
            color: 'var(--text-main)',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.25rem' }}>💾</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>
              Guest mode: Your celebration plan is saved on this browser. Sign in to save across devices.
            </span>
          </div>
          <button
            type="button"
            onClick={login}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'linear-gradient(135deg, var(--primary-saffron) 0%, var(--primary-magenta) 100%)',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(230, 81, 0, 0.25)',
            }}
          >
            Sign in to save across devices
          </button>
        </div>
      )}
      {/* Fallback notification if Gemini hit quota / network issues */}
      {isFallback && (
        <div
          role="status"
          style={{
            background: 'rgba(255, 179, 0, 0.12)',
            border: '1px solid var(--primary-gold)',
            color: 'var(--text-main)',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
          }}
        >
          <span>
            ℹ️ Showing curated expert defaults for {input.city} {input.eventType}. You can customize
            everything below!
          </span>
        </div>
      )}

      {/* Plan Header Card */}
      <div
        style={{
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--surface-border)',
          padding: '1.75rem',
          marginBottom: '2rem',
          boxShadow: 'var(--surface-shadow)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1.25rem',
        }}
      >
        <div style={{ maxWidth: '680px' }}>
          {/* Event KPI chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {[
              { icon: '🎉', label: input.eventType.charAt(0).toUpperCase() + input.eventType.slice(1), color: 'var(--primary-saffron)' },
              { icon: '🗺️', label: input.city, color: 'var(--primary-magenta)' },
              { icon: '👥', label: `${input.guestCount.toLocaleString('en-IN')} guests`, color: 'var(--primary-emerald)' },
              { icon: '📅', label: input.eventDate, color: 'var(--primary-saffron)' },
              ...(input.subEvents.length > 0 ? [{ icon: '🎊', label: `${input.subEvents.length} ceremonies`, color: 'var(--primary-magenta)' }] : []),
              ...(input.language === 'hindi' ? [{ icon: '🇮🇳', label: 'Hindi Output', color: 'var(--primary-emerald)' }] : []),
            ].map((chip) => (
              <span key={chip.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.78rem', fontWeight: 600,
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid var(--surface-border)',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                color: chip.color,
              }}>
                {chip.icon} {chip.label}
              </span>
            ))}
          </div>

          <p
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              lineHeight: 1.5,
              color: 'var(--text-main)',
              margin: 0,
            }}
          >
            {plan.summary}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.65rem 1.25rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background:
                'linear-gradient(135deg, var(--primary-saffron) 0%, var(--primary-magenta) 100%)',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(230, 81, 0, 0.3)',
            }}
          >
            <span>🔗</span> Share Plan
          </button>

          <button
            type="button"
            onClick={onNewPlan}
            style={{
              padding: '0.65rem 1rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--surface-border)',
              background: 'var(--surface-card-hover)',
              color: 'var(--text-main)',
              cursor: 'pointer',
            }}
          >
            New Plan
          </button>
        </div>
      </div>

      {/* 4 Tab Navigation */}
      <div
        role="tablist"
        aria-label="Celebration Plan Features"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          marginBottom: '2rem',
        }}
      >
        {tabs.map((t) => {
          const isSelected = activeTab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.9rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: isSelected
                  ? '2px solid var(--primary-saffron)'
                  : '1px solid var(--surface-border)',
                background: isSelected ? 'var(--surface-card-hover)' : 'var(--surface-card)',
                boxShadow: isSelected ? '0 4px 12px rgba(230, 81, 0, 0.15)' : 'none',
                color: isSelected ? 'var(--primary-saffron)' : 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <main id="main">
        {activeTab === 'budget' && (
          <BudgetTab
            categories={plan.budget}
            totalBudget={input.totalBudget}
            onUpdateCategories={handleUpdateCategories}
          />
        )}
        {activeTab === 'timeline' && (
          <TimelineTab
            milestones={plan.timeline}
            eventDate={input.eventDate}
            onToggleMilestone={handleToggleMilestone}
          />
        )}
        {activeTab === 'vendors' && (
          <VendorsTab
            vendors={plan.vendors}
            city={input.city}
            onUpdateVendor={handleUpdateVendor}
          />
        )}
        {activeTab === 'ideas' && (
          <IdeasTab
            ideas={plan.ideas}
            input={input}
            currentPlan={plan}
            onUpdateIdeas={handleUpdateIdeas}
          />
        )}
      </main>

      {/* Share Modal */}
      <ShareModal
        input={input}
        plan={plan}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
};
