import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { createApp } from '../index.js';
import { setCachedPlan, getCachedPlan, createPlanCacheKey } from '../services/cache.js';
import { savePlanToDb, getPlanFromDb } from '../services/firestore.js';
import { refineIdeasSection } from '../services/gemini.js';
import type { SavedPlan, WizardInput, PlanOutput } from '../../shared/schemas.js';

describe('Server API & Services Integration', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /api/health returns 200 ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.time).toBeDefined();
  });

  it('GET /api/config returns runtime public Firebase configuration', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.firebase).toBeDefined();
    expect(typeof body.firebase.apiKey).toBe('string');
  });

  it('POST /api/plan generates a valid event plan', async () => {
    const payload = {
      input: {
        eventType: 'birthday',
        subEvents: [],
        eventDate: '2026-11-15',
        city: 'Mumbai',
        guestCount: 45,
        totalBudget: 40_000,
        theme: 'Gully Cricket Bash',
        dietaryPreferences: ['Vegetarian Snacks'],
        culturalNotes: '',
        language: 'english',
      },
    };

    const res = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBeDefined();
    expect(body.planId).toBeDefined();
    expect(body.plan.summary).toBeDefined();
    expect(body.plan.budget.length).toBeGreaterThan(0);

    // Test GET /api/plan/:id
    const getRes = await fetch(`${baseUrl}/api/plan/${body.planId}`);
    expect(getRes.status).toBe(200);
    const saved = await getRes.json();
    expect(saved.id).toBe(body.planId);

    // Test PUT /api/plan/:id
    const updateRes = await fetch(`${baseUrl}/api/plan/${body.planId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...saved,
        plan: {
          ...saved.plan,
          summary: 'Updated celebration summary',
        },
      }),
    });
    expect(updateRes.status).toBe(200);
  });

  it('GET /api/plan/:id returns 404 for unknown plan', async () => {
    const res = await fetch(`${baseUrl}/api/plan/nonexistent_id_999`);
    expect(res.status).toBe(404);
  });

  it('PUT /api/plan/:id returns 400 for malformed plan', async () => {
    const res = await fetch(`${baseUrl}/api/plan/some_id`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'data' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/plan returns 400 when invalid input is provided', async () => {
    const res = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { eventType: 'invalid_type' } }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('POST /api/refine re-generates ideas for a section', async () => {
    const payload = {
      section: 'food',
      instruction: 'Make everything organic and zero-waste.',
      currentPlan: {
        summary: 'Wedding',
        budget: [],
        timeline: [],
        vendors: [],
        ideas: [
          { id: '1', section: 'food', title: 'Old idea', description: 'desc' },
        ],
      },
      input: {
        eventType: 'birthday',
        subEvents: [],
        eventDate: '2026-11-20',
        city: 'Delhi',
        guestCount: 50,
        totalBudget: 50000,
      },
    };

    const res = await fetch(`${baseUrl}/api/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ideas).toBeDefined();
  });

  it('POST /api/share creates a 128-bit random token and GET /api/share/:token retrieves it', async () => {
    const payload = {
      input: {
        eventType: 'birthday',
        subEvents: [],
        eventDate: '2026-12-01',
        city: 'Pune',
        guestCount: 25,
        totalBudget: 25000,
        theme: 'Fun Party',
        dietaryPreferences: [],
        culturalNotes: '',
        language: 'english',
      },
      plan: {
        summary: 'A fun party in Pune',
        budget: [
          { id: '1', category: 'Decor', suggestedPercent: 50, amount: 12500, actual: 12500 },
          { id: '2', category: 'Cake', suggestedPercent: 50, amount: 12500, actual: 12500 },
        ],
        timeline: [],
        vendors: [],
        ideas: [],
      },
    };

    const shareRes = await fetch(`${baseUrl}/api/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(shareRes.status).toBe(200);
    const shareBody = await shareRes.json();
    expect(shareBody.shareToken).toBeDefined();
    expect(shareBody.shareToken.length).toBe(32); // 16 bytes in hex = 32 chars
    expect(shareBody.shareUrl).toContain(shareBody.shareToken);

    // Retrieve via GET /api/share/:token
    const getRes = await fetch(`${baseUrl}/api/share/${shareBody.shareToken}`);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.plan.summary).toBe('A fun party in Pune');
  });

  it('GET /api/share/:token returns 404 for nonexistent token', async () => {
    const res = await fetch(`${baseUrl}/api/share/nonexistent_token_12345`);
    expect(res.status).toBe(404);
  });

  it('verifies LRU caching and Firestore store functions directly', async () => {
    const key = createPlanCacheKey({ test: 123 });
    const dummyPlan: PlanOutput = {
      summary: 'Cached plan',
      budget: [],
      timeline: [],
      vendors: [],
      ideas: [],
    };
    setCachedPlan(key, dummyPlan);
    expect(getCachedPlan(key)).toEqual(dummyPlan);

    const savedPlan: SavedPlan = {
      id: 'custom_saved_1',
      input: {
        eventType: 'birthday',
        subEvents: [],
        eventDate: '2026-11-20',
        city: 'Nagpur',
        guestCount: 20,
        totalBudget: 15000,
        theme: '',
        dietaryPreferences: [],
        culturalNotes: '',
        language: 'english',
      },
      plan: dummyPlan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await savePlanToDb(savedPlan);
    const retrieved = await getPlanFromDb('custom_saved_1');
    expect(retrieved?.id).toBe('custom_saved_1');

    // Refine fallback test
    const dummyInput: WizardInput = {
      eventType: 'birthday',
      subEvents: [],
      eventDate: '2026-11-20',
      city: 'Delhi',
      guestCount: 50,
      totalBudget: 50000,
      theme: '',
      dietaryPreferences: [],
      culturalNotes: '',
      language: 'english',
    };
    const refined = await refineIdeasSection('food', 'Make it spicy', dummyInput, []);
    expect(Array.isArray(refined)).toBe(true);
  });
});
