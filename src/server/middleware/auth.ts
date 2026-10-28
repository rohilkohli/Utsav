import type { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export type TokenVerifier = (token: string) => Promise<AuthenticatedUser | null>;

/**
 * Production verifier: Strictly calls Firebase Admin SDK admin.auth().verifyIdToken()
 */
const defaultVerifier: TokenVerifier = async (token: string): Promise<AuthenticatedUser | null> => {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    admin.initializeApp(projectId ? { projectId } : undefined);
  }
  const decoded = await admin.auth().verifyIdToken(token);
  return {
    uid: decoded.uid,
    email: decoded.email,
  };
};

let activeVerifier: TokenVerifier = defaultVerifier;

/**
 * Configure an injected TokenVerifier (used in test suites to mock verification
 * without NODE_ENV branching in production code). Passing null resets to the default
 * production verifier that calls admin.auth().verifyIdToken().
 */
export function setTokenVerifier(verifier: TokenVerifier | null): void {
  activeVerifier = verifier ?? defaultVerifier;
}

export async function verifyToken(token: string): Promise<AuthenticatedUser | null> {
  try {
    return await activeVerifier(token);
  } catch {
    return null;
  }
}

/**
 * Middleware: Requires a valid Firebase ID token in Authorization: Bearer <token>.
 * Calls active token verifier (defaulting strictly to admin.auth().verifyIdToken()).
 * Rejects with 401 if missing or invalid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7).trim();
  const user = await verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    return;
  }

  req.user = user;
  next();
}

/**
 * Middleware: Attaches user if a valid Firebase ID token is provided; otherwise continues as guest.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = await verifyToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}
