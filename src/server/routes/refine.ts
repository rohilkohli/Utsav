import express, { Router } from 'express';
import { refineInputSchema } from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';
import { refineIdeasSection } from '../services/gemini.js';
import { runAiResponse } from './aiResponse.js';

const router = Router();
router.post(
  '/refine',
  generationLimiter,
  express.json({ limit: '16kb' }),
  validateBody(refineInputSchema),
  async (req, res) => {
    const { section, instruction, input, currentPlan } = refineInputSchema.parse(req.body);
    await runAiResponse(req, res, async (context) => {
      const currentIdeas = currentPlan.ideas.filter((idea) => idea.section === section);
      const { ideas, source, model } = await refineIdeasSection(
        section,
        instruction,
        input,
        currentIdeas,
        context,
      );
      return { ideas, meta: { source, model } };
    });
  },
);
export default router;
