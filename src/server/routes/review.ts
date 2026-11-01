/**
 * POST /api/review-plan
 *
 * AI-powered plan review endpoint. Accepts a full celebration plan and wizard input,
 * then returns structured feedback from Gemini — strengths, risks, and actionable
 * suggestions — with a heuristic fallback when the API is unavailable.
 *
 * Rate-limited by generationLimiter (shared with /api/plan and /api/refine).
 * Request body: { plan: PlanOutput, input: WizardInput }
 * Response: { review: PlanReview, meta: { source: 'gemini' | 'fallback' } }
 */
import express, { Router } from 'express';
import { z } from 'zod';
import { planOutputSchema, wizardInputSchema } from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';
import { reviewPlan } from '../services/gemini.js';
import { logger } from '../lib/logger.js';

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
    } catch (err) {
      logger.error(`POST /api/review-plan failed: ${err instanceof Error ? err.message : String(err)}`);
      res.status(500).json({ error: 'Failed to review plan' });
    }
  },
);

export default router;
