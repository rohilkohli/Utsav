import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { createApp } from '../index.js';
import { setTokenVerifier } from '../middleware/auth.js';

describe('Security Headers & Rate Limiting', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    setTokenVerifier(async (token: string) => {
      if (token.startsWith('test-token-')) {
        const uid = token.replace('test-token-', '').trim();
        if (uid.length > 0) return { uid, email: `${uid}@test.local` };
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

  describe('Content Security Policy', () => {
    it('sets a Content-Security-Policy header on every response', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.headers.get('content-security-policy')).toBeTruthy();
    });

    it('CSP default-src is restricted to self', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      const csp = res.headers.get('content-security-policy') ?? '';
      expect(csp).toContain("default-src 'self'");
    });

    it('CSP object-src is none (blocks Flash/plugins)', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      const csp = res.headers.get('content-security-policy') ?? '';
      expect(csp).toContain("object-src 'none'");
    });

    it('CSP connect-src allows Gemini Live WebSocket (wss://)', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      const csp = res.headers.get('content-security-policy') ?? '';
      expect(csp).toContain('wss://generativelanguage.googleapis.com');
    });

    it('CSP frame-src allows Google accounts for OAuth popup', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      const csp = res.headers.get('content-security-policy') ?? '';
      expect(csp).toContain('https://accounts.google.com');
    });
  });

  describe('HTTP Security Headers', () => {
    it('sets X-Frame-Options to SAMEORIGIN', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      const xfo = res.headers.get('x-frame-options');
      expect(xfo).toBe('SAMEORIGIN');
    });

    it('sets X-Content-Type-Options to nosniff', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('does not expose X-Powered-By header', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.headers.get('x-powered-by')).toBeNull();
    });
  });

  describe('Voice session endpoint', () => {
    it('GET /api/voice/session returns 503 when GEMINI_API_KEY is not set', async () => {
      const saved = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      try {
        const res = await fetch(`${baseUrl}/api/voice/session`);
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error).toMatch(/not configured/i);
      } finally {
        if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
      }
    });

    it('GET /api/voice/session returns 200 with apiKey when GEMINI_API_KEY is set', async () => {
      const saved = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'test-api-key-12345';
      try {
        const res = await fetch(`${baseUrl}/api/voice/session`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.apiKey).toBe('test-api-key-12345');
      } finally {
        if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
        else delete process.env.GEMINI_API_KEY;
      }
    });
  });

  describe('Input validation & error handling', () => {
    it('POST /api/plan with missing required fields returns 400 validation error', async () => {
      const res = await fetch(`${baseUrl}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: {} }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    });

    it('POST /api/plan with negative budget returns 400', async () => {
      const res = await fetch(`${baseUrl}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: {
            eventType: 'birthday',
            subEvents: [],
            eventDate: '2026-12-01',
            city: 'Mumbai',
            guestCount: 20,
            totalBudget: -5000,
            theme: '',
            dietaryPreferences: [],
            culturalNotes: '',
            language: 'english',
          },
        }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/plan with negative guest count returns 400', async () => {
      const res = await fetch(`${baseUrl}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: {
            eventType: 'birthday',
            subEvents: [],
            eventDate: '2026-12-01',
            city: 'Mumbai',
            guestCount: -1,
            totalBudget: 20000,
            theme: '',
            dietaryPreferences: [],
            culturalNotes: '',
            language: 'english',
          },
        }),
      });
      expect(res.status).toBe(400);
    });

    it('unknown API routes do not leak server internals (no stack traces)', async () => {
      const res = await fetch(`${baseUrl}/api/nonexistent`);
      const text = await res.text();
      // SPA catch-all may return 200 with index.html — that is fine.
      // What must NOT happen is a stack trace leaking server internals.
      expect(text).not.toMatch(/Error:\s+at /);
      expect(text).not.toMatch(/node_modules/);
    });

    it('GET /api/plan without auth returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/plan/some-plan-id`);
      expect(res.status).toBe(401);
    });
  });

  describe('CORS policy', () => {
    it('does not set Access-Control-Allow-Origin header by default (same-origin only)', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });
  });
});
