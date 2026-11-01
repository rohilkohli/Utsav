import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { z } from 'zod';
import { InMemoryRepository } from '../repositories/inMemory.js';
import { initRepositories, setRepositories } from '../repositories/index.js';
import { setTokenVerifier } from '../middleware/auth.js';
import { createApp } from '../index.js';
import { input, plan } from '../../shared/__tests__/fixtures.js';
import { savedPlanSchema } from '../../shared/schemas.js';

let server: Server;
let origin: string;
beforeAll(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => {
    server.once('listening', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
  origin = `http://127.0.0.1:${String(address.port)}`;
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
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2030-01-31T12:00:00Z'));
  const repository = new InMemoryRepository();
  setRepositories(repository, repository);
  setTokenVerifier((token) => Promise.resolve(token === 'owner' ? { uid: 'owner' } : null));
  vi.stubEnv('GEMINI_API_KEY', 'your-gemini-api-key-here');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  initRepositories({ forceType: 'in-memory' });
  setTokenVerifier(null);
});

async function request(path: string, method = 'GET', body?: unknown) {
  return fetch(`${origin}/api${path}`, {
    method,
    headers: {
      Origin: origin,
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe('persisted snapshots after their event date', () => {
  it('loads saved plans and valid 30-day shares after the celebration, then enforces share expiry', async () => {
    const repository = new InMemoryRepository();
    const event = { ...input, eventDate: '2030-02-01' };
    await repository.savePlan({
      id: 'past-event',
      ownerUid: 'user-1',
      input: event,
      plan: plan(),
      createdAt: '2030-01-31',
      updatedAt: '2030-01-31',
    });
    const shared = await repository.createShare(event, plan());
    vi.setSystemTime(new Date('2030-02-03T12:00:00Z'));
    expect((await repository.getPlan('past-event'))?.input.eventDate).toBe('2030-02-01');
    const snapshot = await repository.getShare(shared.shareToken);
    expect(snapshot?.input.eventDate).toBe('2030-02-01');
    expect(snapshot?.expiresAt).toBe(shared.expiresAt);
    vi.setSystemTime(new Date('2030-03-03T12:00:00Z'));
    expect(await repository.getShare(shared.shareToken)).toBeNull();
    expect((await repository.getPlan('past-event'))?.id).toBe('past-event');
  });

  it('keeps historical plans editable and shareable through the API while rejecting past-date generation', async () => {
    const event = { ...input, eventDate: '2030-02-01' };
    const savedResponse = await request('/plan/save', 'POST', { input: event, plan: plan() });
    expect(savedResponse.status).toBe(200);
    const saved = z
      .object({ plan: savedPlanSchema })
      .parse((await savedResponse.json()) as unknown).plan;

    vi.setSystemTime(new Date('2030-02-03T12:00:00Z'));
    const read = await request(`/plan/${saved.id}`);
    expect(read.status).toBe(200);
    expect(savedPlanSchema.parse((await read.json()) as unknown).plan.timeline).toEqual(
      saved.plan.timeline,
    );
    expect((await request(`/plan/${saved.id}`, 'PUT', { input: event, plan: plan() })).status).toBe(
      200,
    );
    expect((await request('/plan/save', 'POST', { input: event, plan: plan() })).status).toBe(200);

    const sharedResponse = await request('/share', 'POST', { input: event, plan: plan() });
    expect(sharedResponse.status).toBe(200);
    const shared = z
      .object({ shareToken: z.string(), expiresAt: z.string() })
      .parse((await sharedResponse.json()) as unknown);
    const snapshot = await request(`/share/${shared.shareToken}`);
    expect(snapshot.status).toBe(200);
    expect(savedPlanSchema.parse((await snapshot.json()) as unknown).input.eventDate).toBe(
      event.eventDate,
    );
    expect((await request('/review-plan', 'POST', { input: event, plan: plan() })).status).toBe(
      200,
    );
    expect((await request('/plan', 'POST', { input: event })).status).toBe(400);
    expect(
      (
        await request('/share', 'POST', {
          input: { ...event, eventDate: '2030-02-30' },
          plan: plan(),
        })
      ).status,
    ).toBe(400);
  });
});
