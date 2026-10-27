import React from 'react';
import { getTodayInKolkata } from '@shared/schemas';

interface EventDetailsStepProps {
  eventDate: string;
  city: string;
  guestCount: number;
  onChangeDate: (date: string) => void;
  onChangeCity: (city: string) => void;
  onChangeGuests: (count: number) => void;
}

const POPULAR_CITIES = [
  'Mumbai',
  'Delhi NCR',
  'Bengaluru',
  'Jaipur',
  'Ahmedabad',
  'Hyderabad',
  'Kolkata',
  'Pune',
  'Goa',
  'Lucknow',
];

export const EventDetailsStep: React.FC<EventDetailsStepProps> = ({
  eventDate,
  city,
  guestCount,
  onChangeDate,
  onChangeCity,
  onChangeGuests,
}) => {
  const minDate = getTodayInKolkata();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          When and where is the celebration?
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Provide the event date, Indian host city, and expected guest count.
        </p>
      </div>

      {/* Date */}
      <div>
        <label
          htmlFor="event-date"
          style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.95rem' }}
        >
          Event Date (YYYY-MM-DD):
        </label>
        <input
          id="event-date"
          type="date"
          min={minDate}
          value={eventDate}
          onChange={(e) => onChangeDate(e.target.value)}
          required
          style={{
            width: '100%',
            maxWidth: '320px',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)',
            background: 'var(--surface-card)',
            color: 'var(--text-main)',
            fontSize: '1rem',
          }}
        />
        <span
          style={{
            display: 'block',
            fontSize: '0.8rem',
            color: 'var(--text-light)',
            marginTop: '0.25rem',
          }}
        >
          Date is evaluated in Asia/Kolkata timezone.
        </span>
      </div>

      {/* City */}
      <div>
        <label
          htmlFor="event-city"
          style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.95rem' }}
        >
          Host City in India:
        </label>
        <input
          id="event-city"
          type="text"
          placeholder="e.g. Jaipur, Bengaluru, Mumbai"
          value={city}
          onChange={(e) => onChangeCity(e.target.value)}
          required
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)',
            background: 'var(--surface-card)',
            color: 'var(--text-main)',
            fontSize: '1rem',
            marginBottom: '0.5rem',
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginRight: '0.25rem' }}>
            Popular:
          </span>
          {POPULAR_CITIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChangeCity(c)}
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--surface-border)',
                background: city === c ? 'var(--primary-saffron)' : 'rgba(0,0,0,0.03)',
                color: city === c ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Guest Count */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            maxWidth: '400px',
            marginBottom: '0.5rem',
          }}
        >
          <label htmlFor="guest-count" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            Expected Guest Count:
          </label>
          <span
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--primary-saffron)',
            }}
          >
            {guestCount.toLocaleString('en-IN')} guests
          </span>
        </div>

        <input
          id="guest-count"
          type="range"
          min={0}
          max={5000}
          step={guestCount > 500 ? 50 : 10}
          value={Math.min(5000, guestCount)}
          onChange={(e) => onChangeGuests(parseInt(e.target.value, 10))}
          style={{
            width: '100%',
            maxWidth: '400px',
            accentColor: 'var(--primary-saffron)',
            marginBottom: '0.75rem',
          }}
        />

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Or type exact count:
          </span>
          <input
            type="number"
            min={0}
            max={10000}
            value={guestCount}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              onChangeGuests(isNaN(val) ? 0 : Math.min(10000, Math.max(0, val)));
            }}
            aria-label="Exact guest count"
            style={{
              width: '100px',
              padding: '0.4rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--surface-border)',
              background: 'var(--surface-card)',
              color: 'var(--text-main)',
              fontSize: '0.9rem',
            }}
          />
        </div>
      </div>
    </div>
  );
};
