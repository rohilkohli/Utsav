import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const voiceLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

const router = Router();

router.get('/voice/session', voiceLimiter, (_req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Voice not configured on this server.' });
  res.json({ apiKey });
});

export default router;
