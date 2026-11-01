import { describe, expect, it } from 'vitest';
import { secretResponseLeakLines } from './secretResponseGuard.js';

describe('server-secret response hygiene guard', () => {
  it.each([
    `router.get('/voice', (req, res) => res.json({ apiKey: process.env.GEMINI_API_KEY }));`,
    `router.get('/debug', (req, res) => res.send(process.env));`,
    `const environment = process.env; router.get('/debug', (req, res) => res.json(environment));`,
    `const { 'GOOGLE_MAPS_API_KEY': key } = process.env; router.get('/', (req, res) => res.send(key));`,
    `const key = process.env.GEMINI_API_KEY; router.get('/', (req, res) => res.send(encodeURIComponent(key)));`,
    `router.get('/maps', (req, response) => response.status(200).send(process.env['GOOGLE_MAPS_API_KEY']));`,
    `const key = process.env.GEMINI_API_KEY; router.get('/', (req, res) => res.json({ key }));`,
    `const key = process.env.GEMINI_API_KEY; const payload = { nested: { key } }; router.get('/', (req, res) => res.json(payload));`,
    `const environment = process.env; const key = environment.GOOGLE_MAPS_API_KEY; router.get('/', (req, reply) => reply.send(JSON.stringify({ key })));`,
    `const { GEMINI_API_KEY: key } = process.env; router.get('/', (req, response) => response.json({ key }));`,
    `let key; key = process.env.GEMINI_API_KEY; router.get('/', (req, response) => response.send(key));`,
    `const key = process.env.GEMINI_API_KEY; router.get('/', (req, result) => { const reply = result; reply.status(200).json({ value: String(key) }); });`,
  ])('rejects direct or locally aliased secret serialization: %s', (text) => {
    expect(secretResponseLeakLines(text)).toEqual([1]);
  });
  it.each([
    `const key = process.env.GEMINI_API_KEY; router.get('/', (req, res) => res.json({ enabled: Boolean(key), wsPath: '/api/voice/ws' }));`,
    `router.get('/', (req, res) => res.json({ enabled: !!process.env.GEMINI_API_KEY, configured: process.env.GOOGLE_MAPS_API_KEY !== undefined }));`,
    `const key = process.env.GEMINI_API_KEY; const upstream = new WebSocket('wss://google.example?key=' + key); router.get('/', (req, res) => res.status(410).json({ error: 'Use relay' }));`,
    `const key = process.env.GOOGLE_MAPS_API_KEY; const places = await searchVendorsByCategory('food', 'Mumbai', key); router.get('/', (req, res) => res.json({ places }));`,
    `const key = process.env.GEMINI_API_KEY; router.get('/', (req, res) => { const key = 'public display text'; res.send({ key }); });`,
    `router.get('/', (req, res) => res.json({ firebase: { apiKey: process.env.FIREBASE_API_KEY } }));`,
    `const key = process.env.GEMINI_API_KEY; router.get('/', (req, res) => res.json({ status: key ? 'configured' : 'missing' }));`,
  ])('permits server-only credential use and public metadata: %s', (text) => {
    expect(secretResponseLeakLines(text)).toEqual([]);
  });
  it('uses AST nodes rather than matching inert strings or comments', () => {
    expect(
      secretResponseLeakLines(`// res.json(process.env.GEMINI_API_KEY)
const documentation = 'res.send(process.env.GOOGLE_MAPS_API_KEY)';
router.get('/', (req, res) => res.send(documentation));`),
    ).toEqual([]);
  });
});
