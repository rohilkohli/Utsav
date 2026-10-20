import React, { useState } from 'react';
import type { WizardInput, EventType, OutputLanguage } from '@shared/schemas';
import { getTodayInKolkata, WEDDING_SUB_EVENTS, COMMUNITY_SUB_EVENTS } from '@shared/schemas';
import { EventTypeStep } from './EventTypeStep';
import { EventDetailsStep } from './EventDetailsStep';
import { BudgetStep } from './BudgetStep';
import { PreferencesStep } from './PreferencesStep';
import { ReviewStep } from './ReviewStep';

interface WizardShellProps {
  onGeneratePlan: (input: WizardInput) => Promise<void>;
  isGenerating: boolean;
}

const STEPS = [
  { id: 1, label: 'Type' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Budget' },
  { id: 4, label: 'Vibe' },
  { id: 5, label: 'Review' },
];

export const WizardShell: React.FC<WizardShellProps> = ({
  onGeneratePlan,
  isGenerating,
}) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<WizardInput>({
    eventType: 'wedding',
    subEvents: [...WEDDING_SUB_EVENTS],
    eventDate: getTodayInKolkata(),
    city: 'Jaipur',
    guestCount: 300,
    totalBudget: 2_500_000,
    theme: 'Royal Marigold & Sunset Tones',
    dietaryPreferences: ['Pure Vegetarian (No Onion/Garlic)', 'Live Chaat & Street Food'],
    culturalNotes: 'Traditional North Indian rituals',
    language: 'english',
  });

  const handleTypeChange = (type: EventType) => {
    let defaultSubs: string[] = [];
    let defaultBudget = 500_000;
    if (type === 'wedding') {
      defaultSubs = [...WEDDING_SUB_EVENTS];
      defaultBudget = 2_500_000;
    } else if (type === 'community') {
      defaultSubs = [...COMMUNITY_SUB_EVENTS];
      defaultBudget = 300_000;
    } else {
      defaultSubs = [];
      defaultBudget = 50_000;
    }
    setFormData((prev) => ({
      ...prev,
      eventType: type,
      subEvents: defaultSubs,
      totalBudget: defaultBudget,
    }));
  };

  const handleToggleSubEvent = (sub: string) => {
    setFormData((prev) => {
      const exists = prev.subEvents.includes(sub);
      const updated = exists ? prev.subEvents.filter((s) => s !== sub) : [...prev.subEvents, sub];
      return { ...prev, subEvents: updated };
    });
  };

  const handleToggleDietary = (item: string) => {
    setFormData((prev) => {
      const exists = prev.dietaryPreferences.includes(item);
      const updated = exists
        ? prev.dietaryPreferences.filter((i) => i !== item)
        : [...prev.dietaryPreferences, item];
      return { ...prev, dietaryPreferences: updated };
    });
  };

  const canProceed = () => {
    if (step === 1 && formData.eventType === 'wedding') {
      return formData.subEvents.length > 0;
    }
    if (step === 2) {
      return !!formData.eventDate && !!formData.city.trim() && formData.guestCount >= 0;
    }
    if (step === 3) {
      return formData.totalBudget >= 0;
    }
    return true;
  };

  return (
    <div
      style={{
        maxWidth: '840px',
        margin: '2rem auto',
        padding: '2rem',
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--surface-shadow)',
        border: '1px solid var(--surface-border)',
      }}
    >
      {/* Progress Bar */}
      <nav aria-label="Planning Progress" style={{ marginBottom: '2.5rem' }}>
        <ol
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            listStyle: 'none',
            position: 'relative',
          }}
        >
          {STEPS.map((s) => {
            const isCompleted = s.id < step;
            const isCurrent = s.id === step;
            return (
              <li
                key={s.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.4rem',
                  flex: 1,
                  position: 'relative',
                }}
              >
                <div
                  aria-current={isCurrent ? 'step' : undefined}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-full)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    background: isCompleted || isCurrent
                      ? 'linear-gradient(135deg, var(--primary-saffron) 0%, var(--primary-magenta) 100%)'
                      : 'rgba(0,0,0,0.06)',
                    color: isCompleted || isCurrent ? '#ffffff' : 'var(--text-light)',
                    boxShadow: isCurrent ? '0 0 0 4px rgba(230, 81, 0, 0.2)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isCompleted ? '✓' : s.id}
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? 'var(--primary-saffron)' : 'var(--text-muted)',
                  }}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Wizard Steps */}
      <div style={{ minHeight: '340px' }}>
        {step === 1 && (
          <EventTypeStep
            eventType={formData.eventType}
            subEvents={formData.subEvents}
            onChangeType={handleTypeChange}
            onToggleSubEvent={handleToggleSubEvent}
          />
        )}
        {step === 2 && (
          <EventDetailsStep
            eventDate={formData.eventDate}
            city={formData.city}
            guestCount={formData.guestCount}
            onChangeDate={(date) => setFormData((p) => ({ ...p, eventDate: date }))}
            onChangeCity={(city) => setFormData((p) => ({ ...p, city }))}
            onChangeGuests={(guestCount) => setFormData((p) => ({ ...p, guestCount }))}
          />
        )}
        {step === 3 && (
          <BudgetStep
            eventType={formData.eventType}
            totalBudget={formData.totalBudget}
            onChangeBudget={(budget) => setFormData((p) => ({ ...p, totalBudget: budget }))}
          />
        )}
        {step === 4 && (
          <PreferencesStep
            theme={formData.theme}
            dietaryPreferences={formData.dietaryPreferences}
            culturalNotes={formData.culturalNotes}
            language={formData.language}
            onChangeTheme={(theme) => setFormData((p) => ({ ...p, theme }))}
            onToggleDietary={handleToggleDietary}
            onChangeCulturalNotes={(culturalNotes) => setFormData((p) => ({ ...p, culturalNotes }))}
            onChangeLanguage={(language: OutputLanguage) => setFormData((p) => ({ ...p, language }))}
          />
        )}
        {step === 5 && (
          <ReviewStep
            input={formData}
            isGenerating={isGenerating}
            onGenerate={() => onGeneratePlan(formData)}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '2.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--surface-border)',
        }}
      >
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={isGenerating}
            style={{
              padding: '0.6rem 1.4rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--surface-border)',
              background: 'transparent',
              color: 'var(--text-main)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
        ) : (
          <div />
        )}

        {step < 5 && (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            style={{
              padding: '0.6rem 1.8rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: canProceed()
                ? 'var(--primary-saffron)'
                : 'rgba(0,0,0,0.1)',
              color: '#ffffff',
              fontWeight: 700,
              cursor: canProceed() ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
            }}
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
};
