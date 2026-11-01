import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  AiResponseInvalidError,
  callModel,
  FIRST_CHUNK_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  MODEL_TIMEOUT_MS,
  modelChain,
  setModelTransport,
  type ModelRequest,
} from '../services/model.js';

const sdk = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContentStream: sdk.generate };
  },
}));
const schema = z.object({ answer: z.string().min(1) });
const options = { schema, prompt: 'A celebration question' };
async function* json(value: unknown = { answer: 'Verified answer' }) {
  yield await Promise.resolve(JSON.stringify(value));
}

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('GEMINI_MODEL', 'preferred,preferred, second');
  setModelTransport();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  setModelTransport();
  vi.clearAllMocks();
});

describe('Structured model failover', () => {
  it('uses configured model priorities once then documented defaults', () => {
    expect(modelChain()).toEqual([
      'preferred',
      'second',
      'gemini-3.5-flash',
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash-lite',
    ]);
  });
  it.each(['', 'your-gemini-api-key-here'])(
    'uses fallback without configured key: %s',
    async (key) => {
      vi.stubEnv('GEMINI_API_KEY', key);
      const transport = vi.fn(() => Promise.resolve(json()));
      setModelTransport(transport);
      expect(await callModel(options)).toBeNull();
      expect(transport).not.toHaveBeenCalled();
    },
  );
  it('validates, sanitizes and reports only public progress', async () => {
    setModelTransport(() => Promise.resolve(json({ answer: '<b>Safe</b>' })));
    const progress = vi.fn();
    expect(await callModel({ ...options, onProgress: progress })).toEqual({
      data: { answer: 'Safe' },
      model: 'preferred',
    });
    expect(progress).toHaveBeenCalledWith('Checked the response against the required structure.');
  });
  it('keeps private reasoning out of the output and configures SDK schema and abort', async () => {
    sdk.generate.mockResolvedValue(
      (async function* () {
        yield await Promise.resolve({});
        yield await Promise.resolve({ candidates: [{ content: { parts: [{}] } }] });
        yield await Promise.resolve({
          candidates: [
            {
              content: {
                parts: [{ thought: true, text: 'private chain' }, { text: '{"answer":' }],
              },
            },
          ],
        });
        yield await Promise.resolve({
          candidates: [{ content: { parts: [{ text: '"Public answer"}' }] } }],
        });
      })(),
    );
    expect((await callModel(options))?.data.answer).toBe('Public answer');
    const request = z
      .object({
        model: z.string(),
        config: z.object({
          responseMimeType: z.string(),
          responseJsonSchema: z.object({ type: z.string() }),
          abortSignal: z.instanceof(AbortSignal),
        }),
      })
      .parse(sdk.generate.mock.calls[0]?.[0]);
    expect(request.model).toBe('preferred');
    expect(request.config.responseMimeType).toBe('application/json');
    expect(request.config.responseJsonSchema.type).toBe('object');
  });
  it.each([
    [429, 60_000],
    [503, 30_000],
    [500, 30_000],
    [404, 3_600_000],
  ])('cools a model after HTTP %i for %i ms', async (status, cooldown) => {
    vi.useFakeTimers();
    const attempts: string[] = [];
    let rejectFirst = true;
    setModelTransport(async ({ model }) => {
      await Promise.resolve();
      attempts.push(model);
      if (model === 'preferred' && rejectFirst) {
        rejectFirst = false;
        throw Object.assign(new Error('upstream'), { status });
      }
      return json();
    });
    expect((await callModel(options))?.model).toBe('second');
    expect((await callModel(options))?.model).toBe('second');
    expect(attempts.filter((model) => model === 'preferred')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(cooldown);
    expect((await callModel(options))?.model).toBe('preferred');
  });
  it('fails closed for invalid JSON and invalid schema after trying available models', async () => {
    setModelTransport(() => Promise.resolve(json({ unknown: 'field' })));
    await expect(callModel(options)).rejects.toBeInstanceOf(AiResponseInvalidError);
    expect(await callModel(options)).toBeNull();
    setModelTransport(() =>
      Promise.resolve(
        (async function* () {
          yield await Promise.resolve('broken json');
        })(),
      ),
    );
    await expect(callModel(options)).rejects.toThrow('AI_RESPONSE_INVALID');
  });
  it('bounds oversized output and tries failover', async () => {
    setModelTransport(({ model }) =>
      Promise.resolve(
        model === 'preferred'
          ? (async function* () {
              yield await Promise.resolve('a'.repeat(1_000_001));
            })()
          : json(),
      ),
    );
    expect((await callModel(options))?.model).toBe('second');
  });
  it('returns fallback for unavailable models without exposing upstream errors', async () => {
    setModelTransport(() => Promise.reject(new Error('sensitive upstream detail')));
    expect(await callModel(options)).toBeNull();
  });
});

describe('Model watchdogs and cancellation', () => {
  it('aborts first-chunk stalls and skips the timed-out model on subsequent requests', async () => {
    vi.useFakeTimers();
    let firstSignal: AbortSignal | undefined;
    setModelTransport(async ({ model, signal }) => {
      if (model === 'preferred') {
        firstSignal = signal;
        return new Promise<AsyncIterable<string>>(() => undefined);
      }
      return json();
    });
    const pending = callModel(options);
    await vi.advanceTimersByTimeAsync(FIRST_CHUNK_TIMEOUT_MS);
    expect((await pending)?.model).toBe('second');
    expect(firstSignal?.aborted).toBe(true);
    expect((await callModel(options))?.model).toBe('second');
  });
  it('aborts an idle stream after the first chunk', async () => {
    vi.useFakeTimers();
    setModelTransport(({ model }) =>
      Promise.resolve(
        model === 'preferred'
          ? (async function* () {
              yield '{';
              await new Promise<void>(() => undefined);
            })()
          : json(),
      ),
    );
    const pending = callModel(options);
    await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS);
    expect((await pending)?.model).toBe('second');
  });
  it('bounds the whole model chain to the overall deadline', async () => {
    vi.useFakeTimers();
    setModelTransport(async () => new Promise<AsyncIterable<string>>(() => undefined));
    const pending = callModel(options);
    await vi.advanceTimersByTimeAsync(MODEL_TIMEOUT_MS);
    expect(await pending).toBeNull();
  });
  it('aborts an active SDK request on client cancellation', async () => {
    let request: ModelRequest | undefined;
    setModelTransport(async (next) => {
      request = next;
      return new Promise<AsyncIterable<string>>(() => undefined);
    });
    const controller = new AbortController();
    const pending = callModel({ ...options, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(request?.signal.aborted).toBe(true);
    await expect(callModel({ ...options, signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
  it('cancels when progress callback aborts immediately before model startup', async () => {
    const controller = new AbortController();
    setModelTransport(() => Promise.resolve(json()));
    await expect(
      callModel({
        ...options,
        signal: controller.signal,
        onProgress: () => {
          controller.abort();
        },
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
