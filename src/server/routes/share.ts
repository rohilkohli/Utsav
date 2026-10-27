import express, { Router } from 'express';
import { z } from 'zod';
import { wizardInputSchema, planOutputSchema, savedPlanSchema } from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { optionalAuth } from '../middleware/auth.js';
import { getShareRepository } from '../repositories/index.js';

const router = Router();

const shareRequestSchema = z.object({
  input: wizardInputSchema,
  plan: planOutputSchema,
});

/**
 * Create a read-only guest snapshot with 128-bit random token (expires in 30 days).
 * Protected by writeLimiter (20 req / 15 min, keyed per user if authenticated, per IP otherwise).
 */
router.post(
  '/share',
  optionalAuth,
  writeLimiter,
  express.json({ limit: '200kb' }),
  validateBody(shareRequestSchema),
  async (req, res) => {
    try {
      const { input, plan } = req.body;
      const shareRepo = getShareRepository();
      const { shareToken, expiresAt } = await shareRepo.createShare(input, plan);

      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      const shareUrl = `${protocol}://${host}/share/${shareToken}`;

      res.status(200).json({
        shareToken,
        shareUrl,
        expiresAt,
      });
    } catch {
      res.status(500).json({ error: 'Failed to create shareable link' });
    }
  },
);

/**
 * Retrieve read-only guest snapshot by token.
 * Fails closed with 404 if expired, missing, or corrupt.
 * Maps explicitly through savedPlanSchema to prevent leaking internal fields.
 */
router.get('/share/:token', async (req, res) => {
  try {
    const shareRepo = getShareRepository();
    const snapshot = await shareRepo.getShare(req.params.token);
    if (!snapshot) {
      res.status(404).json({ error: 'Shared plan not found or link has expired' });
      return;
    }
    res.status(200).json(savedPlanSchema.parse(snapshot));
  } catch {
    res.status(500).json({ error: 'Failed to retrieve shared plan' });
  }
});

export default router;
