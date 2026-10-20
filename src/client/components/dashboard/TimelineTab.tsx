import React from 'react';
import type { Milestone } from '@shared/schemas';
import { getCountdownToEvent } from '@shared/timeline';
import { generateICS, createGoogleCalendarUrl } from '@shared/ics';

interface TimelineTabProps {
  milestones: Milestone[];
  eventDate: string;
  onToggleMilestone: (id: string) => void;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({
  milestones,
  eventDate,
  onToggleMilestone,
}) => {
  const countdown = getCountdownToEvent(eventDate);

  const handleDownloadICS = () => {
    const calendarEvents = milestones.map((m) => ({
      title: m.title,
      description: `${m.description}${m.subEvent ? ` [Ceremony: ${m.subEvent}]` : ''}`,
      dateStr: m.date,
    }));

    const icsContent = generateICS(calendarEvents);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `utsav-celebration-${eventDate}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Sort milestones chronologically (most advance first: 120 days before -> 0 days)
  const sorted = [...milestones].sort((a, b) => b.daysBeforeEvent - a.daysBeforeEvent);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Countdown & Export Bar */}
      <div
        style={{
          background: 'var(--surface-card)',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--surface-border)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          boxShadow: 'var(--surface-shadow)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--primary-saffron) 0%, var(--primary-magenta) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              color: '#ffffff',
            }}
          >
            ⏳
          </div>
          <div>
            <span
              style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                color: 'var(--primary-saffron)',
                display: 'block',
              }}
            >
              {countdown.label}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Target Celebration Date: {eventDate}
            </span>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={handleDownloadICS}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--primary-emerald)',
              background: 'var(--primary-emerald)',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 4px 10px -2px rgba(0, 105, 92, 0.3)',
            }}
          >
            📥 Export .ics Calendar
          </button>
        </div>
      </div>

      {/* Milestones Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {sorted.map((m) => {
          const googleUrl = createGoogleCalendarUrl({
            title: m.title,
            description: m.description,
            dateStr: m.date,
          });

          return (
            <div
              key={m.id}
              style={{
                background: 'var(--surface-card)',
                borderRadius: 'var(--radius-md)',
                border: m.completed
                  ? '1px solid var(--success-border)'
                  : '1px solid var(--surface-border)',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
                opacity: m.completed ? 0.75 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <input
                  type="checkbox"
                  checked={m.completed}
                  onChange={() => onToggleMilestone(m.id)}
                  aria-label={`Mark milestone ${m.title} as ${m.completed ? 'incomplete' : 'completed'}`}
                  style={{
                    marginTop: '0.25rem',
                    width: '20px',
                    height: '20px',
                    accentColor: 'var(--primary-emerald)',
                    cursor: 'pointer',
                  }}
                />

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h3
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        textDecoration: m.completed ? 'line-through' : 'none',
                        margin: 0,
                      }}
                    >
                      {m.title}
                    </h3>

                    {m.subEvent && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          background: 'rgba(194, 24, 91, 0.1)',
                          color: 'var(--primary-magenta)',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 600,
                        }}
                      >
                        {m.subEvent}
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.5rem',
                        background: 'rgba(0, 0, 0, 0.05)',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {m.daysBeforeEvent === 0
                        ? 'Event Day'
                        : `${m.daysBeforeEvent} days before`}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--text-muted)',
                      marginTop: '0.35rem',
                      marginBottom: '0.5rem',
                      lineHeight: 1.4,
                    }}
                  >
                    {m.description}
                  </p>

                  <span style={{ fontSize: '0.8rem', color: 'var(--primary-saffron)', fontWeight: 600 }}>
                    📅 Target Date: {m.date}
                  </span>
                </div>
              </div>

              <div>
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-card-hover)',
                    color: 'var(--text-main)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  🗓️ + Google Cal
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
