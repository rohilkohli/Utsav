import { useEffect, useRef } from 'react';
import type { FieldErrors } from './useWizardForm';

const targets: Record<string, string> = {
  subEvents: 'event-ceremonies',
  eventDate: 'event-date',
  city: 'event-city',
  guestCount: 'exact-guest-count',
  totalBudget: 'total-budget-input',
  theme: 'theme-input',
  culturalNotes: 'cultural-notes',
};
export function ErrorSummary({ errors, focusKey = 0 }: { errors: FieldErrors; focusKey?: number }) {
  const summary = useRef<HTMLDivElement>(null);
  const entries = Object.entries(errors).filter((entry): entry is [string, string] =>
    Boolean(entry[1]),
  );
  const hasErrors = Object.values(errors).some(Boolean);
  useEffect(() => {
    if (hasErrors) summary.current?.focus();
  }, [focusKey, hasErrors]);
  if (!entries.length) return null;
  return (
    <div ref={summary} role="alert" tabIndex={-1} className="wizard-error-summary">
      <h2>Please check these details</h2>
      <ul>
        {entries.map(([field, message]) => (
          <li key={field}>
            <a
              href={`#${targets[field] ?? field}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(targets[field] ?? field)?.focus();
              }}
            >
              {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
