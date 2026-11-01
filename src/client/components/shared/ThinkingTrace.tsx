import type { AiCallState } from '../../hooks/useAiCall';
import './ai-progress.css';

type TraceState = Pick<AiCallState<unknown>, 'running' | 'steps' | 'model' | 'elapsedSeconds'>;
type ThinkingTraceProps = (TraceState | { state: TraceState }) & { label?: string };

/** Public operation summaries, never private model reasoning. */
export function ThinkingTrace(props: ThinkingTraceProps) {
  const { running, steps, model, elapsedSeconds } = 'state' in props ? props.state : props;
  const { label = 'Gemini' } = props;
  if (!running && steps.length === 0 && !model) return null;
  const content = (
    <ol className="thinking-trace__steps">
      {steps.map((step, index) => (
        <li key={`${index}-${step}`}>{step}</li>
      ))}
    </ol>
  );
  return (
    <div className="thinking-trace" aria-label="Assistant progress">
      <p role="status" className="thinking-trace__status">
        {running
          ? `${label} is thinking… ${elapsedSeconds}s`
          : `Answered by ${model ?? 'Built-in Planner'}`}
      </p>
      {running ? (
        content
      ) : (
        <details>
          <summary>How this answer was prepared ({steps.length} steps)</summary>
          {content}
        </details>
      )}
    </div>
  );
}
