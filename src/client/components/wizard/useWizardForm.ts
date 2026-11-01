import { useState } from 'react';
import {
  COMMUNITY_SUB_EVENTS,
  getTodayInKolkata,
  WEDDING_SUB_EVENTS,
  wizardInputSchema,
} from '@shared/schemas';
import type { EventType, WizardInput } from '@shared/schemas';

export type FieldErrors = Partial<Record<keyof WizardInput, string>>;
const stepFields: Record<number, (keyof WizardInput)[]> = {
  1: ['subEvents'],
  2: ['eventDate', 'city', 'guestCount'],
  3: ['totalBudget'],
  4: ['theme', 'dietaryPreferences', 'culturalNotes', 'language'],
};
export function useWizardForm() {
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [formData, setFormData] = useState<WizardInput>({
    eventType: 'wedding',
    subEvents: [...WEDDING_SUB_EVENTS],
    eventDate: getTodayInKolkata(),
    city: 'Jaipur',
    guestCount: 300,
    totalBudget: 2_500_000,
    theme: 'Royal Marigold & Sunset Tones',
    dietaryPreferences: ['Pure Vegetarian (No Onion/Garlic)', 'Live Chaat & Street Food'],
    culturalNotes: 'Traditional North Indian rituals',
    language: 'english',
  });
  const update = <K extends keyof WizardInput>(key: K, value: WizardInput[K]) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };
  const validate = (all = false) => {
    const result = wizardInputSchema.safeParse(formData);
    const next: FieldErrors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof WizardInput;
        if (all || stepFields[step]?.includes(key)) next[key] = issue.message;
      }
    }
    setErrors(next);
    if (Object.keys(next).length) setValidationAttempt((previous) => previous + 1);
    return Object.keys(next).length === 0;
  };
  const next = () => {
    if (validate()) setStep((previous) => previous + 1);
  };
  const changeType = (eventType: EventType) => {
    const subEvents =
      eventType === 'wedding'
        ? [...WEDDING_SUB_EVENTS]
        : eventType === 'community'
          ? [...COMMUNITY_SUB_EVENTS]
          : [];
    const totalBudget =
      eventType === 'wedding' ? 2_500_000 : eventType === 'community' ? 300_000 : 50_000;
    setFormData((previous) => ({ ...previous, eventType, subEvents, totalBudget }));
    setErrors({});
  };
  const toggle = (key: 'subEvents' | 'dietaryPreferences', item: string) => {
    update(
      key,
      formData[key].includes(item)
        ? formData[key].filter((value) => value !== item)
        : [...formData[key], item],
    );
  };
  const apply = (input: WizardInput) => {
    setFormData(input);
    setErrors({});
    setStep(5);
  };
  return {
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
  };
}
