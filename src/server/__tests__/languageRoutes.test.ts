import express from 'express';
import type { Server } from 'http';
import { z } from 'zod';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { planOutputSchema, wizardInputSchema } from '../../shared/schemas.js';
import { generateFallbackPlan } from '../services/fallback.js';
import { setModelTransport } from '../services/model.js';
import { sameOriginGuard } from '../middleware/security.js';
import { generationLimiter } from '../middleware/rateLimit.js';
import intakeRoutes from '../routes/parseIntake.js';
import advisorRoutes from '../routes/askPlanner.js';
import tradeoffRoutes from '../routes/explainTradeoffs.js';
import quoteRoutes from '../routes/extractQuote.js';
import { parseQuoteText } from '../services/quoteService.js';

const input = wizardInputSchema.parse({
  eventType: 'birthday',
  eventDate: '2099-12-15',
  city: 'Mumbai',
  guestCount: 100,
  totalBudget: 50000,
});
const plan = planOutputSchema.parse(generateFallbackPlan(input));
const cases = [
  {
    path: '/parse-intake',
    body: { description: 'Birthday in Mumbai, 100 guests, budget 50k, 15 December 2099' },
    result: {
      eventType: null,
      city: null,
      subEvents: null,
      theme: null,
      dietaryPreferences: null,
      culturalNotes: null,
      language: null,
    },
    field: 'input',
  },
  {
    path: '/ask-planner',
    body: { question: 'How much is my budget?', plan, input },
    result: { answer: 'Your total budget is ₹50,000.' },
    field: 'answer',
  },
  {
    path: '/explain-tradeoffs',
    body: {
      overBudgetAmount: 1000,
      options: [
        { label: 'Uniform cut', description: 'Reduce allocations', savings: 1000, newTotal: 50000 },
      ],
    },
    result: { explanation: 'A uniform cut saves ₹1,000.' },
    field: 'explanation',
  },
  {
    path: '/extract-quote',
    body: { text: 'Vendor: Flowers; Total ₹45000; GST extra', category: 'Decor' },
    result: parseQuoteText('Vendor: Flowers; Total ₹45000; GST extra', 'Decor'),
    field: 'quote',
  },
] as const;
const sourceSchema = z.object({
  source: z.enum(['gemini', 'fallback']),
  model: z.string().optional(),
});
const eventSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  data: z.unknown().optional(),
});
let server: Server;
let origin: string;

beforeAll(async () => {
  const app = express();
  app.use(sameOriginGuard);
  app.use('/api', intakeRoutes, advisorRoutes, tradeoffRoutes, quoteRoutes);
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
      origin = `http://127.0.0.1:${address.port}`;
      resolve();
    });
    server.on('error', reject);
  });
});

beforeEach(() => {
  generationLimiter.resetKey('127.0.0.1');
  vi.stubEnv('GEMINI_API_KEY', 'your-gemini-api-key-here');
});
afterEach(() => {
  vi.unstubAllEnvs();
  setModelTransport();
});
afterAll(
  async () =>
    new Promise<void>((resolve, reject) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    }),
);

async function post(path: string, body: unknown, accept = 'application/json') {
  return fetch(`${origin}/api${path}`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', Accept: accept },
    body: JSON.stringify(body),
  });
}

describe.each(cases)('$path', ({ path, body, result, field }) => {
  it('returns a usable validated JSON fallback without credentials', async () => {
    const response = await post(path, body);
    expect(response.status).toBe(200);
    const data: unknown = await response.json();
    expect(sourceSchema.parse(data).source).toBe('fallback');
    expect(data).toHaveProperty(field);
  });

  it('returns a structured model answer when available', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    setModelTransport(() =>
      Promise.resolve(
        (async function* () {
          await Promise.resolve();
          yield JSON.stringify(result);
        })(),
      ),
    );
    const response = await post(path, body);
    expect(response.status).toBe(200);
    const data: unknown = await response.json();
    expect(sourceSchema.parse(data).source).toBe('gemini');
    expect(typeof sourceSchema.parse(data).model).toBe('string');
    expect(data).toHaveProperty(field);
  });

  it('streams progress and exactly one validated result without leaking secrets', async () => {
    const response = await post(path, body, 'application/x-ndjson');
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    const text = await response.text();
    const events = text
      .trim()
      .split('\n')
      .map((line) => eventSchema.parse(JSON.parse(line)));
    expect(events[0]).toMatchObject({ type: 'thought' });
    const results = events.filter((event) => event.type === 'result');
    expect(results).toHaveLength(1);
    expect(sourceSchema.parse(results[0]?.data).source).toBe('fallback');
    expect(text).not.toContain('your-gemini-api-key-here');
  });

  it('rejects malformed requests before calling the model', async () => {
    const transport = vi.fn(() =>
      Promise.resolve(
        (async function* () {
          await Promise.resolve();
          yield '{}';
        })(),
      ),
    );
    setModelTransport(transport);
    const response = await post(path, {});
    expect(response.status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
  });

  it('returns 502 when every model response fails schema validation', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    setModelTransport(() =>
      Promise.resolve(
        (async function* () {
          await Promise.resolve();
          yield '{"unexpected":true}';
        })(),
      ),
    );
    const response = await post(path, body);
    expect(response.status).toBe(502);
    const data: unknown = await response.json();
    expect(data).toEqual({ error: 'AI_RESPONSE_INVALID' });
  });
});
