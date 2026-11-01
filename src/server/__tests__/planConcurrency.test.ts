import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateEventPlan } from '../services/planService.js';
import { AiResponseInvalidError, setModelTransport } from '../services/model.js';
import { creativeResponse, deferred, json, planInput } from './planConcurrencyFixture.js';

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('GEMINI_MODEL', '');
  setModelTransport();
});
afterEach(() => {
  setModelTransport();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('Concurrent event planning', () => {
  it('uses one model call for identical requests and keeps subscriber and cache copies independent', async () => {
    const input = planInput();
    const gate = deferred<AsyncIterable<string>>();
    const transport = vi.fn(() => gate.promise);
    setModelTransport(transport);
    const firstProgress = vi.fn();
    const secondProgress = vi.fn();
    const first = generateEventPlan(input, { onProgress: firstProgress });
    const second = generateEventPlan(structuredClone(input), { onProgress: secondProgress });
    await Promise.resolve();
    expect(transport).toHaveBeenCalledTimes(1);
    gate.resolve(json(creativeResponse(input)));
    const [a, b] = await Promise.all([first, second]);
    expect(a.source).toBe('gemini');
    expect(b).toEqual(a);
    expect(firstProgress.mock.calls).toEqual(secondProgress.mock.calls);
    a.plan.summary = 'Changed by one consumer';
    for (const category of a.plan.budget) category.amount = 1;
    expect(b.plan.summary).toBe('A shared celebration');
    expect(b.plan.budget[0]?.amount).not.toBe(1);
    const cached = await generateEventPlan(input);
    expect(cached.source).toBe('cache');
    expect(cached.plan).toEqual(b.plan);
    for (const vendor of cached.plan.vendors) vendor.questionsToAsk.push('Consumer-only question');
    expect((await generateEventPlan(input)).plan).toEqual(b.plan);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('keeps different inputs separate and snapshots input before asynchronous execution', async () => {
    const input = planInput();
    const original = structuredClone(input);
    const other = planInput();
    const transport = vi.fn(() => Promise.resolve(json(creativeResponse(original))));
    setModelTransport(transport);
    const first = generateEventPlan(input);
    input.city = 'Changed after requesting';
    input.totalBudget = 99999;
    const second = generateEventPlan(other);
    const [a, b] = await Promise.all([first, second]);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(a.plan.budget.reduce((sum, item) => sum + item.amount, 0)).toBe(original.totalBudget);
    expect(b.plan.budget.reduce((sum, item) => sum + item.amount, 0)).toBe(other.totalBudget);
    expect((await generateEventPlan(original)).source).toBe('cache');
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('fans out invalid-output errors and lets a later request retry successfully', async () => {
    const input = planInput();
    const transport = vi.fn(() => Promise.resolve(json({ summary: 'Invalid response' })));
    setModelTransport(transport);
    const results = await Promise.allSettled([generateEventPlan(input), generateEventPlan(input)]);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected')
        expect(result.reason).toBeInstanceOf(AiResponseInvalidError);
    }
    expect(transport).toHaveBeenCalledTimes(5);
    setModelTransport(() => Promise.resolve(json(creativeResponse(input))));
    expect((await generateEventPlan(input)).source).toBe('gemini');
  });

  it('preserves another request when one HTTP subscriber disconnects', async () => {
    const input = planInput();
    const gate = deferred<AsyncIterable<string>>();
    let upstreamSignal: AbortSignal | undefined;
    const transport = vi.fn((request: { signal: AbortSignal }) => {
      upstreamSignal = request.signal;
      return gate.promise;
    });
    setModelTransport(transport);
    const controller = new AbortController();
    const first = generateEventPlan(input, { signal: controller.signal });
    const second = generateEventPlan(input);
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    controller.abort();
    await rejected;
    expect(upstreamSignal?.aborted).toBe(false);
    gate.resolve(json(creativeResponse(input)));
    expect((await second).source).toBe('gemini');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('aborts abandoned model work and permits a fresh same-key request immediately', async () => {
    const input = planInput();
    const abandoned = deferred<AsyncIterable<string>>();
    let upstreamSignal: AbortSignal | undefined;
    setModelTransport((request) => {
      upstreamSignal = request.signal;
      return abandoned.promise;
    });
    const controller = new AbortController();
    const pending = generateEventPlan(input, { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    controller.abort();
    await rejected;
    expect(upstreamSignal?.aborted).toBe(true);
    setModelTransport(() => Promise.resolve(json(creativeResponse(input))));
    expect((await generateEventPlan(input)).source).toBe('gemini');
    abandoned.resolve(json({ summary: 'Abandoned content' }));
    expect((await generateEventPlan(input)).plan.summary).toBe('A shared celebration');
  });

  it('does not reuse a pre-midnight cached timeline for a new Kolkata planning date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T18:29:59Z'));
    const input = planInput();
    const transport = vi.fn(() => Promise.resolve(json(creativeResponse(input))));
    setModelTransport(transport);
    await generateEventPlan(input);
    expect((await generateEventPlan(input)).source).toBe('cache');
    vi.setSystemTime(new Date('2026-11-01T18:30:01Z'));
    expect((await generateEventPlan(input)).source).toBe('gemini');
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('keeps the captured planning date consistent when generation crosses Kolkata midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T18:29:59Z'));
    const input = { ...planInput(), eventDate: '2026-11-05' };
    const creative = creativeResponse(input);
    const gate = deferred<undefined>();
    const transport = vi.fn(() => gate.promise.then(() => json(creative)));
    setModelTransport(transport);
    const first = generateEventPlan(input);
    // Even the first queued generation starts after midnight, but retains its request date.
    vi.setSystemTime(new Date('2026-11-01T18:30:01Z'));
    const second = generateEventPlan(input);
    await Promise.resolve();
    expect(transport).toHaveBeenCalledTimes(2);
    gate.resolve(undefined);
    const [a, b] = await Promise.all([first, second]);
    expect(a.plan.timelineCompression?.preparedOn).toBe('2026-11-01');
    expect(b.plan.timelineCompression?.preparedOn).toBe('2026-11-02');
  });

  it('rejects an already-aborted request before serving cached data', async () => {
    const input = planInput();
    setModelTransport(() => Promise.resolve(json(creativeResponse(input))));
    await generateEventPlan(input);
    const controller = new AbortController();
    controller.abort();
    await expect(generateEventPlan(input, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
