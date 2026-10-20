import { Router } from 'express';
import { z } from 'zod';
import { wizardInputSchema, planOutputSchema } from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { createShareSnapshot, getShareSnapshot } from '../services/firestore.js';

const router = Router();

const shareRequestSchema = z.object({
  input: wizardInputSchema,
  plan: planOutputSchema,
});

/**
 * Create a read-only guest snapshot with 128-bit random token (expires in 30 days)
 */
router.post('/share', validateBody(shareRequestSchema), async (req, res) => {
  try {
    const { input, plan } = req.body;
    const { shareToken, expiresAt } = await createShareSnapshot(input, plan);

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
});

/**
 * Retrieve read-only guest snapshot by token
 */
router.get('/share/:token', async (req, res) => {
  try {
    const snapshot = await getShareSnapshot(req.params.token);
    if (!snapshot) {
      res.status(404).json({ error: 'Shared plan not found or link has expired' });
      return;
    }
    res.status(200).json(snapshot);
  } catch {
    res.status(500).json({ error: 'Failed to retrieve shared plan' });
  }
});

export default router;
