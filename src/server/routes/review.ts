import express, { Router } from 'express';
import { z } from 'zod';
import { planOutputSchema, wizardInputSchema } from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';
import { reviewPlan } from '../services/gemini.js';

const router = Router();

const reviewPlanRequestSchema = z.object({
  plan: planOutputSchema,
  input: wizardInputSchema,
});

router.post(
  '/review-plan',
  generationLimiter,
  express.json({ limit: '100kb' }),
  validateBody(reviewPlanRequestSchema),
  async (req, res) => {
    try {
      const { plan, input } = req.body;
      const { review, source } = await reviewPlan(plan, input);
      res.status(200).json({ review, meta: { source } });
    } catch {
      res.status(500).json({ error: 'Failed to review plan' });
    }
  },
);

export default router;
