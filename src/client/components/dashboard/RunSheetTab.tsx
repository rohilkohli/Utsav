import React from 'react';
import type { EventType } from '@shared/schemas';
import { getRunSheet } from '@shared/runsheet';

interface RunSheetTabProps {
  eventType: EventType;
  eventDate: string;
}

export const RunSheetTab: React.FC<RunSheetTabProps> = ({ eventType, eventDate }) => {
  const sheet = getRunSheet(eventType);

  return (
    <div>
      <div
        style={{
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--surface-border)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: 'var(--surface-shadow)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>📋</span>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Day-of Run Sheet — {sheet.eventLabel}
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Event date: <strong>{eventDate}</strong> · Share this with your coordinator and vendors for a smooth day.
        </p>
      </div>

      <div
        role="list"
        aria-label="Day-of run sheet tasks"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
      >
        {sheet.blocks.map((block, idx) => (
          <div
            key={idx}
            role="listitem"
            style={{
              background: 'var(--surface-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--surface-border)',
              padding: '1rem 1.25rem',
              display: 'grid',
              gridTemplateColumns: '120px 1fr auto',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: 'var(--surface-shadow)',
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--primary-saffron)',
                background: 'rgba(255, 111, 0, 0.08)',
                padding: '0.25rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {block.time}
            </span>

            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                {block.task}
              </p>
              {block.notes && (
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {block.notes}
                </p>
              )}
            </div>

            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--primary-emerald)',
                background: 'rgba(46, 204, 113, 0.08)',
                border: '1px solid rgba(46, 204, 113, 0.2)',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                whiteSpace: 'nowrap',
              }}
            >
              {block.owner}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
