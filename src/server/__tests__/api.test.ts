import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { createApp } from '../index.js';
import { setCachedPlan, getCachedPlan, createPlanCacheKey } from '../services/cache.js';
import { savePlanToDb, getPlanFromDb } from '../services/firestore.js';
import { getShareRepository, InMemoryRepository } from '../repositories/index.js';
import { setTokenVerifier } from '../middleware/auth.js';
import { refineIdeasSection } from '../services/gemini.js';
import { savedPlanSchema } from '../../shared/schemas.js';
import type { SavedPlan, WizardInput, PlanOutput } from '../../shared/schemas.js';

describe('Server API & Services Integration', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Inject mock TokenVerifier for integration tests
    setTokenVerifier(async (token: string) => {
      if (token.startsWith('test-token-')) {
        const uid = token.replace('test-token-', '').trim();
        if (uid.length > 0) {
          return { uid, email: `${uid}@test.local` };
        }
      }
      return null;
    });

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

  it('POST /api/plan generates plan without persisting to Firestore for guests', async () => {
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
    expect(body.meta).toBeDefined();

    // Guest plan must NOT be persisted in Firestore
    const unauthGet = await fetch(`${baseUrl}/api/plan/${body.planId}`);
    expect(unauthGet.status).toBe(401); // Requires auth

    const authGet = await fetch(`${baseUrl}/api/plan/${body.planId}`, {
      headers: { Authorization: 'Bearer test-token-userA' },
    });
    expect(authGet.status).toBe(404); // Not found because guest plans are client-side only
  });

  it('Authenticated plan ownership: saving, reading, updating and IDOR isolation', async () => {
    const payload = {
      input: {
        eventType: 'wedding',
        subEvents: ['Sangeet', 'Wedding Ceremony'],
        eventDate: '2026-12-25',
        city: 'Jaipur',
        guestCount: 60,
        totalBudget: 150_000,
        theme: 'Royal Palace Evening',
        dietaryPreferences: ['North Indian Royal'],
        culturalNotes: '',
        language: 'english',
      },
    };

    // 1. Signed-in User A generates & persists plan
    const resA = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token-userA',
      },
      body: JSON.stringify(payload),
    });

    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    const planId = bodyA.planId;
    expect(planId).toBeDefined();

    // 2. User A successfully reads their own plan
    const getResA = await fetch(`${baseUrl}/api/plan/${planId}`, {
      headers: { Authorization: 'Bearer test-token-userA' },
    });
    expect(getResA.status).toBe(200);
    const savedPlan = await getResA.json();
    expect(savedPlan.id).toBe(planId);
    expect(savedPlan.ownerUid).toBe('userA');
    expect(savedPlanSchema.safeParse(savedPlan).success).toBe(true);

    // 3. Unauthenticated request to GET /api/plan/:id returns 401
    const unauthGet = await fetch(`${baseUrl}/api/plan/${planId}`);
    expect(unauthGet.status).toBe(401);

    // 4. User B (different UID) attempting to read User A's plan returns 404 (IDOR protection)
    const userBGet = await fetch(`${baseUrl}/api/plan/${planId}`, {
      headers: { Authorization: 'Bearer test-token-userB' },
    });
    expect(userBGet.status).toBe(404);

    // 5. Unauthenticated request to PUT /api/plan/:id returns 401
    const unauthPut = await fetch(`${baseUrl}/api/plan/${planId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: {
          ...savedPlan.plan,
          summary: 'Hacked summary',
        },
      }),
    });
    expect(unauthPut.status).toBe(401);

    // 6. User B attempting to update User A's plan returns 404 (IDOR protection)
    const userBPut = await fetch(`${baseUrl}/api/plan/${planId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token-userB',
      },
      body: JSON.stringify({
        plan: {
          ...savedPlan.plan,
          summary: 'User B tampering',
        },
      }),
    });
    expect(userBPut.status).toBe(404);

    // 7. User A updating their plan with forbidden fields (e.g. id, ownerUid) returns 400 (strict schema)
    const invalidPut = await fetch(`${baseUrl}/api/plan/${planId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token-userA',
      },
      body: JSON.stringify({
        ...savedPlan,
        ownerUid: 'attacker', // Forbidden non-editable field
        plan: {
          ...savedPlan.plan,
          summary: 'Invalid update',
        },
      }),
    });
    expect(invalidPut.status).toBe(400);

    // 8. User A updating with valid editable fields succeeds
    const validPut = await fetch(`${baseUrl}/api/plan/${planId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token-userA',
      },
      body: JSON.stringify({
        plan: {
          ...savedPlan.plan,
          summary: 'Updated Royal Palace Evening celebration',
        },
      }),
    });
    expect(validPut.status).toBe(200);
    const updatedBody = await validPut.json();
    expect(updatedBody.success).toBe(true);
    expect(updatedBody.plan.plan.summary).toBe('Updated Royal Palace Evening celebration');
    expect(updatedBody.plan.ownerUid).toBe('userA');
  });

  it('GET /api/plan/:id returns 404 for unknown plan with valid auth', async () => {
    const res = await fetch(`${baseUrl}/api/plan/nonexistent_uuid_12345`, {
      headers: { Authorization: 'Bearer test-token-userA' },
    });
    expect(res.status).toBe(404);
  });

  // Skipped in CI: requires real Firebase credentials — the real SDK's gRPC keep-alive
  // holds the process open for ~20 minutes if no credentials are present.
  it.skipIf(!!process.env.CI)('rejects "test-token" string with 401 when NODE_ENV=production using real production verifier', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    // Reset to default production verifier (strictly calls admin.auth().verifyIdToken())
    setTokenVerifier(null);

    try {
      const res = await fetch(`${baseUrl}/api/plan/any_plan_uuid`, {
        headers: { Authorization: 'Bearer test-token-userA' },
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toContain('Unauthorized');
    } finally {
      process.env.NODE_ENV = originalEnv;
      // Restore test verifier for other tests
      setTokenVerifier(async (token: string) => {
        if (token.startsWith('test-token-')) {
          const uid = token.replace('test-token-', '').trim();
          if (uid.length > 0) {
            return { uid, email: `${uid}@test.local` };
          }
        }
        return null;
      });
    }
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

  it('POST /api/refine re-generates ideas for a section and includes meta.source', async () => {
    const payload = {
      section: 'food',
      instruction: 'Make everything organic and zero-waste.',
      currentPlan: {
        summary: 'Wedding',
        budget: [],
        timeline: [],
        vendors: [],
        ideas: [{ id: '1', section: 'food', title: 'Old idea', description: 'desc' }],
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
    expect(body.meta).toBeDefined();
    expect(['gemini', 'fallback']).toContain(body.meta.source);
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

    // Assert the JSON response parses cleanly with the shared transport schema
    const parsed = savedPlanSchema.safeParse(getBody);
    expect(parsed.success).toBe(true);
    // expiresAt must be an ISO string (not a Firestore Timestamp or Date)
    if (getBody.expiresAt) {
      expect(typeof getBody.expiresAt).toBe('string');
      expect(new Date(getBody.expiresAt).toISOString()).toBe(getBody.expiresAt);
    }
  });

  it('GET /api/share/:token returns 404 when expired (Firestore Timestamp check)', async () => {
    // Seed an expired snapshot directly into the in-memory repository with a Timestamp mock
    const expiredToken = 'expired_test_token_99999999999';
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago

    const shareRepo = getShareRepository() as InMemoryRepository;
    shareRepo.seedShare(expiredToken, {
      id: `share_${expiredToken}`,
      shareToken: expiredToken,
      input: {
        eventType: 'birthday',
        subEvents: [],
        eventDate: '2026-11-20',
        city: 'Delhi',
        guestCount: 20,
        totalBudget: 10000,
        theme: '',
        dietaryPreferences: [],
        culturalNotes: '',
        language: 'english',
      },
      plan: {
        summary: 'Expired plan',
        budget: [],
        timeline: [],
        vendors: [],
        ideas: [],
      },
      createdAt: pastDate.toISOString(),
      updatedAt: pastDate.toISOString(),
      expiresAt: {
        toMillis: () => pastDate.getTime(),
        toDate: () => pastDate,
      },
    });

    const res = await fetch(`${baseUrl}/api/share/${expiredToken}`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('expired');
  });

  it('GET /api/share/:token fails closed (404) when expiresAt is missing', async () => {
    const missingExpiresToken = 'missing_expires_token_111';
    const shareRepo = getShareRepository() as InMemoryRepository;
    shareRepo.seedShare(missingExpiresToken, {
      id: `share_${missingExpiresToken}`,
      shareToken: missingExpiresToken,
      input: {
        eventType: 'birthday',
        subEvents: [],
        eventDate: '2026-11-20',
        city: 'Delhi',
        guestCount: 20,
        totalBudget: 10000,
        theme: '',
        dietaryPreferences: [],
        culturalNotes: '',
        language: 'english',
      },
      plan: {
        summary: 'No expiry plan',
        budget: [],
        timeline: [],
        vendors: [],
        ideas: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // expiresAt intentionally omitted
    });

    const res = await fetch(`${baseUrl}/api/share/${missingExpiresToken}`);
    expect(res.status).toBe(404);
  });

  it('GET /api/share/:token fails closed (404) when expiresAt is corrupt (not Timestamp or Date)', async () => {
    const corruptToken = 'corrupt_expires_token_222';
    const shareRepo = getShareRepository() as InMemoryRepository;
    shareRepo.seedShare(corruptToken, {
      id: `share_${corruptToken}`,
      shareToken: corruptToken,
      input: {
        eventType: 'birthday',
        subEvents: [],
        eventDate: '2026-11-20',
        city: 'Delhi',
        guestCount: 20,
        totalBudget: 10000,
        theme: '',
        dietaryPreferences: [],
        culturalNotes: '',
        language: 'english',
      },
      plan: {
        summary: 'Corrupted expiry plan',
        budget: [],
        timeline: [],
        vendors: [],
        ideas: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: '2099-12-31T23:59:59Z' as unknown as Date, // Plain string instead of Timestamp/Date
    });

    const res = await fetch(`${baseUrl}/api/share/${corruptToken}`);
    expect(res.status).toBe(404);
  });

  it('GET /api/share/:token returns 404 for nonexistent token', async () => {
    const res = await fetch(`${baseUrl}/api/share/nonexistent_token_12345`);
    expect(res.status).toBe(404);
  });

  it('enforces writeLimiter on POST /api/share (21st request returns 429)', async () => {
    const testWriteIp = '203.0.113.196'; // Isolated test client IP
    const payload = {
      input: {
        eventType: 'birthday',
        subEvents: [],
        eventDate: '2026-12-01',
        city: 'Pune',
        guestCount: 15,
        totalBudget: 15000,
        theme: '',
        dietaryPreferences: [],
        culturalNotes: '',
        language: 'english',
      },
      plan: {
        summary: 'Rate limit test plan',
        budget: [],
        timeline: [],
        vendors: [],
        ideas: [],
      },
    };

    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      const res = await fetch(`${baseUrl}/api/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': testWriteIp,
        },
        body: JSON.stringify(payload),
      });
      statuses.push(res.status);
    }

    // First 20 writes succeed with 200
    for (let i = 0; i < 20; i++) {
      expect(statuses[i]).toBe(200);
    }
    // 21st write is blocked by writeLimiter with 429
    expect(statuses[20]).toBe(429);
  });

  it('enforces rate limiting: 11 rapid POST /api/plan requests with invalid body returns 429 on the 11th while health page still returns 200', async () => {
    const responses: number[] = [];
    const testClientIp = '203.0.113.195'; // RFC 5737 TEST-NET-3 isolated IP

    // Send 11 rapid POST /api/plan requests with invalid body from isolated IP
    for (let i = 0; i < 11; i++) {
      const res = await fetch(`${baseUrl}/api/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': testClientIp,
        },
        body: JSON.stringify({ invalid: 'payload_data' }),
      });
      responses.push(res.status);
    }

    // The first 10 requests get through generationLimiter to body validation and return 400
    for (let i = 0; i < 10; i++) {
      expect(responses[i]).toBe(400);
    }

    // The 11th request MUST be blocked by generationLimiter with 429
    expect(responses[10]).toBe(429);

    // Other non-generation pages/routes still load normally with 200 OK
    const healthRes = await fetch(`${baseUrl}/api/health`, {
      headers: { 'X-Forwarded-For': testClientIp },
    });
    expect(healthRes.status).toBe(200);
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
    expect(Array.isArray(refined.ideas)).toBe(true);
    expect(['gemini', 'fallback']).toContain(refined.source);
  });
});
