import type { PlanOutput, WizardInput } from '@shared/schemas';
import { formatINR } from '@shared/currency';
import { lazy, Suspense } from 'react';
const RunSheetTab = lazy(() =>
  import('./RunSheetTab').then((module) => ({ default: module.RunSheetTab })),
);
import type { TabType } from './DashboardShell';
export function ReadOnlyPanel({
  tab,
  plan,
  input,
}: {
  tab: TabType;
  plan: PlanOutput;
  input: WizardInput;
}) {
  return (
    <div className="dashboard-stack">
      {tab === 'budget' && (
        <section className="dashboard-card">
          <h2>Budget Planner</h2>
          <p>Target Budget: {formatINR(input.totalBudget)}</p>
          <ul>
            {plan.budget.map((category) => (
              <li key={category.id}>
                {category.category}: {formatINR(category.actual)} · Allocated:{' '}
                {formatINR(category.amount)}
                {category.verified && ' · Verified quotation'}
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === 'timeline' && (
        <section className="dashboard-card">
          <h2>Timeline & Milestones</h2>
          <ol>
            {plan.timeline.map((milestone) => (
              <li key={milestone.id}>
                {milestone.date}: {milestone.title} · {milestone.completed ? 'Done' : 'To do'}
                {milestone.assignee && ` · ${milestone.assignee}`}
              </li>
            ))}
          </ol>
        </section>
      )}
      {tab === 'vendors' && (
        <section className="dashboard-card">
          <h2>Vendor Checklist</h2>
          <ul>
            {plan.vendors.map((vendor) => (
              <li key={vendor.id}>
                {vendor.category}: {vendor.status} · {formatINR(vendor.quotedAmount)}
                <ul>
                  {vendor.questionsToAsk.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === 'ideas' && (
        <section className="dashboard-card">
          <h2>Personalized Ideas</h2>
          {plan.ideas.map((idea) => (
            <article key={idea.id}>
              <h3>{idea.title}</h3>
              <p>{idea.description}</p>
            </article>
          ))}
        </section>
      )}
      {tab === 'runsheet' && (
        <Suspense fallback={<p role="status">Loading run sheet…</p>}>
          <RunSheetTab eventType={input.eventType} eventDate={input.eventDate} />
        </Suspense>
      )}
    </div>
  );
}
