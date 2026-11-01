import express, { Router } from 'express';
import { extractQuoteRequestSchema } from '../../shared/quotes.js';
import { generationLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { extractQuote } from '../services/quoteService.js';
import { runAiResponse } from './aiResponse.js';

const router = Router();

router.post(
  '/extract-quote',
  generationLimiter,
  express.json({ limit: '16kb' }),
  validateBody(extractQuoteRequestSchema),
  async (req, res) => {
    const body = extractQuoteRequestSchema.parse(req.body);
    await runAiResponse(req, res, (context) => extractQuote(body.text, body.category, context));
  },
);

export default router;
