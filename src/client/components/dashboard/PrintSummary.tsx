import React from 'react';
import { getTodayInKolkata, type PlanOutput, type WizardInput } from '@shared/schemas';
import { usePlanSchedule } from './usePlanSchedule';
import { formatINR } from '@shared/currency';

interface PrintSummaryProps {
  plan: PlanOutput;
  input: WizardInput;
  today?: string;
}

export const PrintSummary: React.FC<PrintSummaryProps> = ({
  plan,
  input,
  today = getTodayInKolkata(),
}) => {
  const schedule = usePlanSchedule(plan, input.eventDate, today);
  const actual = plan.budget.reduce((sum, category) => sum + category.actual, 0);
  return (
    <section className="print-summary" aria-labelledby="print-summary-title">
      <h2 id="print-summary-title">Utsav Celebration Summary</h2>
      <p>
        {input.eventType} in {input.city} · {input.eventDate} ·{' '}
        {input.guestCount.toLocaleString('en-IN')} guests
      </p>
      <p>{plan.summary}</p>
      <h3>Budget</h3>
      <ul>
        {plan.budget.map((category) => (
          <li key={category.id}>
            {category.category}: {formatINR(category.actual)}
          </li>
        ))}
      </ul>
      <p>
        <strong>Total planned spend:</strong> {formatINR(actual)} of {formatINR(input.totalBudget)}
      </p>
      <h3>Timeline</h3>
      {schedule.error && <p role="alert">{schedule.error}</p>}
      <ul>
        {schedule.tasks.map((milestone) => (
          <li key={milestone.id}>
            {milestone.effectiveDate}: {milestone.title}
          </li>
        ))}
      </ul>
    </section>
  );
};
