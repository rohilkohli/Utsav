import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiCallContext } from '../services/model.js';
import {
  sharePlanGeneration,
  type PlanGenerationResult,
} from '../services/sharedPlanGeneration.js';
import { deferred, planResult } from './planConcurrencyFixture.js';

afterEach(() => vi.restoreAllMocks());

describe('Shared plan generation', () => {
  it('shares results, replays progress for late subscribers, and isolates mutable copies', async () => {
    const gate = deferred<PlanGenerationResult>();
    const operation = vi.fn((_context: AiCallContext) => gate.promise);
    const progress = vi.fn();
    const first = sharePlanGeneration('shared-success', operation, {
      onProgress: () => {
        throw new Error('Observer disconnected');
      },
    });
    await Promise.resolve();
    const upstream = operation.mock.calls[0]?.[0];
    upstream?.onProgress?.('Preparing');
    const second = sharePlanGeneration('shared-success', operation, { onProgress: progress });
    const third = sharePlanGeneration('shared-success', operation);
    expect(progress).toHaveBeenCalledExactlyOnceWith('Preparing');
    upstream?.onProgress?.('Checked');
    const result = planResult();
    gate.resolve(result);
    const [a, b, c] = await Promise.all([first, second, third]);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(progress.mock.calls).toEqual([['Preparing'], ['Checked']]);
    for (const category of a.plan.budget) category.amount = 1;
    expect(b).toEqual(result);
    expect(c).toEqual(result);
    expect(a.plan).not.toBe(b.plan);
    const next = vi.fn(() => Promise.resolve(result));
    await sharePlanGeneration('shared-success', next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects all subscribers on failure and allows the same key to retry', async () => {
    const gate = deferred<PlanGenerationResult>();
    const operation = vi.fn(() => gate.promise);
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const first = sharePlanGeneration('shared-failure', operation, {
      signal: controller.signal,
    });
    const second = sharePlanGeneration('shared-failure', operation);
    const rejected = Promise.allSettled([first, second]);
    const error = new Error('Invalid model output');
    gate.reject(error);
    expect(await rejected).toEqual([
      { status: 'rejected', reason: error },
      { status: 'rejected', reason: error },
    ]);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    const result = planResult();
    await expect(
      sharePlanGeneration('shared-failure', () => Promise.resolve(result)),
    ).resolves.toEqual(result);
  });

  it('cancels one caller without aborting the upstream operation or notifying it again', async () => {
    const gate = deferred<PlanGenerationResult>();
    const operation = vi.fn((_context: AiCallContext) => gate.promise);
    const controller = new AbortController();
    const firstProgress = vi.fn();
    const secondProgress = vi.fn();
    const first = sharePlanGeneration('shared-cancel-one', operation, {
      signal: controller.signal,
      onProgress: firstProgress,
    });
    const second = sharePlanGeneration('shared-cancel-one', operation, {
      onProgress: secondProgress,
    });
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    const upstream = operation.mock.calls[0]?.[0];
    controller.abort();
    await rejected;
    expect(upstream?.signal?.aborted).toBe(false);
    upstream?.onProgress?.('Still working');
    gate.resolve(planResult());
    await second;
    expect(firstProgress).not.toHaveBeenCalled();
    expect(secondProgress).toHaveBeenCalledExactlyOnceWith('Still working');
  });

  it('aborts upstream only after the last caller leaves and isolates an immediate replacement', async () => {
    const abandoned = deferred<PlanGenerationResult>();
    const operation = vi.fn((_context: AiCallContext) => abandoned.promise);
    const a = new AbortController();
    const b = new AbortController();
    const first = sharePlanGeneration('shared-cancel-all', operation, { signal: a.signal });
    const second = sharePlanGeneration('shared-cancel-all', operation, { signal: b.signal });
    const rejected = Promise.allSettled([first, second]);
    await Promise.resolve();
    const upstream = operation.mock.calls[0]?.[0];
    a.abort();
    expect(upstream?.signal?.aborted).toBe(false);
    b.abort();
    expect(upstream?.signal?.aborted).toBe(true);
    expect((await rejected).every((result) => result.status === 'rejected')).toBe(true);

    const replacement = deferred<PlanGenerationResult>();
    const retry = vi.fn(() => replacement.promise);
    const third = sharePlanGeneration('shared-cancel-all', retry);
    await Promise.resolve();
    abandoned.resolve(planResult());
    await Promise.resolve();
    await Promise.resolve();
    const fourth = sharePlanGeneration('shared-cancel-all', retry);
    replacement.resolve(planResult());
    await Promise.all([third, fourth]);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('does not begin upstream work for an already cancelled caller or a synchronous cancellation', async () => {
    const operation = vi.fn(() => Promise.resolve(planResult()));
    const aborted = new AbortController();
    aborted.abort();
    expect(() =>
      sharePlanGeneration('already-cancelled', operation, { signal: aborted.signal }),
    ).toThrow();
    const controller = new AbortController();
    const pending = sharePlanGeneration('cancel-before-start', operation, {
      signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    await Promise.resolve();
    expect(operation).not.toHaveBeenCalled();
  });

  it('handles a signal cancelled while its listener is being registered', async () => {
    const controller = new AbortController();
    const register = controller.signal.addEventListener.bind(controller.signal);
    vi.spyOn(controller.signal, 'addEventListener').mockImplementation(
      (...args: Parameters<AbortSignal['addEventListener']>) => {
        controller.abort();
        register(...args);
      },
    );
    const operation = vi.fn(() => Promise.resolve(planResult()));
    await expect(
      sharePlanGeneration('cancel-on-registration', operation, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(operation).not.toHaveBeenCalled();
  });

  it('isolates a result-copy failure from other subscribers', async () => {
    const result = planResult();
    const gate = deferred<PlanGenerationResult>();
    const first = sharePlanGeneration('copy-failure', () => gate.promise);
    const second = sharePlanGeneration('copy-failure', () => gate.promise);
    const rejected = expect(first).rejects.toThrow('Cannot clone');
    vi.spyOn(globalThis, 'structuredClone').mockImplementationOnce(() => {
      throw new Error('Cannot clone');
    });
    gate.resolve(result);
    await rejected;
    await expect(second).resolves.toEqual(result);
  });

  it('turns non-Error upstream rejections into an Error while preserving their cause', async () => {
    const gate = deferred<PlanGenerationResult>();
    const result = sharePlanGeneration('non-error-rejection', () => gate.promise);
    gate.reject('Unexpected model failure');
    await expect(result).rejects.toMatchObject({
      message: 'Plan generation failed',
      cause: 'Unexpected model failure',
    });
  });

  it('skips an observer cancelled by an earlier observer during the same progress event', async () => {
    const gate = deferred<PlanGenerationResult>();
    const operation = vi.fn((_context: AiCallContext) => gate.promise);
    const controller = new AbortController();
    const first = sharePlanGeneration('cancel-during-progress', operation, {
      onProgress: () => {
        controller.abort();
      },
    });
    const progress = vi.fn();
    const second = sharePlanGeneration('cancel-during-progress', operation, {
      signal: controller.signal,
      onProgress: progress,
    });
    const rejected = expect(second).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    operation.mock.calls[0]?.[0].onProgress?.('Preparing');
    await rejected;
    gate.resolve(planResult());
    await first;
    expect(progress).not.toHaveBeenCalled();
  });
});
