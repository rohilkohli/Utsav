import helmet from 'helmet';
import type { RequestHandler } from 'express';

const firebaseProject = process.env.FIREBASE_PROJECT_ID || '*';

export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://apis.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://lh3.googleusercontent.com', 'https:'],
      connectSrc: [
        "'self'",
        'https://*.googleapis.com',
        'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com',
        'https://firestore.googleapis.com',
      ],
      frameSrc: [
        "'self'",
        'https://accounts.google.com',
        `https://${firebaseProject}.firebaseapp.com`,
        'https://*.firebaseapp.com',
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
});
