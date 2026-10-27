import express, { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import {
  generatePlanRequestSchema,
  savedPlanSchema,
  updatePlanRequestSchema,
  wizardInputSchema,
  planOutputSchema,
} from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { generateEventPlan } from '../services/gemini.js';
import { getPlanRepository } from '../repositories/index.js';

const router = Router();

const savePlanRequestSchema = z
  .object({
    input: wizardInputSchema,
    plan: planOutputSchema,
  })
  .strict();

/**
 * Generate full structured event plan.
 * generationLimiter runs first (before body parsing & validation) so abusive/rapid requests are throttled.
 *
 * IDOR / Plan Ownership:
 * Only signed-in users persist plans to Firestore. Guests keep the plan client-side
 * and can still share snapshots via POST /api/share.
 */
router.post(
  '/plan',
  generationLimiter,
  optionalAuth,
  express.json({ limit: '100kb' }),
  validateBody(generatePlanRequestSchema),
  async (req, res) => {
    try {
      const { input } = req.body;
      const { plan, source } = await generateEventPlan(input);
      const planId = crypto.randomUUID();

      // Only signed-in users persist plans to Firestore
      if (req.user) {
        const now = new Date().toISOString();
        const savedPlan = {
          id: planId,
          ownerUid: req.user.uid,
          input,
          plan,
          createdAt: now,
          updatedAt: now,
        };

        const planRepo = getPlanRepository();
        await planRepo.savePlan(savedPlan);
      }

      res.status(200).json({
        plan,
        planId,
        meta: { source },
      });
    } catch {
      res.status(500).json({ error: 'Failed to generate event plan' });
    }
  },
);

/**
 * Save an existing event plan for an authenticated user.
 * Server owns id (unguessable UUID), ownerUid (verified token), createdAt and updatedAt.
 */
router.post(
  '/plan/save',
  requireAuth,
  writeLimiter,
  express.json({ limit: '200kb' }),
  validateBody(savePlanRequestSchema),
  async (req, res) => {
    try {
      const { input, plan } = req.body;
      const planId = crypto.randomUUID();
      const now = new Date().toISOString();

      const savedPlan = {
        id: planId,
        ownerUid: req.user!.uid,
        input,
        plan,
        createdAt: now,
        updatedAt: now,
      };

      const planRepo = getPlanRepository();
      await planRepo.savePlan(savedPlan);

      res.status(200).json({
        success: true,
        plan: savedPlanSchema.parse(savedPlan),
      });
    } catch {
      res.status(500).json({ error: 'Failed to save plan' });
    }
  },
);

/**
 * Retrieve saved plan by ID.
 * Requires authentication: Returns 404 unless doc.ownerUid matches caller's uid (IDOR prevention).
 * Maps response explicitly to transport schema.
 */
router.get('/plan/:id', requireAuth, async (req, res) => {
  try {
    const planRepo = getPlanRepository();
    const plan = await planRepo.getPlan(req.params.id);

    // Fail closed with 404 for missing documents or unauthorized cross-user access
    if (!plan || plan.ownerUid !== req.user!.uid) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    res.status(200).json(savedPlanSchema.parse(plan));
  } catch {
    res.status(500).json({ error: 'Failed to retrieve plan' });
  }
});

/**
 * Update saved plan.
 * Requires authentication and rate limiting.
 * Server owns id, ownerUid, createdAt and updatedAt.
 * Body is strictly validated to editable fields only (updatePlanRequestSchema).
 * Returns 404 unless doc.ownerUid matches caller's uid.
 */
router.put(
  '/plan/:id',
  requireAuth,
  writeLimiter,
  express.json({ limit: '200kb' }),
  validateBody(updatePlanRequestSchema),
  async (req, res) => {
    try {
      const planRepo = getPlanRepository();
      const existingPlan = await planRepo.getPlan(req.params.id);

      if (!existingPlan || existingPlan.ownerUid !== req.user!.uid) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }

      const { plan, input } = req.body;
      const updatedPlan = {
        id: existingPlan.id,
        ownerUid: existingPlan.ownerUid,
        input: input ?? existingPlan.input,
        plan,
        createdAt: existingPlan.createdAt,
        updatedAt: new Date().toISOString(),
      };

      await planRepo.savePlan(updatedPlan);
      res.status(200).json({
        success: true,
        plan: savedPlanSchema.parse(updatedPlan),
      });
    } catch {
      res.status(500).json({ error: 'Failed to update plan' });
    }
  },
);

export default router;
