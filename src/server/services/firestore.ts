import crypto from 'crypto';
import type { SavedPlan, WizardInput, PlanOutput } from '../../shared/schemas.js';

let db: FirebaseFirestore.Firestore | null = null;
const inMemoryStore = new Map<string, SavedPlan>();

/** Initialize Firestore via Admin SDK with Application Default Credentials */
async function getFirestore(): Promise<FirebaseFirestore.Firestore | null> {
  if (db) return db;

  if (process.env.NODE_ENV === 'test') {
    return null; // Always use in-memory store in unit tests
  }

  try {
    const admin = await import('firebase-admin');
    if (!admin.getApps().length) {
      admin.initializeApp();
    }
    db = admin.firestore();
    return db;
  } catch {
    // If ADC is not configured (e.g. local offline dev), gracefully fall back to in-memory store
    return null;
  }
}

/**
 * Save or update an event plan in Firestore
 */
export async function savePlanToDb(plan: SavedPlan): Promise<void> {
  inMemoryStore.set(plan.id, plan);
  const firestore = await getFirestore();
  if (firestore) {
    try {
      await firestore.collection('plans').doc(plan.id).set(plan, { merge: true });
    } catch {
      // In-memory fallback handles local storage
    }
  }
}

/**
 * Retrieve an event plan by ID
 */
export async function getPlanFromDb(id: string): Promise<SavedPlan | null> {
  const firestore = await getFirestore();
  if (firestore) {
    try {
      const doc = await firestore.collection('plans').doc(id).get();
      if (doc.exists) {
        return doc.data() as SavedPlan;
      }
    } catch {
      // Fall through to inMemoryStore
    }
  }
  return inMemoryStore.get(id) || null;
}

/**
 * Creates a public, read-only guest snapshot under a secure 128-bit random token.
 * Valid for 30 days. Contains NO user identification.
 */
export async function createShareSnapshot(
  input: WizardInput,
  plan: PlanOutput,
): Promise<{ shareToken: string; expiresAt: string }> {
  // 128-bit cryptographically secure random token (32 hex characters)
  const shareToken = crypto.randomBytes(16).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const snapshot: SavedPlan = {
    id: `share_${shareToken}`,
    shareToken,
    input,
    plan,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt,
  };

  inMemoryStore.set(shareToken, snapshot);

  const firestore = await getFirestore();
  if (firestore) {
    try {
      await firestore.collection('shares').doc(shareToken).set(snapshot);
    } catch {
      // In-memory store handles it
    }
  }

  return { shareToken, expiresAt };
}

/**
 * Retrieves a shared snapshot by token, verifying expiry.
 */
export async function getShareSnapshot(shareToken: string): Promise<SavedPlan | null> {
  let snapshot = inMemoryStore.get(shareToken) || null;

  if (!snapshot) {
    const firestore = await getFirestore();
    if (firestore) {
      try {
        const doc = await firestore.collection('shares').doc(shareToken).get();
        if (doc.exists) {
          snapshot = doc.data() as SavedPlan;
        }
      } catch {
        // Fall back
      }
    }
  }

  if (!snapshot) return null;

  // Check if expired
  if (snapshot.expiresAt) {
    const now = new Date().toISOString();
    if (now > snapshot.expiresAt) {
      return null;
    }
  }

  return snapshot;
}
