import './ReviewStep.css';
import React from 'react';
import type { WizardInput } from '@shared/schemas';
import { formatINR } from '@shared/currency';

interface ReviewStepProps {
  input: WizardInput;
  isGenerating: boolean;
  onGenerate: () => void | Promise<void>;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({ input, isGenerating, onGenerate }) => {
  return (
    <div className={['review-step-div-1'].join(' ')}>
      <div>
        <h2 className={['review-step-h2-2'].join(' ')}>Review & Generate Your Plan</h2>
        <p className={['review-step-p-3'].join(' ')}>
          Gemini will create a customized celebration blueprint with deterministic rupee math.
        </p>
      </div>

      <div className={['review-step-div-4'].join(' ')}>
        <div>
          <span className={['review-step-span-5'].join(' ')}>Celebration Type</span>
          <span className={['review-step-span-6'].join(' ')}>
            {input.eventType === 'wedding'
              ? '💍 Indian Wedding'
              : input.eventType === 'community'
                ? '🪔 Community Festival'
                : '🎂 Birthday / Milestone'}
          </span>
        </div>

        <div>
          <span className={['review-step-span-7'].join(' ')}>Date & City</span>
          <span className={['review-step-span-8'].join(' ')}>
            📅 {input.eventDate} ({input.city})
          </span>
        </div>

        <div>
          <span className={['review-step-span-9'].join(' ')}>Guests</span>
          <span className={['review-step-span-10'].join(' ')}>
            👥 {input.guestCount.toLocaleString('en-IN')} attendees
          </span>
        </div>

        <div>
          <span className={['review-step-span-11'].join(' ')}>Target Budget</span>
          <span className={['review-step-span-12'].join(' ')}>{formatINR(input.totalBudget)}</span>
        </div>

        {input.subEvents.length > 0 && (
          <div className={['review-step-div-13'].join(' ')}>
            <span className={['review-step-span-14'].join(' ')}>
              Selected Functions / Ceremonies
            </span>
            <div className={['review-step-div-15'].join(' ')}>
              {input.subEvents.map((s) => (
                <span key={s} className={['review-step-span-16'].join(' ')}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {input.theme && (
          <div className={['review-step-div-17'].join(' ')}>
            <span className={['review-step-span-18'].join(' ')}>Theme / Vibe</span>
            <span className={['review-step-span-19'].join(' ')}>✨ {input.theme}</span>
          </div>
        )}

        <div className={['review-step-div-20'].join(' ')}>
          <div>
            <span className={['review-step-span-21'].join(' ')}>Language</span>
            <span className={['review-step-span-22'].join(' ')}>
              {input.language === 'hindi' ? '🇮🇳 हिंदी (Hindi)' : '🇬🇧 English'}
            </span>
          </div>

          {input.dietaryPreferences.length > 0 && (
            <div>
              <span className={['review-step-span-23'].join(' ')}>Dietary</span>
              <span className={['review-step-span-24'].join(' ')}>
                {input.dietaryPreferences.join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      <div aria-live="polite" className={['review-step-div-25'].join(' ')}>
        <button
          type="button"
          onClick={() => {
            void onGenerate();
          }}
          disabled={isGenerating}
          className={[
            'review-step-button-26',
            isGenerating ? 'review-step-button-26-cursor-yes' : 'review-step-button-26-cursor-no',
            isGenerating ? 'review-step-button-26-opacity-yes' : 'review-step-button-26-opacity-no',
          ].join(' ')}
        >
          {isGenerating ? '🎉 Crafting Your Celebration Plan...' : '✨ Generate Celebration Plan'}
        </button>

        {isGenerating && (
          <p className={['review-step-p-27'].join(' ')}>
            Analyzing cultural traditions, vendor benchmarks, and rupee allocations...
          </p>
        )}
      </div>
    </div>
  );
};
