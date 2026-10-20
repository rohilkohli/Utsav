import React from 'react';
import type { OutputLanguage } from '@shared/schemas';

interface PreferencesStepProps {
  theme: string;
  dietaryPreferences: string[];
  culturalNotes: string;
  language: OutputLanguage;
  onChangeTheme: (theme: string) => void;
  onToggleDietary: (item: string) => void;
  onChangeCulturalNotes: (notes: string) => void;
  onChangeLanguage: (lang: OutputLanguage) => void;
}

const DIETARY_OPTIONS = [
  'Pure Vegetarian (No Onion/Garlic)',
  'Jain Options Mandatory',
  'Non-Vegetarian Included',
  'Vegan & Plant-based',
  'Live Chaat & Street Food',
  'Regional Sweets & Dessert Bar',
];

export const PreferencesStep: React.FC<PreferencesStepProps> = ({
  theme,
  dietaryPreferences,
  culturalNotes,
  language,
  onChangeTheme,
  onToggleDietary,
  onChangeCulturalNotes,
  onChangeLanguage,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Personalize your celebration vibe
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Add themes, dietary traditions, and choose your preferred planning language.
        </p>
      </div>

      {/* Language */}
      <div>
        <label
          id="language-selection-label"
          style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.95rem' }}
        >
          Plan Output Language:
        </label>
        <div role="radiogroup" aria-labelledby="language-selection-label" style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            role="radio"
            aria-checked={language === 'english'}
            onClick={() => onChangeLanguage('english')}
            style={{
              flex: 1,
              maxWidth: '180px',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              border: language === 'english'
                ? '2px solid var(--primary-saffron)'
                : '1px solid var(--surface-border)',
              background: language === 'english' ? 'var(--surface-card-hover)' : 'var(--surface-card)',
              color: 'var(--text-main)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🇬🇧 English
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={language === 'hindi'}
            onClick={() => onChangeLanguage('hindi')}
            style={{
              flex: 1,
              maxWidth: '180px',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              border: language === 'hindi'
                ? '2px solid var(--primary-saffron)'
                : '1px solid var(--surface-border)',
              background: language === 'hindi' ? 'var(--surface-card-hover)' : 'var(--surface-card)',
              color: 'var(--text-main)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🇮🇳 हिंदी (Hindi)
          </button>
        </div>
      </div>

      {/* Theme */}
      <div>
        <label
          htmlFor="theme-input"
          style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.95rem' }}
        >
          Theme / Aesthetic Vibe:
        </label>
        <input
          id="theme-input"
          type="text"
          placeholder="e.g. Royal Marigold & Sunset Tones, Pastel Floral, Desi Bollywood, Eco-Friendly"
          value={theme}
          onChange={(e) => onChangeTheme(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)',
            background: 'var(--surface-card)',
            color: 'var(--text-main)',
            fontSize: '1rem',
          }}
        />
      </div>

      {/* Dietary */}
      <div>
        <label
          id="dietary-preferences-label"
          style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.95rem' }}
        >
          Dietary & Catering Preferences:
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {DIETARY_OPTIONS.map((item) => {
            const active = dietaryPreferences.includes(item);
            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleDietary(item)}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-full)',
                  border: active ? '1px solid var(--primary-emerald)' : '1px solid var(--surface-border)',
                  background: active ? 'var(--primary-emerald)' : 'var(--surface-card)',
                  color: active ? '#ffffff' : 'var(--text-main)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {active ? '✓ ' : '+ '}
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cultural Notes */}
      <div>
        <label
          htmlFor="cultural-notes"
          style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.95rem' }}
        >
          Cultural Traditions & Custom Notes (Optional):
        </label>
        <textarea
          id="cultural-notes"
          rows={3}
          placeholder="e.g. Traditional South Indian Muhurtham at dawn, Punjabi Baraat with Dhol, Sindhi Santh rituals, etc."
          value={culturalNotes}
          onChange={(e) => onChangeCulturalNotes(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '600px',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)',
            background: 'var(--surface-card)',
            color: 'var(--text-main)',
            fontSize: '0.95rem',
            resize: 'vertical',
          }}
        />
      </div>
    </div>
  );
};
