import express, { Router } from 'express';
import { z } from 'zod';
import { planOutputSchema, wizardInputSchema } from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';
import { reviewPlan } from '../services/gemini.js';
import { runAiResponse } from './aiResponse.js';

const router = Router();
const reviewPlanRequestSchema = z.object({ plan: planOutputSchema, input: wizardInputSchema });
router.post(
  '/review-plan',
  generationLimiter,
  express.json({ limit: '100kb' }),
  validateBody(reviewPlanRequestSchema),
  async (req, res) => {
    const { plan, input } = reviewPlanRequestSchema.parse(req.body);
    await runAiResponse(req, res, async (context) => {
      const { review, source, model } = await reviewPlan(plan, input, context);
      return { review, meta: { source, model } };
    });
  },
);
export default router;
