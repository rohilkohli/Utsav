import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiRequestOptions } from '../lib/apiTransport';

export interface AiCallState<T> {
  result: T | null;
  error: string | null;
  running: boolean;
  steps: string[];
  model: string | null;
  elapsedSeconds: number;
}

const initialState = <T>(): AiCallState<T> => ({
  result: null,
  error: null,
  running: false,
  steps: [],
  model: null,
  elapsedSeconds: 0,
});

/** Cancels stale calls and only commits responses from the latest request. */
export function useAiCall<T>() {
  const [state, setState] = useState<AiCallState<T>>(initialState<T>);
  const controllerRef = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const startedAt = useRef(0);
  const mounted = useRef(true);

  const cancel = useCallback(() => {
    sequence.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (mounted.current) setState((previous) => ({ ...previous, running: false }));
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current += 1;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!state.running) return;
    const timer = setInterval(() => {
      setState((previous) => ({
        ...previous,
        elapsedSeconds: Math.floor((Date.now() - startedAt.current) / 1000),
      }));
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [state.running]);

  const run = useCallback(
    async (operation: (options: AiRequestOptions) => Promise<T>): Promise<T | undefined> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const requestId = ++sequence.current;
      startedAt.current = Date.now();
      setState({ ...initialState<T>(), running: true });
      const current = () =>
        mounted.current && requestId === sequence.current && !controller.signal.aborted;
      try {
        const result = await operation({
          signal: controller.signal,
          onProgress: (progress) => {
            if (!current()) return;
            setState((previous) =>
              progress.type === 'model'
                ? { ...previous, model: progress.model }
                : { ...previous, steps: [...previous.steps, progress.text].slice(-100) },
            );
          },
        });
        if (!current()) return;
        setState((previous) => ({ ...previous, result, running: false }));
        return result;
      } catch (error) {
        if (current()) {
          setState((previous) => ({
            ...previous,
            running: false,
            error:
              error instanceof Error
                ? error.message
                : 'The assistant is unavailable. Please try again.',
          }));
        }
        return undefined;
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    cancel();
    if (mounted.current) setState(initialState<T>());
  }, [cancel]);

  return { ...state, run, reset, cancel };
}
