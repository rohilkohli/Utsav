import { Router } from 'express';
import express from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { searchVendorsByCategory } from '../services/places.js';

const router = Router();

// Tight rate limit: Places API costs money per call
const vendorSearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many vendor searches. Please wait before trying again.' },
});

const SearchSchema = z.object({
  category: z.string().min(1).max(120),
  city: z.string().min(1).max(100),
  subEvent: z.string().max(80).optional(),
});

router.post(
  '/vendors/search',
  vendorSearchLimiter,
  express.json({ limit: '20kb' }),
  async (req, res) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res
        .status(503)
        .json({ error: 'GOOGLE_MAPS_API_KEY not configured on this server.' });
    }

    const parsed = SearchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', issues: parsed.error.issues });
    }

    const { category, city, subEvent } = parsed.data;

    try {
      const suggestions = await searchVendorsByCategory(category, city, apiKey, subEvent);
      res.json({ suggestions, query: { category, city, subEvent } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Places API unavailable';
      res.status(502).json({ error: message });
    }
  },
);

export default router;
