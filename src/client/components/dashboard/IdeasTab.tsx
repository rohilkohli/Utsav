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

const SECTION_METADATA: Record<IdeaSection, { title: string; icon: string; hint: string }> = {
  theme: { title: 'Theme & Aesthetic Vibe', icon: '🎨', hint: 'Colour palettes, motifs, overall ambience — the visual story of your event.' },
  decor: { title: 'Décor & Atmosphere', icon: '🌸', hint: 'Floral arrangements, lighting, backdrops, mandap/stage design, and props.' },
  food: { title: 'Food & Culinary Menus', icon: '🥘', hint: 'Live counters, cuisine style, signature dishes, and dietary accommodations.' },
  activities: { title: 'Celebration Activities & Games', icon: '🪩', hint: 'Entertainment, games, performances, and interactive experiences for all age groups.' },
  returnGifts: { title: 'Return Gifts & Mementos', icon: '🎁', hint: 'Thoughtful takeaways that guests remember — from artisanal mithai to eco-friendly keepsakes.' },
};

const SECTION_SUGGESTIONS: Record<IdeaSection, string[]> = {
  theme: ['Rajasthani royal heritage look', 'Minimalist pastel & white aesthetic', 'Bollywood retro vintage vibes', 'Rustic outdoor garden party'],
  decor: ['Marigold & diya centrepieces', 'Fairy lights & drapes for mandap', 'Eco-friendly clay/jute accents', 'Floral photo booth backdrop'],
  food: ['Add live South Indian dosa/idli counter', 'Pure Jain menu for all guests', 'Regional street food chaat stalls', 'Midnight snack station'],
  activities: ['Antakshari face-off for all ages', 'Mehendi & art stations', 'Photo booth with props & reels corner', 'Surprise flash mob dance'],
  returnGifts: ['Artisanal mithai in custom boxes', 'Eco-friendly seed paper packets', 'Personalised nameplates & mugs', 'Local handloom cloth bags'],
};

export const IdeasTab: React.FC<IdeasTabProps> = ({ ideas, input, currentPlan, onUpdateIdeas }) => {
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
          const count = ideas.filter((i) => i.section === sec).length;
          return (
            <button
              key={sec}
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveSection(sec)}
              title={meta.hint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-full)',
                border: isSelected
                  ? '1px solid var(--primary-saffron)'
                  : '1px solid var(--surface-border)',
                background: isSelected ? 'var(--primary-saffron)' : 'var(--surface-card)',
                color: isSelected ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{meta.icon}</span>
              <span>{meta.title}</span>
              {count > 0 && (
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(230,81,0,0.12)',
                  color: isSelected ? '#fff' : 'var(--primary-saffron)',
                  padding: '0.1rem 0.45rem',
                  borderRadius: 'var(--radius-full)',
                  minWidth: '18px',
                  textAlign: 'center',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Section Context */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        background: 'linear-gradient(135deg, rgba(255,111,0,0.05), rgba(194,24,91,0.05))',
        border: '1px solid rgba(230,81,0,0.15)',
        borderRadius: 'var(--radius-md)',
        padding: '0.65rem 1rem',
        fontSize: '0.83rem',
        color: 'var(--text-muted)',
      }}>
        <span style={{ fontSize: '1.1rem' }}>{SECTION_METADATA[activeSection].icon}</span>
        <div>
          <strong style={{ color: 'var(--text-main)' }}>{SECTION_METADATA[activeSection].title}: </strong>
          {SECTION_METADATA[activeSection].hint}
        </div>
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
          }}
        >
          <label htmlFor="refine-input" style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            Refine {SECTION_METADATA[activeSection].title} with AI:
          </label>
          <span
            style={{
              fontSize: '0.75rem',
              color: instruction.length > 270 ? 'var(--danger-text)' : 'var(--text-light)',
            }}
          >
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

        {/* Quick Suggestion Chips — contextual per section */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginRight: '0.2rem', flexShrink: 0 }}>
            ✨ Quick prompts:
          </span>
          {SECTION_SUGGESTIONS[activeSection].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleRefine(s)}
              disabled={isRefining}
              title={`Click to instantly rewrite this section with: "${s}"`}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--surface-border)',
                background: 'rgba(0,0,0,0.03)',
                color: 'var(--text-muted)',
                cursor: isRefining ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem',
                }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{idea.title}</h3>
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
                  Approximate Cost (AI Estimate):
                </span>
                <span
                  style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-emerald)' }}
                >
                  {idea.estimatedCost}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Cost advisory notice */}
      <div
        role="note"
        style={{
          background: 'rgba(0, 0, 0, 0.02)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.65rem 0.95rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span aria-hidden="true">💡</span>
        <span>
          <strong>Note on Estimates:</strong> AI cost estimates are approximate market benchmarks
          based on typical regional pricing. Actual vendor quotes depend on season, date
          availability, and bespoke requirements.
        </span>
      </div>
    </div>
  );
};
