import express, { Router } from 'express';
import { explainTradeoffsRequestSchema } from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';
import { explainTradeoffs } from '../services/tradeoffService.js';
import { runAiResponse } from './aiResponse.js';

const router = Router();

router.post(
  '/explain-tradeoffs',
  generationLimiter,
  express.json({ limit: '16kb' }),
  validateBody(explainTradeoffsRequestSchema),
  async (req, res) => {
    const body = explainTradeoffsRequestSchema.parse(req.body);
    await runAiResponse(req, res, (context) => explainTradeoffs(body, context));
  },
);

export default router;
