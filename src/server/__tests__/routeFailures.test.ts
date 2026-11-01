import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { z } from 'zod';
import { createApp } from '../index.js';
import { initRepositories, setRepositories } from '../repositories/index.js';
import type { PlanRepository, ShareRepository } from '../repositories/types.js';
import { setTokenVerifier } from '../middleware/auth.js';
import * as places from '../services/places.js';
import { input, plan } from '../../shared/__tests__/fixtures.js';
import { savedPlanSchema } from '../../shared/schemas.js';

const saved = savedPlanSchema.parse({
  id: 'existing',
  ownerUid: 'owner',
  input,
  plan: plan(),
  createdAt: '2030-01-01',
  updatedAt: '2030-01-01',
});
const savePlan = vi.fn<PlanRepository['savePlan']>();
const getPlan = vi.fn<PlanRepository['getPlan']>();
const createShare = vi.fn<ShareRepository['createShare']>();
const getShare = vi.fn<ShareRepository['getShare']>();
let server: Server;
let base: string;
let requestId = 0;
async function request(
  path: string,
  method = 'GET',
  payload?: unknown,
  extra: Record<string, string> = {},
) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      Origin: base,
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
      'X-Forwarded-For': `203.0.113.${String(++requestId)}`,
      ...extra,
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}
async function error(response: Response, status: number, message: string) {
  expect(response.status).toBe(status);
  expect(z.object({ error: z.string() }).parse((await response.json()) as unknown).error).toBe(
    message,
  );
}
beforeAll(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => {
    server.once('listening', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test listener');
  base = `http://127.0.0.1:${String(address.port)}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
});
beforeEach(() => {
  savePlan.mockReset().mockResolvedValue(undefined);
  getPlan.mockReset().mockResolvedValue(saved);
  createShare
    .mockReset()
    .mockResolvedValue({ shareToken: 'a'.repeat(32), expiresAt: '2030-03-01' });
  getShare.mockReset().mockResolvedValue(saved);
  setRepositories({ savePlan, getPlan }, { createShare, getShare });
  setTokenVerifier((token) => Promise.resolve(token === 'owner' ? { uid: 'owner' } : null));
  vi.stubEnv('GEMINI_API_KEY', 'your-gemini-api-key-here');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  initRepositories({ forceType: 'in-memory' });
  setTokenVerifier(null);
});

describe('API persistence failure recovery', () => {
  it('saves an existing guest plan with server-generated ownership and IDs', async () => {
    const response = await request('/api/plan/save', 'POST', { input, plan: plan() });
    expect(response.status).toBe(200);
    const body = z
      .object({ success: z.boolean(), plan: savedPlanSchema })
      .parse((await response.json()) as unknown);
    expect(body.success).toBe(true);
    expect(body.plan.ownerUid).toBe('owner');
    expect(body.plan.id).not.toBe('existing');
    expect(savePlan).toHaveBeenCalledWith(body.plan);
  });
  it('reports storage save failures without persisting an invalid partial response', async () => {
    savePlan.mockRejectedValue(new Error('storage write rejected'));
    await error(
      await request('/api/plan/save', 'POST', { input, plan: plan() }),
      500,
      'Failed to save plan',
    );
    await error(await request('/api/plan', 'POST', { input }), 500, 'AI_REQUEST_FAILED');
  });
  it('maps storage read errors to a stable response', async () => {
    getPlan.mockRejectedValue('storage read rejected');
    await error(await request('/api/plan/existing'), 500, 'Failed to retrieve plan');
  });
  it('rejects missing and cross-account edits, preserving prior data', async () => {
    getPlan.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...saved, ownerUid: 'other' });
    await error(await request('/api/plan/missing', 'PUT', { plan: plan() }), 404, 'Plan not found');
    await error(
      await request('/api/plan/existing', 'PUT', { plan: plan() }),
      404,
      'Plan not found',
    );
    expect(savePlan).not.toHaveBeenCalled();
  });
  it('retains input when omitted by an authorized update, and handles write errors', async () => {
    const response = await request('/api/plan/existing', 'PUT', {
      plan: plan({ summary: 'Updated' }),
    });
    expect(response.status).toBe(200);
    expect(savePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        id: saved.id,
        input: saved.input,
        ownerUid: saved.ownerUid,
        createdAt: saved.createdAt,
      }),
    );
    savePlan.mockRejectedValue('write unavailable');
    await error(
      await request('/api/plan/existing', 'PUT', { plan: plan() }),
      500,
      'Failed to update plan',
    );
  });
  it('handles share creation/read failures and supports forwarded HTTPS origins', async () => {
    const response = await request(
      '/api/share',
      'POST',
      { input, plan: plan() },
      {
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'planner.example',
        Origin: 'https://planner.example',
      },
    );
    const data = z.object({ shareUrl: z.string() }).parse((await response.json()) as unknown);
    expect(data.shareUrl).toBe(`https://planner.example/share/${'a'.repeat(32)}`);
    createShare.mockRejectedValue('create failed');
    getShare.mockRejectedValue(new Error('read failed'));
    await error(
      await request('/api/share', 'POST', { input, plan: plan() }),
      500,
      'Failed to create shareable link',
    );
    await error(await request('/api/share/token'), 500, 'Failed to retrieve shared plan');
  });
  it('reviews a real plan through the HTTP fallback without making an AI request', async () => {
    const response = await request('/api/review-plan', 'POST', { input, plan: plan() });
    expect(response.status).toBe(200);
    expect(
      z
        .object({
          meta: z.object({ source: z.literal('fallback') }),
          review: z.object({ overallScore: z.number() }),
        })
        .safeParse((await response.json()) as unknown).success,
    ).toBe(true);
  });
  it('rejects malformed origins and non-JSON writes before routing', async () => {
    await error(
      await request('/api/plan', 'POST', {}, { Origin: 'not an origin' }),
      403,
      'FORBIDDEN_ORIGIN',
    );
    await error(
      await request('/api/plan', 'POST', {}, { 'Content-Type': 'text/plain' }),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    );
  });
});
describe('Places route authorization and upstream responses', () => {
  it('does not attempt vendor search without a configured API key', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
    await error(
      await request('/api/vendors/search', 'POST', { category: 'Food', city: 'Pune' }),
      503,
      'GOOGLE_MAPS_API_KEY not configured on this server.',
    );
  });
  it('validates search inputs and returns confirmed vendor suggestions', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-placeholder');
    expect((await request('/api/vendors/search', 'POST', { category: '', city: '' })).status).toBe(
      400,
    );
    const search = vi
      .spyOn(places, 'searchVendorsByCategory')
      .mockResolvedValue([{ name: 'Verified vendor', mapsUrl: 'https://maps.google.com/example' }]);
    const response = await request('/api/vendors/search', 'POST', {
      category: 'Food',
      city: 'Pune',
      subEvent: 'Reception',
    });
    expect(response.status).toBe(200);
    expect(
      z
        .object({ suggestions: z.array(z.object({ name: z.string() })) })
        .parse((await response.json()) as unknown).suggestions,
    ).toEqual([{ name: 'Verified vendor' }]);
    expect(search).toHaveBeenCalledWith('Food', 'Pune', 'test-placeholder', 'Reception');
  });
  it('maps Error and non-Error upstream rejections without leaking credentials', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-placeholder');
    vi.spyOn(places, 'searchVendorsByCategory')
      .mockRejectedValueOnce(new Error('quota exhausted'))
      .mockRejectedValueOnce(null);
    await error(
      await request('/api/vendors/search', 'POST', { category: 'Food', city: 'Pune' }),
      502,
      'quota exhausted',
    );
    await error(
      await request('/api/vendors/search', 'POST', { category: 'Food', city: 'Pune' }),
      502,
      'Places API unavailable',
    );
  });
});
