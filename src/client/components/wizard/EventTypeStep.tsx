import React from 'react';
import type { EventType } from '@shared/schemas';
import { WEDDING_SUB_EVENTS, COMMUNITY_SUB_EVENTS } from '@shared/schemas';

interface EventTypeStepProps {
  eventType: EventType;
  subEvents: string[];
  onChangeType: (type: EventType) => void;
  onToggleSubEvent: (subEvent: string) => void;
}

export const EventTypeStep: React.FC<EventTypeStepProps> = ({
  eventType,
  subEvents,
  onChangeType,
  onToggleSubEvent,
}) => {
  const options: Array<{
    type: EventType;
    icon: string;
    title: string;
    subtitle: string;
    popularSubEvents?: readonly string[];
  }> = [
    {
      type: 'wedding',
      icon: '💍',
      title: 'Indian Wedding',
      subtitle: 'Multi-day celebrations with Haldi, Mehendi, Sangeet, Pheras & Reception.',
      popularSubEvents: WEDDING_SUB_EVENTS,
    },
    {
      type: 'birthday',
      icon: '🎂',
      title: 'Birthday / Milestone',
      subtitle: 'Memorable birthday parties, 1st birthdays, sweet 16s, and milestone jubilees.',
    },
    {
      type: 'community',
      icon: '🪔',
      title: 'Community Festival',
      subtitle: 'Society Diwali melas, Ganesh pandals, Navratri garba, and cultural gatherings.',
      popularSubEvents: COMMUNITY_SUB_EVENTS,
    },
  ];

  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        What are you celebrating?
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
        Select your celebration type to customize functions, budgets, and permits.
      </p>

      <div
        role="radiogroup"
        aria-label="Event Type"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {options.map((opt) => {
          const isSelected = eventType === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChangeType(opt.type)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                padding: '1.25rem',
                borderRadius: 'var(--radius-lg)',
                border: isSelected
                  ? '2px solid var(--primary-saffron)'
                  : '1px solid var(--surface-border)',
                background: isSelected ? 'var(--surface-card-hover)' : 'var(--surface-card)',
                boxShadow: isSelected ? '0 0 0 1px var(--primary-saffron)' : 'var(--surface-shadow)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{opt.icon}</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {opt.title}
              </span>
              <span
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.25rem',
                  lineHeight: 1.4,
                }}
              >
                {opt.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {eventType === 'wedding' && (
        <div
          style={{
            background: 'var(--surface-card)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)',
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-magenta)' }}>
              Select Wedding Functions & Ceremonies:
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Each ceremony will receive dedicated timeline milestones, vendors, and budget breakdowns.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.6rem',
            }}
          >
            {WEDDING_SUB_EVENTS.map((subEvent) => {
              const active = subEvents.includes(subEvent);
              return (
                <button
                  key={subEvent}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleSubEvent(subEvent)}
                  style={{
                    padding: '0.45rem 0.9rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-full)',
                    border: active ? '1px solid var(--primary-magenta)' : '1px solid var(--surface-border)',
                    background: active ? 'var(--primary-magenta)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {active ? '✓ ' : '+ '}
                  {subEvent}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {eventType === 'community' && (
        <div
          style={{
            background: 'var(--surface-card)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)',
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-emerald)' }}>
              Select Festival Stages & Events:
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Permissions checklist (Police, Sound, Municipal NOC) will be automatically included.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.6rem',
            }}
          >
            {COMMUNITY_SUB_EVENTS.map((subEvent) => {
              const active = subEvents.includes(subEvent);
              return (
                <button
                  key={subEvent}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleSubEvent(subEvent)}
                  style={{
                    padding: '0.45rem 0.9rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-full)',
                    border: active ? '1px solid var(--primary-emerald)' : '1px solid var(--surface-border)',
                    background: active ? 'var(--primary-emerald)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {active ? '✓ ' : '+ '}
                  {subEvent}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
