import { memo, useMemo, useRef, useState } from 'react';
import type { Idea, IdeaSection, WizardInput, PlanOutput } from '@shared/schemas';
import { IDEA_SECTIONS } from '@shared/schemas';
import { apiRefineSection } from '../../lib/api';
import { useAiCall } from '../../hooks/useAiCall';
import { ThinkingTrace } from '../shared/ThinkingTrace';
import './dashboard.css';
interface IdeasTabProps {
  ideas: Idea[];
  input: WizardInput;
  currentPlan: PlanOutput;
  onUpdateIdeas: (newIdeas: Idea[]) => void;
}
const sections: Record<IdeaSection, { title: string; hint: string; suggestions: string[] }> = {
  theme: {
    title: 'Theme & Aesthetic Vibe',
    hint: 'Colour palettes, motifs, and ambience.',
    suggestions: [
      'Rajasthani royal heritage look',
      'Minimalist pastel aesthetic',
      'Bollywood retro vintage vibes',
    ],
  },
  decor: {
    title: 'Décor & Atmosphere',
    hint: 'Florals, lighting, mandap, and backdrops.',
    suggestions: [
      'Marigold & diya centrepieces',
      'Eco-friendly clay and jute accents',
      'Floral photo booth backdrop',
    ],
  },
  food: {
    title: 'Food & Culinary Menus',
    hint: 'Regional dishes and dietary accommodations.',
    suggestions: [
      'Add live South Indian dosa/idli counter',
      'Pure Jain menu for all guests',
      'Regional street food chaat stalls',
    ],
  },
  activities: {
    title: 'Celebration Activities & Games',
    hint: 'Entertainment for every generation.',
    suggestions: [
      'Antakshari face-off for all ages',
      'Mehendi and art stations',
      'Surprise flash mob dance',
    ],
  },
  returnGifts: {
    title: 'Return Gifts & Mementos',
    hint: 'Thoughtful local handcrafted takeaways.',
    suggestions: [
      'Artisanal mithai in custom boxes',
      'Eco-friendly seed paper packets',
      'Local handloom cloth bags',
    ],
  },
};
export const IdeasTab = memo(function IdeasTab({
  ideas,
  input,
  currentPlan,
  onUpdateIdeas,
}: IdeasTabProps) {
  const [active, setActive] = useState<IdeaSection>('food');
  const [instruction, setInstruction] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const refs = useRef<Partial<Record<IdeaSection, HTMLButtonElement>>>({});
  const call = useAiCall<Awaited<ReturnType<typeof apiRefineSection>>>();
  const filtered = useMemo(() => ideas.filter((idea) => idea.section === active), [ideas, active]);
  const refine = async (text = instruction) => {
    if (!text.trim()) return;
    const section = active;
    const response = await call.run((options) =>
      apiRefineSection(section, text.trim(), input, currentPlan, options),
    );
    if (!response) return;
    onUpdateIdeas([...ideas.filter((idea) => idea.section !== section), ...response.ideas]);
    setInstruction('');
    setAnnouncement(`Updated ${sections[section].title} ideas.`);
  };
  const choose = (section: IdeaSection) => {
    call.reset();
    setActive(section);
    setInstruction('');
  };
  const keyboard = (event: React.KeyboardEvent<HTMLButtonElement>, section: IdeaSection) => {
    const index = IDEA_SECTIONS.indexOf(section);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? IDEA_SECTIONS.length - 1
          : ['ArrowRight', 'ArrowDown'].includes(event.key)
            ? (index + 1) % IDEA_SECTIONS.length
            : ['ArrowLeft', 'ArrowUp'].includes(event.key)
              ? (index + IDEA_SECTIONS.length - 1) % IDEA_SECTIONS.length
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    const target = IDEA_SECTIONS[next];
    if (target) {
      choose(target);
      refs.current[target]?.focus();
    }
  };
  return (
    <div className="dashboard-stack">
      <p className="sr-only" role="status">
        {announcement}
      </p>
      <div role="tablist" aria-label="Idea Sections" className="dashboard-tabs">
        {IDEA_SECTIONS.map((section) => (
          <button
            type="button"
            key={section}
            id={`idea-tab-${section}`}
            role="tab"
            className="dashboard-button"
            aria-controls={`idea-panel-${section}`}
            aria-selected={active === section}
            tabIndex={active === section ? 0 : -1}
            ref={(element) => {
              if (element) refs.current[section] = element;
            }}
            onKeyDown={(event) => {
              keyboard(event, section);
            }}
            onClick={() => {
              choose(section);
            }}
          >
            {sections[section].title}
          </button>
        ))}
      </div>
      {IDEA_SECTIONS.map((section) => (
        <div
          key={section}
          role="tabpanel"
          id={`idea-panel-${section}`}
          aria-labelledby={`idea-tab-${section}`}
          hidden={active !== section}
        >
          {active === section && (
            <div className="dashboard-stack">
              <p>{sections[section].hint}</p>
              <section className="dashboard-card">
                <label className="dashboard-label" htmlFor="refine-input">
                  Refine {sections[section].title} with AI:
                  <textarea
                    id="refine-input"
                    className="dashboard-input"
                    maxLength={300}
                    value={instruction}
                    onChange={(event) => {
                      setInstruction(event.target.value);
                    }}
                  />
                </label>
                <p>{instruction.length}/300 chars</p>
                <button
                  type="button"
                  className="dashboard-button dashboard-button--primary"
                  disabled={call.running || !instruction.trim()}
                  onClick={() => {
                    void refine();
                  }}
                >
                  Refine ideas
                </button>
                <div className="dashboard-row">
                  {sections[section].suggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      className="dashboard-button"
                      disabled={call.running}
                      onClick={() => {
                        void refine(suggestion);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <ThinkingTrace {...call} />
                {call.error && <p role="alert">{call.error}</p>}
              </section>
              <div className="dashboard-grid">
                {filtered.map((idea) => (
                  <article key={idea.id} className="dashboard-card">
                    <h3>{idea.title}</h3>
                    {idea.subEvent && <p className="dashboard-badge">{idea.subEvent}</p>}
                    <p>{idea.description}</p>
                    {idea.estimatedCost && <p>Approximate cost benchmark: {idea.estimatedCost}</p>}
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      <p className="dashboard-muted">
        Cost benchmarks are estimates. Confirm actual prices, availability, and terms directly with
        vendors.
      </p>
    </div>
  );
});
