import { Router } from 'express';
import { refineInputSchema } from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';
import { refineIdeasSection } from '../services/gemini.js';

const router = Router();

/**
 * Re-generate/refine ideas for a specific section (e.g. food, decor, activities)
 */
router.post(
  '/refine',
  generationLimiter,
  validateBody(refineInputSchema),
  async (req, res) => {
    try {
      const { section, instruction, input, currentPlan } = req.body;
      const currentIdeas = currentPlan.ideas.filter((i: { section: string }) => i.section === section);

      const refinedIdeas = await refineIdeasSection(
        section,
        instruction,
        input,
        currentIdeas,
      );

      res.status(200).json({ ideas: refinedIdeas });
    } catch {
      res.status(500).json({ error: 'Failed to refine section ideas' });
    }
  },
);

export default router;
