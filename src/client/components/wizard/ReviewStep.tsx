import React from 'react';
import type { WizardInput } from '@shared/schemas';
import { formatINR } from '@shared/currency';

interface ReviewStepProps {
  input: WizardInput;
  isGenerating: boolean;
  onGenerate: () => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({ input, isGenerating, onGenerate }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Review & Generate Your Plan
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Gemini will create a customized celebration blueprint with deterministic rupee math.
        </p>
      </div>

      <div
        style={{
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--surface-border)',
          padding: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
        }}
      >
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block' }}>
            Celebration Type
          </span>
          <span style={{ fontSize: '1.05rem', fontWeight: 600, textTransform: 'capitalize' }}>
            {input.eventType === 'wedding'
              ? '💍 Indian Wedding'
              : input.eventType === 'community'
                ? '🪔 Community Festival'
                : '🎂 Birthday / Milestone'}
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block' }}>
            Date & City
          </span>
          <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>
            📅 {input.eventDate} ({input.city})
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block' }}>
            Guests
          </span>
          <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>
            👥 {input.guestCount.toLocaleString('en-IN')} attendees
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block' }}>
            Target Budget
          </span>
          <span
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--primary-saffron)',
            }}
          >
            {formatINR(input.totalBudget)}
          </span>
        </div>

        {input.subEvents && input.subEvents.length > 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-light)',
                display: 'block',
                marginBottom: '0.25rem',
              }}
            >
              Selected Functions / Ceremonies
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {input.subEvents.map((s) => (
                <span
                  key={s}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.2rem 0.6rem',
                    background: 'rgba(194, 24, 91, 0.08)',
                    color: 'var(--primary-magenta)',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 600,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {input.theme && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block' }}>
              Theme / Vibe
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>✨ {input.theme}</span>
          </div>
        )}

        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block' }}>
              Language
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {input.language === 'hindi' ? '🇮🇳 हिंदी (Hindi)' : '🇬🇧 English'}
            </span>
          </div>

          {input.dietaryPreferences.length > 0 && (
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block' }}>
                Dietary
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                {input.dietaryPreferences.join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        aria-live="polite"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '0.5rem',
        }}
      >
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          style={{
            padding: '1rem 2.5rem',
            fontSize: '1.15rem',
            fontWeight: 700,
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background:
              'linear-gradient(135deg, var(--primary-saffron) 0%, var(--primary-magenta) 100%)',
            color: '#ffffff',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            boxShadow: '0 10px 20px -5px rgba(230, 81, 0, 0.4)',
            opacity: isGenerating ? 0.8 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          {isGenerating ? '🎉 Crafting Your Celebration Plan...' : '✨ Generate Celebration Plan'}
        </button>

        {isGenerating && (
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--primary-saffron)',
              fontWeight: 500,
            }}
          >
            Analyzing cultural traditions, vendor benchmarks, and rupee allocations...
          </p>
        )}
      </div>
    </div>
  );
};
