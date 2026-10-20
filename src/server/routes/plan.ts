import { Router } from 'express';
import { nanoid } from 'nanoid';
import {
  generatePlanRequestSchema,
  savedPlanSchema,
} from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';
import { generateEventPlan } from '../services/gemini.js';
import { savePlanToDb, getPlanFromDb } from '../services/firestore.js';

const router = Router();

/**
 * Generate full structured event plan
 */
router.post(
  '/plan',
  generationLimiter,
  validateBody(generatePlanRequestSchema),
  async (req, res) => {
    try {
      const { input } = req.body;
      const { plan, isFallback } = await generateEventPlan(input);
      const planId = nanoid();

      const savedPlan = {
        id: planId,
        input,
        plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await savePlanToDb(savedPlan);

      res.status(200).json({
        plan,
        planId,
        isFallback,
      });
    } catch {
      res.status(500).json({ error: 'Failed to generate event plan' });
    }
  },
);

/**
 * Retrieve saved plan by ID
 */
router.get('/plan/:id', async (req, res) => {
  try {
    const plan = await getPlanFromDb(req.params.id);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    res.status(200).json(plan);
  } catch {
    res.status(500).json({ error: 'Failed to retrieve plan' });
  }
});

/**
 * Update saved plan
 */
router.put('/plan/:id', async (req, res) => {
  try {
    const parsed = savedPlanSchema.safeParse({ ...req.body, id: req.params.id });
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid plan data', details: parsed.error.issues });
      return;
    }
    await savePlanToDb(parsed.data);
    res.status(200).json({ success: true, plan: parsed.data });
  } catch {
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

export default router;
