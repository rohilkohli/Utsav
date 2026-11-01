import type { PlanOutput } from '../../shared/schemas.js';
import type { AiCallContext } from './model.js';

export interface PlanGenerationResult {
  plan: PlanOutput;
  source: 'gemini' | 'cache' | 'fallback';
  model?: string;
}
interface Subscriber {
  resolve: (result: PlanGenerationResult) => void;
  reject: (error: unknown) => void;
  notify?: (text: string) => void;
}
interface Flight {
  controller: AbortController;
  subscribers: Set<Subscriber>;
  progress?: string;
}
const inFlightPlans = new Map<string, Flight>();

function notify(subscriber: Subscriber, text: string): void {
  try {
    subscriber.notify?.(text);
  } catch {
    // A disconnected progress observer must not disrupt the other subscribers.
  }
}

/** A subscriber owns its cancellation and receives its own mutable result copy. */
function subscribe(flight: Flight, context: AiCallContext, release: () => void) {
  return new Promise<PlanGenerationResult>((resolve, reject) => {
    const fail = (error: unknown) => {
      reject(
        error instanceof Error ? error : new Error('Plan generation failed', { cause: error }),
      );
    };
    const cleanup = () => {
      flight.subscribers.delete(subscriber);
      context.signal?.removeEventListener('abort', cancel);
    };
    const subscriber: Subscriber = {
      notify: context.onProgress,
      resolve: (result) => {
        cleanup();
        try {
          resolve(structuredClone(result));
        } catch (error) {
          fail(error);
        }
      },
      reject: (error) => {
        cleanup();
        fail(error);
      },
    };
    const cancel = () => {
      subscriber.reject(new DOMException('Request cancelled', 'AbortError'));
      if (flight.subscribers.size === 0) {
        release();
        flight.controller.abort();
      }
    };
    flight.subscribers.add(subscriber);
    context.signal?.addEventListener('abort', cancel, { once: true });
    if (context.signal?.aborted) cancel();
    else if (flight.progress !== undefined) notify(subscriber, flight.progress);
  });
}

/** Share one upstream operation while keeping each HTTP request independently cancellable. */
export function sharePlanGeneration(
  key: string,
  operation: (context: AiCallContext) => Promise<PlanGenerationResult>,
  context: AiCallContext = {},
): Promise<PlanGenerationResult> {
  context.signal?.throwIfAborted();
  let flight = inFlightPlans.get(key);
  const created = !flight;
  if (!flight) {
    flight = { controller: new AbortController(), subscribers: new Set() };
    inFlightPlans.set(key, flight);
  }
  const shared = flight;
  const release = () => {
    if (inFlightPlans.get(key) === shared) inFlightPlans.delete(key);
  };
  const result = subscribe(shared, context, release);
  if (created) {
    const sharedContext: AiCallContext = {
      signal: shared.controller.signal,
      onProgress: (text) => {
        shared.progress = text;
        for (const subscriber of [...shared.subscribers]) {
          if (shared.subscribers.has(subscriber)) notify(subscriber, text);
        }
      },
    };
    void Promise.resolve()
      .then(() => {
        shared.controller.signal.throwIfAborted();
        return operation(sharedContext);
      })
      .then(
        (value) => {
          release();
          for (const subscriber of [...shared.subscribers]) subscriber.resolve(value);
        },
        (error: unknown) => {
          release();
          for (const subscriber of [...shared.subscribers]) subscriber.reject(error);
        },
      );
  }
  return result;
}
