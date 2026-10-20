import rateLimit from 'express-rate-limit';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 mins default
const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10); // 10 requests per 15 min

/** Strict rate limiter for AI generation and refinement endpoints */
export const generationLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many celebration planning requests. Please wait a few minutes before trying again.',
  },
});
