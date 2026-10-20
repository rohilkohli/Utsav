import React, { useState } from 'react';
import type { PlanOutput, WizardInput, BudgetCategory, Vendor, Idea } from '@shared/schemas';
import { BudgetTab } from './BudgetTab';
import { TimelineTab } from './TimelineTab';
import { VendorsTab } from './VendorsTab';
import { IdeasTab } from './IdeasTab';
import { ShareModal } from '../shared/ShareModal';

interface DashboardShellProps {
  input: WizardInput;
  plan: PlanOutput;
  isFallback?: boolean;
  onUpdatePlan: (updated: PlanOutput, newBudget?: number) => void;
  onNewPlan: () => void;
}

type TabType = 'budget' | 'timeline' | 'vendors' | 'ideas';

export const DashboardShell: React.FC<DashboardShellProps> = ({
  input,
  plan,
  isFallback,
  onUpdatePlan,
  onNewPlan,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('budget');
  const [isShareOpen, setIsShareOpen] = useState(false);

  const handleUpdateCategories = (categories: BudgetCategory[], newTotalBudget?: number) => {
    onUpdatePlan({ ...plan, budget: categories }, newTotalBudget);
  };

  const handleToggleMilestone = (id: string) => {
    const updated = plan.timeline.map((m) =>
      m.id === id ? { ...m, completed: !m.completed } : m,
    );
    onUpdatePlan({ ...plan, timeline: updated });
  };

  const handleUpdateVendor = (id: string, updates: Partial<Vendor>) => {
    const updated = plan.vendors.map((v) =>
      v.id === id ? { ...v, ...updates } : v,
    );
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
            ℹ️ Showing curated expert defaults for {input.city} {input.eventType}. You can customize everything below!
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--primary-saffron)',
              }}
            >
              {input.eventType} in {input.city}
            </span>
            <span style={{ color: 'var(--text-light)' }}>•</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {input.guestCount} guests
            </span>
          </div>

          <p
            style={{
              fontSize: '1.15rem',
              fontWeight: 600,
              lineHeight: 1.45,
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
              background: 'linear-gradient(135deg, var(--primary-saffron) 0%, var(--primary-magenta) 100%)',
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
      <main>
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
