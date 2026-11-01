import express, { Router } from 'express';
import { explainTradeoffsRequestSchema } from '../../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post(
  '/explain-tradeoffs',
  generationLimiter,
  express.json({ limit: '16kb' }),
  validateBody(explainTradeoffsRequestSchema),
  (req, res) => {
    const { overBudgetAmount, options } = req.body;
    const summary = options.map((option: { label: string; savings: number }) => `${option.label} saves ₹${option.savings.toLocaleString('en-IN')}`).join('; ');
    res.status(200).json({
      explanation: `You are ₹${overBudgetAmount.toLocaleString('en-IN')} over budget. ${summary}. Choose the option that protects the ceremonies and vendors most important to your family.`,
      source: 'fallback',
    });
  },
);

export default router;