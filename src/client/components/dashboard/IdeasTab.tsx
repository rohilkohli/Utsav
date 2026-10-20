import React, { useState } from 'react';
import type { Idea, IdeaSection, WizardInput, PlanOutput } from '@shared/schemas';
import { IDEA_SECTIONS } from '@shared/schemas';
import { apiRefineSection } from '../../lib/api';

interface IdeasTabProps {
  ideas: Idea[];
  input: WizardInput;
  currentPlan: PlanOutput;
  onUpdateIdeas: (newIdeas: Idea[]) => void;
}

const SECTION_METADATA: Record<IdeaSection, { title: string; icon: string }> = {
  theme: { title: 'Theme & Aesthetic Vibe', icon: '🎨' },
  decor: { title: 'Décor & Atmosphere', icon: '🌸' },
  food: { title: 'Food & Culinary Menus', icon: '🥘' },
  activities: { title: 'Celebration Activities & Games', icon: '🪩' },
  returnGifts: { title: 'Return Gifts & Mementos', icon: '🎁' },
};

const SUGGESTIONS = [
  'Make it eco-friendly & sustainable',
  'Add regional street food live counters',
  'Cost-effective DIY options',
  'Interactive dance & game ideas for all ages',
  'Traditional artisanal gifts from local craftsmen',
];

export const IdeasTab: React.FC<IdeasTabProps> = ({
  ideas,
  input,
  currentPlan,
  onUpdateIdeas,
}) => {
  const [activeSection, setActiveSection] = useState<IdeaSection>('food');
  const [instruction, setInstruction] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const sectionIdeas = ideas.filter((i) => i.section === activeSection);

  const handleRefine = async (customPrompt?: string) => {
    const text = customPrompt || instruction;
    if (!text.trim()) return;

    setIsRefining(true);
    setAnnouncement(`Refining ${SECTION_METADATA[activeSection].title} ideas with AI...`);

    try {
      const res = await apiRefineSection(activeSection, text.trim(), input, currentPlan);
      // Replace ideas in the active section, preserve other sections
      const otherIdeas = ideas.filter((i) => i.section !== activeSection);
      const updated = [...otherIdeas, ...res.ideas];
      onUpdateIdeas(updated);
      setInstruction('');
      setAnnouncement(`Successfully updated ${SECTION_METADATA[activeSection].title} ideas!`);
    } catch {
      setAnnouncement('Failed to refine ideas. Please try again.');
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Screen reader live announcement */}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {/* Section Filter Tabs */}
      <div
        role="tablist"
        aria-label="Idea Sections"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          borderBottom: '1px solid var(--surface-border)',
          paddingBottom: '0.75rem',
        }}
      >
        {IDEA_SECTIONS.map((sec) => {
          const isSelected = activeSection === sec;
          const meta = SECTION_METADATA[sec];
          return (
            <button
              key={sec}
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveSection(sec)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-full)',
                border: isSelected ? '1px solid var(--primary-saffron)' : '1px solid var(--surface-border)',
                background: isSelected ? 'var(--primary-saffron)' : 'var(--surface-card)',
                color: isSelected ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{meta.icon}</span>
              <span>{meta.title}</span>
            </button>
          );
        })}
      </div>

      {/* Refine Chat Bar */}
      <div
        style={{
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--surface-border)',
          padding: '1.25rem',
          boxShadow: 'var(--surface-shadow)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label htmlFor="refine-input" style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            Refine {SECTION_METADATA[activeSection].title} with AI:
          </label>
          <span style={{ fontSize: '0.75rem', color: instruction.length > 270 ? 'var(--danger-text)' : 'var(--text-light)' }}>
            {instruction.length}/300 chars
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            id="refine-input"
            type="text"
            maxLength={300}
            placeholder={`e.g. "make it eco-friendly", "add live South Indian dosa station"...`}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRefine();
            }}
            disabled={isRefining}
            style={{
              flex: 1,
              padding: '0.65rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--surface-border)',
              background: 'var(--surface-card-hover)',
              fontSize: '0.95rem',
            }}
          />

          <button
            type="button"
            onClick={() => handleRefine()}
            disabled={isRefining || !instruction.trim()}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--primary-saffron)',
              color: '#ffffff',
              fontWeight: 700,
              cursor: isRefining || !instruction.trim() ? 'not-allowed' : 'pointer',
              opacity: isRefining || !instruction.trim() ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isRefining ? '✨ Refining...' : '✨ Rewrite Section'}
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginRight: '0.2rem' }}>
            Ideas:
          </span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleRefine(s)}
              disabled={isRefining}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--surface-border)',
                background: 'rgba(0,0,0,0.03)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      {/* Idea Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {sectionIdeas.map((idea) => (
          <div
            key={idea.id}
            style={{
              background: 'var(--surface-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--surface-border)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: 'var(--surface-shadow)',
              position: 'relative',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                  {idea.title}
                </h3>
                {idea.subEvent && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--primary-magenta)',
                      background: 'rgba(194, 24, 91, 0.08)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    {idea.subEvent}
                  </span>
                )}
              </div>

              <p
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                  marginBottom: '1rem',
                }}
              >
                {idea.description}
              </p>
            </div>

            {idea.estimatedCost && (
              <div
                style={{
                  borderTop: '1px solid var(--surface-border)',
                  paddingTop: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                  Estimated Market Cost:
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-emerald)' }}>
                  {idea.estimatedCost}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
