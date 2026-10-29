import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { securityHeaders } from './middleware/security.js';
import configRoutes from './routes/config.js';
import planRoutes from './routes/plan.js';
import refineRoutes from './routes/refine.js';
import reviewRoutes from './routes/review.js';
import shareRoutes from './routes/share.js';
import vendorRoutes from './routes/vendors.js';
import voiceRoutes from './routes/voice.js';
import { validateEnv } from './env.js';
import { initRepositories } from './repositories/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): express.Application {
  const app = express();

  // Cloud Run proxies requests: trust first proxy so rate-limit uses true client IP
  app.set('trust proxy', 1);

  // Gzip / Brotli response compression
  app.use(compression());

  // Security headers with CSP & COOP
  app.use(securityHeaders);

  // Note: Per-route express.json() parsers are mounted directly on POST/PUT endpoints
  // to ensure generationLimiter executes BEFORE body parsing/validation on AI endpoints.

  // API Health Check
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  });

  // Mount API routes
  app.use('/api', configRoutes);
  app.use('/api', planRoutes);
  app.use('/api', refineRoutes);
  app.use('/api', reviewRoutes);
  app.use('/api', shareRoutes);
  app.use('/api', vendorRoutes);
  app.use('/api', voiceRoutes);

  // In production or when client is built, serve client assets
  const clientDist = path.resolve(__dirname, '../client');

  // Hashed Vite static assets: cache immutably for 1 year
  app.use(
    '/assets',
    express.static(path.join(clientDist, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }),
  );

  // Other static files (favicon, etc.)
  app.use(
    express.static(clientDist, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          // Never cache HTML so updates propagate immediately
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    }),
  );

  // SPA fallback: return index.html for client-side routing
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) {
        res.status(200).send('<h1>Utsav API Server is live</h1>');
      }
    });
  });

  return app;
}

const app = createApp();
const PORT = parseInt(process.env.PORT || '3001', 10);

if (process.env.NODE_ENV !== 'test') {
  try {
    validateEnv();
    initRepositories();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    process.stdout.write(`🎉 Utsav server running on port ${PORT}\n`);
  });
}

export default app;
