import { useEffect, useMemo, useState } from 'react';
import type { PlanOutput, WizardInput } from '@shared/schemas';
import { getTodayInKolkata } from '@shared/schemas';
import { planInsights, type InsightTab } from '@shared/insights';
import { apiReviewPlan } from '../../lib/api';
import { useAiCall } from '../../hooks/useAiCall';
import { ThinkingTrace } from '../shared/ThinkingTrace';
import { AskPlanner } from './AskPlanner';

interface AssistantPanelProps {
  plan: PlanOutput;
  input: WizardInput;
  onNavigate: (tab: InsightTab) => void;
}

export function AssistantPanel({ plan, input, onNavigate }: AssistantPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const call = useAiCall<Awaited<ReturnType<typeof apiReviewPlan>>>();
  const { reset } = call;
  const today = getTodayInKolkata();
  const insights = useMemo(() => planInsights(plan, input, today), [plan, input, today]);
  useEffect(() => {
    reset();
  }, [plan, input, reset]);

  return (
    <section aria-labelledby="assistant-title" className="assistant-panel">
      <div className="assistant-panel__header">
        <div>
          <span className="eyebrow">Planning assistant</span>
          <h2 id="assistant-title">Your plan, at a glance</h2>
        </div>
        <span className="assistant-panel__source">Assistant (Built-in Planner)</span>
      </div>
      {insights.length > 0 ? (
        <div className="assistant-panel__insights" aria-label="Plan insights" id="plan-insights">
          {(expanded ? insights : insights.slice(0, 3)).map((insight) => (
            <button
              key={insight.id}
              type="button"
              className={`assistant-insight assistant-insight--${insight.severity}`}
              onClick={() => {
                onNavigate(insight.tab);
              }}
            >
              <strong>{insight.severity}</strong>
              <span>{insight.message}</span>
              <span aria-hidden="true">View</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="assistant-panel__empty">Your plan has no urgent issues today.</p>
      )}
      {insights.length > 3 && (
        <button
          type="button"
          className="assistant-show-insights"
          aria-expanded={expanded}
          aria-controls="plan-insights"
          onClick={() => {
            setExpanded((previous) => !previous);
          }}
        >
          {expanded ? 'Show top three insights' : `Show all ${insights.length} insights`}
        </button>
      )}
      <AskPlanner plan={plan} input={input} />
      <button
        type="button"
        className="assistant-review-button"
        onClick={() => {
          void call.run((options) => apiReviewPlan(input, plan, options));
        }}
        disabled={call.running}
      >
        {call.running ? 'Reviewing plan…' : 'Ask AI for a Plan Review'}
      </button>
      {call.running && (
        <button type="button" onClick={call.cancel}>
          Cancel review
        </button>
      )}
      <ThinkingTrace {...call} />
      {call.error && (
        <p role="status">
          Plan review is currently unavailable. Your live plan insights remain available.
        </p>
      )}
      {call.result && (
        <details className="assistant-review" open>
          <summary>
            Plan review · {call.result.review.overallScore}/10 · Assistant (
            {call.result.source === 'gemini' ? 'Gemini' : 'Built-in Planner'})
          </summary>
          {(['strengths', 'risks', 'suggestions'] as const).map((section) => (
            <div key={section}>
              <h3>
                {section.charAt(0).toUpperCase()}
                {section.slice(1)}
              </h3>
              <ul>
                {call.result?.review[section].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
