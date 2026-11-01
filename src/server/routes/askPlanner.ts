import express, { Router } from 'express';
import { askPlannerRequestSchema } from '../../shared/schemas.js';
import { getTodayInKolkata } from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';
import { askPlanner } from '../services/advisorService.js';
import { runAiResponse } from './aiResponse.js';

const router = Router();

router.post(
  '/ask-planner',
  generationLimiter,
  express.json({ limit: '16kb' }),
  validateBody(askPlannerRequestSchema),
  async (req, res) => {
    const body = askPlannerRequestSchema.parse(req.body);
    await runAiResponse(req, res, (context) => askPlanner(body, getTodayInKolkata(), context));
  },
);

export default router;
