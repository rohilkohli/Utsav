import express, { Router } from 'express';
import { getTodayInKolkata, parseIntakeRequestSchema } from '../../shared/schemas.js';
import { parseIntake } from '../services/intakeService.js';
import { runAiResponse } from './aiResponse.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post(
  '/parse-intake',
  generationLimiter,
  express.json({ limit: '16kb' }),
  validateBody(parseIntakeRequestSchema),
  async (req, res) => {
    const body = parseIntakeRequestSchema.parse(req.body);
    await runAiResponse(req, res, (context) =>
      parseIntake(body.description, getTodayInKolkata(), context),
    );
  },
);

export default router;
