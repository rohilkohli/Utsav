import express, { Router } from 'express';
import { getTodayInKolkata, parseIntakeRequestSchema } from '../../shared/schemas.js';
import { parseEventDescription } from '../../shared/intake.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post(
  '/parse-intake',
  generationLimiter,
  express.json({ limit: '16kb' }),
  validateBody(parseIntakeRequestSchema),
  (req, res) => {
    const input = parseEventDescription(req.body.description, getTodayInKolkata());
    res.status(200).json({ input, source: 'fallback' });
  },
);

export default router;