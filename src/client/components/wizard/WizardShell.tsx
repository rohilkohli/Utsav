import './WizardShell.css';
import type { WizardInput } from '@shared/schemas';
import { EventTypeStep } from './EventTypeStep';
import { EventDetailsStep } from './EventDetailsStep';
import { BudgetStep } from './BudgetStep';
import { PreferencesStep } from './PreferencesStep';
import { ReviewStep } from './ReviewStep';
import { DescribeEvent } from './DescribeEvent';
import { ErrorSummary } from './ErrorSummary';
import { WizardProgress } from './WizardProgress';
import { useWizardForm } from './useWizardForm';

interface WizardShellProps {
  onGeneratePlan: (input: WizardInput) => Promise<void>;
  isGenerating: boolean;
  onInstantCreate?: (input: WizardInput) => Promise<void> | void;
}
export function WizardShell({ onGeneratePlan, isGenerating, onInstantCreate }: WizardShellProps) {
  const {
    step,
    setStep,
    formData,
    errors,
    validationAttempt,
    update,
    validate,
    next,
    changeType,
    toggle,
    apply,
  } = useWizardForm();
  const generate = async () => {
    if (validate(true)) await onGeneratePlan(formData);
  };
  return (
    <div className="wizard-shell-div-1">
      <DescribeEvent
        onApply={apply}
        onInstantCreate={async (input) => {
          await (onInstantCreate ?? onGeneratePlan)(input);
        }}
      />
      <WizardProgress step={step} />
      <ErrorSummary errors={errors} focusKey={validationAttempt} />
      <div className="wizard-shell-div-9">
        {step === 1 && (
          <EventTypeStep
            eventType={formData.eventType}
            subEvents={formData.subEvents}
            onChangeType={changeType}
            onToggleSubEvent={(item) => {
              toggle('subEvents', item);
            }}
            errors={errors}
          />
        )}
        {step === 2 && (
          <EventDetailsStep
            eventDate={formData.eventDate}
            city={formData.city}
            guestCount={formData.guestCount}
            onChangeDate={(value) => {
              update('eventDate', value);
            }}
            onChangeCity={(value) => {
              update('city', value);
            }}
            onChangeGuests={(value) => {
              update('guestCount', value);
            }}
            errors={errors}
          />
        )}
        {step === 3 && (
          <BudgetStep
            eventType={formData.eventType}
            totalBudget={formData.totalBudget}
            onChangeBudget={(value) => {
              update('totalBudget', value);
            }}
            errors={errors}
          />
        )}
        {step === 4 && (
          <PreferencesStep
            errors={errors}
            theme={formData.theme}
            dietaryPreferences={formData.dietaryPreferences}
            culturalNotes={formData.culturalNotes}
            language={formData.language}
            onChangeTheme={(value) => {
              update('theme', value);
            }}
            onToggleDietary={(item) => {
              toggle('dietaryPreferences', item);
            }}
            onChangeCulturalNotes={(value) => {
              update('culturalNotes', value);
            }}
            onChangeLanguage={(value) => {
              update('language', value);
            }}
          />
        )}
        {step === 5 && (
          <ReviewStep input={formData} isGenerating={isGenerating} onGenerate={generate} />
        )}
      </div>
      <div className="wizard-shell-div-10">
        {step > 1 ? (
          <button
            type="button"
            className="wizard-shell-button-11"
            onClick={() => {
              setStep((previous) => previous - 1);
            }}
            disabled={isGenerating}
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        {step < 5 && (
          <button type="button" className="wizard-continue" onClick={next} disabled={isGenerating}>
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}
