import express, { Router } from 'express';
import { askPlannerRequestSchema } from '../../shared/schemas.js';
import { localAnswer } from '../../shared/advisor.js';
import { getTodayInKolkata } from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';
import { logger } from '../lib/logger.js';

const router = Router();

router.post(
  '/ask-planner',
  generationLimiter,
  express.json({ limit: '16kb' }),
  validateBody(askPlannerRequestSchema),
  async (req, res) => {
    try {
      const { question, plan, input } = req.body;
      const answer = localAnswer(question, plan, input, getTodayInKolkata());
      res.status(200).json({ answer, source: 'fallback' });
    } catch (error) {
      logger.error(`POST /api/ask-planner failed: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to answer planner question' });
    }
  },
);

export default router;