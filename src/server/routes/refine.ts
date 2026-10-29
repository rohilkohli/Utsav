import express, { Router } from 'express';
import { refineInputSchema } from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';
import { refineIdeasSection } from '../services/gemini.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * Re-generate/refine ideas for a specific section (e.g. food, decor, activities).
 * generationLimiter runs first (before body parsing & validation).
 */
router.post(
  '/refine',
  generationLimiter,
  express.json({ limit: '100kb' }),
  validateBody(refineInputSchema),
  async (req, res) => {
    try {
      const { section, instruction, input, currentPlan } = req.body;
      const currentIdeas = currentPlan.ideas.filter(
        (i: { section: string }) => i.section === section,
      );

      const { ideas: refinedIdeas, source } = await refineIdeasSection(
        section,
        instruction,
        input,
        currentIdeas,
      );

      res.status(200).json({
        ideas: refinedIdeas,
        meta: { source },
      });
    } catch (err) {
      logger.error(`POST /api/refine failed: ${err instanceof Error ? err.message : String(err)}`);
      res.status(500).json({ error: 'Failed to refine section ideas' });
    }
  },
);

export default router;
