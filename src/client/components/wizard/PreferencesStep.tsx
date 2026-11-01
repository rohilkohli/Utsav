import './PreferencesStep.css';
import React from 'react';
import type { FieldErrors } from './useWizardForm';
import type { OutputLanguage } from '@shared/schemas';

interface PreferencesStepProps {
  errors?: FieldErrors;
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
  errors = {},
}) => {
  return (
    <div className={['preferences-step-div-1'].join(' ')}>
      <div>
        <h2 className={['preferences-step-h2-2'].join(' ')}>Personalize your celebration vibe</h2>
        <p className={['preferences-step-p-3'].join(' ')}>
          Add themes, dietary traditions, and choose your preferred planning language.
        </p>
      </div>

      {/* Language */}
      <div>
        <p id="language-selection-label" className={['preferences-step-label-4'].join(' ')}>
          Plan Output Language:
        </p>
        <div
          role="radiogroup"
          aria-labelledby="language-selection-label"
          className={['preferences-step-div-5'].join(' ')}
        >
          <button
            type="button"
            role="radio"
            aria-checked={language === 'english'}
            onClick={() => {
              onChangeLanguage('english');
            }}
            className={[
              'preferences-step-button-6',
              language === 'english'
                ? 'preferences-step-button-6-border-yes'
                : 'preferences-step-button-6-border-no',
              language === 'english'
                ? 'preferences-step-button-6-background-yes'
                : 'preferences-step-button-6-background-no',
            ].join(' ')}
          >
            🇬🇧 English
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={language === 'hindi'}
            onClick={() => {
              onChangeLanguage('hindi');
            }}
            className={[
              'preferences-step-button-7',
              language === 'hindi'
                ? 'preferences-step-button-7-border-yes'
                : 'preferences-step-button-7-border-no',
              language === 'hindi'
                ? 'preferences-step-button-7-background-yes'
                : 'preferences-step-button-7-background-no',
            ].join(' ')}
          >
            🇮🇳 हिंदी (Hindi)
          </button>
        </div>
      </div>

      {/* Theme */}
      <div>
        <label htmlFor="theme-input" className={['preferences-step-label-8'].join(' ')}>
          Theme / Aesthetic Vibe:
        </label>
        <input
          id="theme-input"
          maxLength={300}
          aria-invalid={Boolean(errors.theme)}
          aria-describedby={errors.theme ? 'theme-error' : undefined}
          type="text"
          placeholder="e.g. Royal Marigold & Sunset Tones, Pastel Floral, Desi Bollywood, Eco-Friendly"
          value={theme}
          onChange={(e) => {
            onChangeTheme(e.target.value);
          }}
          className={['preferences-step-input-9'].join(' ')}
        />
      </div>

      {errors.theme && (
        <p id="theme-error" className="wizard-field-error">
          {errors.theme}
        </p>
      )}
      {/* Dietary */}
      <div>
        <p id="dietary-preferences-label" className={['preferences-step-label-10'].join(' ')}>
          Dietary & Catering Preferences:
        </p>
        <div className={['preferences-step-div-11'].join(' ')}>
          {DIETARY_OPTIONS.map((item) => {
            const active = dietaryPreferences.includes(item);
            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onToggleDietary(item);
                }}
                className={[
                  'preferences-step-button-12',
                  active
                    ? 'preferences-step-button-12-border-yes'
                    : 'preferences-step-button-12-border-no',
                  active
                    ? 'preferences-step-button-12-background-yes'
                    : 'preferences-step-button-12-background-no',
                  active
                    ? 'preferences-step-button-12-color-yes'
                    : 'preferences-step-button-12-color-no',
                ].join(' ')}
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
        <label htmlFor="cultural-notes" className={['preferences-step-label-13'].join(' ')}>
          Cultural Traditions & Custom Notes (Optional):
        </label>
        <textarea
          id="cultural-notes"
          maxLength={500}
          aria-invalid={Boolean(errors.culturalNotes)}
          aria-describedby={errors.culturalNotes ? 'cultural-notes-error' : undefined}
          rows={3}
          placeholder="e.g. Traditional South Indian Muhurtham at dawn, Punjabi Baraat with Dhol, Sindhi Santh rituals, etc."
          value={culturalNotes}
          onChange={(e) => {
            onChangeCulturalNotes(e.target.value);
          }}
          className={['preferences-step-textarea-14'].join(' ')}
        />
      </div>
      {errors.culturalNotes && (
        <p id="cultural-notes-error" className="wizard-field-error">
          {errors.culturalNotes}
        </p>
      )}
    </div>
  );
};
