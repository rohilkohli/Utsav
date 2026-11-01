import helmet from 'helmet';
import type { Request, RequestHandler, Response } from 'express';

const firebaseProject = process.env.FIREBASE_PROJECT_ID || '*';

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://apis.google.com'],
      styleSrc: ["'self'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://lh3.googleusercontent.com'],
      connectSrc: [
        "'self'",
        'https://*.googleapis.com',
        'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com',
      ],
      frameSrc: [
        "'self'",
        'https://accounts.google.com',
        `https://${firebaseProject}.firebaseapp.com`,
        'https://*.firebaseapp.com',
      ],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  hsts: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
});

export const securityHeaders: RequestHandler = (req: Request, res: Response, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)',
  );
  helmetMiddleware(req, res, next);
};

function expectedHost(req: Request): string {
  const forwardedHost = req.headers['x-forwarded-host'];
  return (
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.headers.host || ''
  );
}

export const sameOriginGuard: RequestHandler = (req, res, next) => {
  if (!['POST', 'PUT'].includes(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  let originHost = '';
  try {
    originHost = origin ? new URL(origin).host : '';
  } catch {
    originHost = '';
  }

  if (!originHost || originHost !== expectedHost(req)) {
    res.status(403).json({ error: 'FORBIDDEN_ORIGIN' });
    return;
  }

  const contentType = req.headers['content-type']?.toLowerCase() || '';
  if (!contentType.startsWith('application/json')) {
    res.status(415).json({ error: 'UNSUPPORTED_MEDIA_TYPE' });
    return;
  }

  next();
};
