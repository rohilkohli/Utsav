import React, { useState } from 'react';
import type { PlanOutput, WizardInput } from '@shared/schemas';
import { getTodayInKolkata } from '@shared/schemas';
import { localAnswer } from '@shared/advisor';
import { planInsights, type InsightTab, type PlanInsight } from '@shared/insights';
import { apiAskPlanner, apiReviewPlan } from '../../lib/api';

interface AssistantPanelProps {
  plan: PlanOutput;
  input: WizardInput;
  onNavigate: (tab: InsightTab) => void;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({ plan, input, onNavigate }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [review, setReview] = useState<{ strengths: string[]; risks: string[]; suggestions: string[]; overallScore: number; source: string } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const insights = planInsights(plan, input, getTodayInKolkata());

  const ask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    setAnswer(localAnswer(question, plan, input, getTodayInKolkata()));
    void apiAskPlanner(question, input, plan)
      .then((response) => setAnswer(response.answer))
      .catch(() => undefined);
  };

  const requestReview = () => {
    setReviewLoading(true);
    void apiReviewPlan(input, plan)
      .then((response) => setReview({ ...response.review, source: response.source }))
      .catch(() => setAnswer('The built-in planner is available, but the AI review is currently unavailable.'))
      .finally(() => setReviewLoading(false));
  };

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
        <div className="assistant-panel__insights" aria-label="Plan insights">
          {insights.slice(0, 3).map((insight: PlanInsight) => (
            <button
              key={insight.id}
              type="button"
              className={`assistant-insight assistant-insight--${insight.severity}`}
              onClick={() => onNavigate(insight.tab)}
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
      <form className="assistant-panel__ask" onSubmit={ask}>
        <label htmlFor="planner-question">Ask about budget, vendors, timing, or guests</label>
        <div className="assistant-panel__input-row">
          <input
            id="planner-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What should I do next?"
          />
          <button type="submit">Ask planner</button>
        </div>
      </form>
      <button type="button" className="assistant-review-button" onClick={requestReview} disabled={reviewLoading}>
        {reviewLoading ? 'Reviewing plan…' : 'Ask AI for a Plan Review'}
      </button>
      {review && (
        <details className="assistant-review" open>
          <summary>Plan review · {review.overallScore}/10 · Assistant ({review.source})</summary>
          <strong>Strengths</strong>
          <ul>{review.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
          <strong>Risks</strong>
          <ul>{review.risks.map((item) => <li key={item}>{item}</li>)}</ul>
          <strong>Suggestions</strong>
          <ul>{review.suggestions.map((item) => <li key={item}>{item}</li>)}</ul>
        </details>
      )}
      {answer && (
        <p className="assistant-panel__answer" role="status">
          {answer}
        </p>
      )}
    </section>
  );
};
