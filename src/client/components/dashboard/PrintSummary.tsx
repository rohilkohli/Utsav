import React from 'react';
import type { PlanOutput, WizardInput } from '@shared/schemas';
import { formatINR } from '@shared/currency';

interface PrintSummaryProps {
  plan: PlanOutput;
  input: WizardInput;
}

export const PrintSummary: React.FC<PrintSummaryProps> = ({ plan, input }) => {
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
      <ul>
        {plan.timeline.map((milestone) => (
          <li key={milestone.id}>
            {milestone.date}: {milestone.title}
          </li>
        ))}
      </ul>
    </section>
  );
};
