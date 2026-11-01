// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAiCall } from '../hooks/useAiCall';
import type { AiRequestOptions } from '../lib/apiTransport';

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
afterEach(() => vi.useRealTimers());

describe('useAiCall lifecycle', () => {
  it('shows elapsed seconds, progress, selected model and the final result', async () => {
    vi.useFakeTimers();
    const pending = deferred<string>();
    const { result } = renderHook(() => useAiCall<string>());
    let options: AiRequestOptions | undefined;
    let completion: Promise<string | undefined> | undefined;
    act(() => {
      completion = result.current.run((value) => {
        options = value;
        return pending.promise;
      });
    });
    expect(result.current.running).toBe(true);
    act(() => {
      options?.onProgress?.({ type: 'thought', text: 'Checking the plan' });
      options?.onProgress?.({ type: 'model', model: 'gemini-test' });
      vi.advanceTimersByTime(2100);
    });
    expect(result.current.steps).toEqual(['Checking the plan']);
    expect(result.current.model).toBe('gemini-test');
    expect(result.current.elapsedSeconds).toBe(2);
    await act(async () => {
      pending.resolve('new answer');
      await completion;
    });
    expect(result.current.result).toBe('new answer');
    expect(result.current.running).toBe(false);
  });

  it('aborts a previous request and ignores its late answer and late progress', async () => {
    const old = deferred<string>();
    const latest = deferred<string>();
    const { result } = renderHook(() => useAiCall<string>());
    let oldOptions: AiRequestOptions | undefined;
    let oldCall: Promise<string | undefined> | undefined;
    let nextCall: Promise<string | undefined> | undefined;
    act(() => {
      oldCall = result.current.run((options) => {
        oldOptions = options;
        return old.promise;
      });
    });
    act(() => {
      nextCall = result.current.run(() => latest.promise);
    });
    expect(oldOptions?.signal?.aborted).toBe(true);
    await act(async () => {
      latest.resolve('latest');
      await nextCall;
      oldOptions?.onProgress?.({ type: 'thought', text: 'Stale progress' });
      old.resolve('stale');
      await oldCall;
    });
    expect(result.current.result).toBe('latest');
    expect(result.current.steps).toEqual([]);
  });

  it('cancels and resets without presenting an abort as an application error', async () => {
    const pending = deferred<string>();
    const { result } = renderHook(() => useAiCall<string>());
    let call: Promise<string | undefined> | undefined;
    act(() => {
      call = result.current.run(() => pending.promise);
    });
    act(() => {
      result.current.cancel();
    });
    await act(async () => {
      pending.reject(new DOMException('canceled', 'AbortError'));
      await call;
    });
    expect(result.current.running).toBe(false);
    expect(result.current.error).toBeNull();
    act(() => {
      result.current.reset();
    });
    expect(result.current).toMatchObject({
      result: null,
      steps: [],
      model: null,
      elapsedSeconds: 0,
    });
  });

  it('reports real failures and clears them for a later successful request', async () => {
    const { result } = renderHook(() => useAiCall<string>());
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('Unavailable')));
    });
    expect(result.current.error).toBe('Unavailable');
    const nonError = deferred<string>();
    nonError.reject('offline');
    await act(async () => {
      await result.current.run(() => nonError.promise);
    });
    expect(result.current.error).toContain('assistant is unavailable');
    await act(async () => {
      await result.current.run(() => Promise.resolve('recovered'));
    });
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBe('recovered');
  });

  it('aborts on unmount and discards results that arrive after unmount', async () => {
    const pending = deferred<string>();
    const { result, unmount } = renderHook(() => useAiCall<string>());
    let signal: AbortSignal | undefined;
    let call: Promise<string | undefined> | undefined;
    act(() => {
      call = result.current.run((options) => {
        signal = options.signal;
        return pending.promise;
      });
    });
    unmount();
    expect(signal?.aborted).toBe(true);
    pending.resolve('late');
    expect(await call).toBeUndefined();
  });
});
