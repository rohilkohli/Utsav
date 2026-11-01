import express from 'express';
import compression from 'compression';
import type { Server } from 'http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runAiResponse } from '../routes/aiResponse.js';
import { AiResponseInvalidError } from '../services/model.js';

let server: Server;
let base: string;
let cancellation: Promise<void>;
const frameSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  model: z.string().optional(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});
const parseFrames = (body: string) =>
  body
    .trim()
    .split('\n')
    .map((line) => frameSchema.parse(JSON.parse(line)));

beforeAll(async () => {
  const app = express();
  app.use(compression());
  app.get('/answer', async (req, res) => {
    await runAiResponse(req, res, (context) => {
      context.onProgress?.('Using supplied budget facts.');
      return Promise.resolve({ answer: 'Grounded answer', model: 'test-model' });
    });
  });
  app.get('/meta', async (req, res) => {
    await runAiResponse(req, res, () =>
      Promise.resolve({ review: 'Good plan', meta: { model: 'meta-model' } }),
    );
  });
  app.get('/fallback', async (req, res) => {
    await runAiResponse(req, res, () =>
      Promise.resolve({ answer: 'Offline answer', source: 'fallback' }),
    );
  });
  app.get('/invalid', async (req, res) => {
    await runAiResponse(req, res, () => Promise.reject(new AiResponseInvalidError()));
  });
  app.get('/unavailable', async (req, res) => {
    await runAiResponse(req, res, () => Promise.reject(new Error('private upstream details')));
  });
  app.get('/cancel', async (req, res) => {
    await runAiResponse(
      req,
      res,
      ({ signal }) =>
        new Promise<void>((resolve) => {
          cancellation = new Promise<void>((cancelled) => {
            signal?.addEventListener(
              'abort',
              () => {
                cancelled();
                resolve();
              },
              { once: true },
            );
          });
        }),
    );
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address');
  base = `http://127.0.0.1:${String(address.port)}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
});

describe('AI HTTP response protocol', () => {
  it('preserves normal JSON without a streaming Accept header', async () => {
    const response = await fetch(`${base}/answer`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ answer: 'Grounded answer', model: 'test-model' });
  });
  it('streams ordered public progress, model metadata and the validated result', async () => {
    const response = await fetch(`${base}/answer`, { headers: { Accept: 'application/x-ndjson' } });
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    expect(response.headers.get('cache-control')).toContain('no-transform');
    const frames = parseFrames(await response.text());
    expect(frames.map((frame) => frame.type)).toEqual(['thought', 'thought', 'model', 'result']);
    expect(frames[1]?.text).toBe('Using supplied budget facts.');
    expect(frames[2]?.model).toBe('test-model');
    expect(frames[3]?.data).toEqual({ answer: 'Grounded answer', model: 'test-model' });
  });
  it('reads nested model metadata and omits model frames for offline results', async () => {
    const metadata = await fetch(`${base}/meta`, { headers: { Accept: 'application/x-ndjson' } });
    expect(parseFrames(await metadata.text()).some((frame) => frame.model === 'meta-model')).toBe(
      true,
    );
    const fallback = await fetch(`${base}/fallback`, {
      headers: { Accept: 'application/x-ndjson' },
    });
    expect(parseFrames(await fallback.text()).map((frame) => frame.type)).toEqual([
      'thought',
      'result',
    ]);
  });
  it.each([
    ['invalid', 502, 'AI_RESPONSE_INVALID'],
    ['unavailable', 500, 'AI_REQUEST_FAILED'],
  ])('returns safe JSON errors for %s', async (path, status, error) => {
    const response = await fetch(`${base}/${path}`);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });
  it.each([
    ['invalid', 'AI_RESPONSE_INVALID'],
    ['unavailable', 'AI_REQUEST_FAILED'],
  ])('terminates %s streams with a safe error frame', async (path, error) => {
    const response = await fetch(`${base}/${path}`, {
      headers: { Accept: 'application/x-ndjson' },
    });
    const frames = parseFrames(await response.text());
    expect(frames.at(-1)).toEqual({ type: 'error', error });
    expect(frames.some((frame) => frame.type === 'result')).toBe(false);
  });
  it('cancels model work when the streaming client disconnects', async () => {
    const controller = new AbortController();
    const response = await fetch(`${base}/cancel`, {
      signal: controller.signal,
      headers: { Accept: 'application/x-ndjson' },
    });
    const reader = response.body?.getReader();
    await reader?.read();
    controller.abort();
    await cancellation;
    expect(controller.signal.aborted).toBe(true);
  });
});
