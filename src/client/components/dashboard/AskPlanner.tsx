import { useEffect, useState } from 'react';
import type { PlanOutput, WizardInput } from '@shared/schemas';
import { getTodayInKolkata } from '@shared/schemas';
import { localAnswer } from '@shared/advisor';
import { apiAskPlanner } from '../../lib/api';
import { useAiCall } from '../../hooks/useAiCall';
import { ThinkingTrace } from '../shared/ThinkingTrace';

interface AskPlannerProps {
  plan: PlanOutput;
  input: WizardInput;
}

export function AskPlanner({ plan, input }: AskPlannerProps) {
  const [question, setQuestion] = useState('');
  const [fallback, setFallback] = useState<string | null>(null);
  const call = useAiCall<Awaited<ReturnType<typeof apiAskPlanner>>>();
  const { reset } = call;
  useEffect(() => {
    reset();
    setFallback(null);
  }, [plan, input, reset]);

  const ask = (value: string) => {
    if (!value.trim()) return;
    setQuestion(value);
    setFallback(localAnswer(value, plan, input, getTodayInKolkata()));
    void call.run((options) => apiAskPlanner(value, input, plan, options));
  };
  const answer = call.result?.answer ?? fallback;
  const source = call.result?.source === 'gemini' ? 'Gemini' : 'Built-in Planner';
  const questions = ['What should I do next?', 'Kitna paisa bacha hai?', 'अगला काम क्या है?'];

  return (
    <div>
      <form
        className="assistant-panel__ask"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor="planner-question">Ask about budget, vendors, timing, or guests</label>
        <p className="assistant-panel__language-hint">Ask in English, हिंदी, or Hinglish.</p>
        <div className="assistant-panel__input-row">
          <input
            id="planner-question"
            value={question}
            maxLength={500}
            onChange={(event) => {
              setQuestion(event.target.value);
            }}
            placeholder="What should I do next?"
          />
          <button type="submit" disabled={!question.trim()}>
            Ask planner
          </button>
          {call.running && (
            <button type="button" onClick={call.cancel}>
              Stop
            </button>
          )}
        </div>
      </form>
      <div className="assistant-question-chips" aria-label="Suggested questions">
        {questions.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              ask(value);
            }}
          >
            {value}
          </button>
        ))}
      </div>
      <ThinkingTrace {...call} />
      {answer && (
        <div className="assistant-panel__answer" role="status">
          <strong>Assistant ({source})</strong>
          <p>{answer}</p>
        </div>
      )}
      {call.error && <p role="status">Using the built-in planner while AI is unavailable.</p>}
    </div>
  );
}
