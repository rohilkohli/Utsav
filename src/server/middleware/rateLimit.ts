import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 mins default
const maxGeneration = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10); // 10 requests per 15 min
const maxWrites = parseInt(process.env.RATE_LIMIT_MAX_WRITES || '20', 10); // 20 requests per 15 min
const maxReads = parseInt(process.env.RATE_LIMIT_MAX_READS || '60', 10); // 60 requests per 15 min

/** Strict rate limiter for AI generation and refinement endpoints */
export const generationLimiter = rateLimit({
  windowMs,
  max: maxGeneration,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many celebration planning requests. Please wait a few minutes before trying again.',
  },
});

/** Rate limiter for read endpoints: GET /api/share/:token (60 req / 15 min) — prevents token enumeration attacks */
export const readLimiter = rateLimit({
  windowMs,
  max: maxReads,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please wait a few minutes before trying again.',
  },
});

/** Rate limiter for write endpoints: POST /api/share and plan save/update (20 req / 15 min, keyed per IP, per uid when signed in) */
export const writeLimiter = rateLimit({
  windowMs,
  max: maxWrites,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    if (req.user?.uid) {
      return `uid:${req.user.uid}`;
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  message: {
    error: 'Too many write requests. Please wait a few minutes before trying again.',
  },
});
