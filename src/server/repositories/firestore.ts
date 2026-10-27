import admin from 'firebase-admin';
import crypto from 'crypto';
import { savedPlanSchema, type SavedPlan, type WizardInput, type PlanOutput } from '../../shared/schemas.js';
import type { PlanRepository, ShareRepository, ShareSnapshotResult } from './types.js';

/**
 * Production repository backed by Google Cloud Firestore (via firebase-admin).
 * Stores plans under collection('plans') and shareable guest snapshots under collection('shares').
 *
 * Expiry timestamps are stored as native Firestore Timestamps (admin.firestore.Timestamp)
 * to ensure compatibility with Cloud Firestore's native TTL (Time-To-Live) policy.
 */
export class FirestoreRepository implements PlanRepository, ShareRepository {
  private db: FirebaseFirestore.Firestore | null = null;

  public getDb(): FirebaseFirestore.Firestore {
    if (this.db) return this.db;

    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      admin.initializeApp(projectId ? { projectId } : undefined);
    }
    this.db = admin.firestore();
    return this.db;
  }

  /**
   * Save or update an event plan in Firestore collection('plans')
   */
  async savePlan(plan: SavedPlan): Promise<void> {
    const db = this.getDb();
    await db.collection('plans').doc(plan.id).set(plan, { merge: true });
  }

  /**
   * Retrieve an event plan by ID from Firestore collection('plans')
   */
  async getPlan(id: string): Promise<SavedPlan | null> {
    const db = this.getDb();
    const doc = await db.collection('plans').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data() as SavedPlan;
    // Map explicitly to transport schema so internal database properties never leak
    return savedPlanSchema.parse(data);
  }

  /**
   * Create a public read-only guest snapshot under collection('shares') with a 128-bit random token.
   * expiresAt is stored as an admin.firestore.Timestamp for Cloud Firestore TTL deletion.
   */
  async createShare(input: WizardInput, plan: PlanOutput): Promise<ShareSnapshotResult> {
    const shareToken = crypto.randomBytes(16).toString('hex');
    const now = new Date();
    const expiresAtDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const baseDoc = {
      id: `share_${shareToken}`,
      shareToken,
      input,
      plan,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const db = this.getDb();
    const timestamp = admin.firestore.Timestamp.fromDate(expiresAtDate);
    await db.collection('shares').doc(shareToken).set({
      ...baseDoc,
      expiresAt: timestamp,
    });

    return {
      shareToken,
      expiresAt: expiresAtDate.toISOString(),
    };
  }

  /**
   * Retrieve a shared snapshot from collection('shares') by token.
   * Fail-closed: If expiresAt is missing or is not a Timestamp/Date, treat as expired and return null.
   * Explicitly parses against savedPlanSchema on output.
   */
  async getShare(shareToken: string): Promise<SavedPlan | null> {
    const db = this.getDb();
    const doc = await db.collection('shares').doc(shareToken).get();
    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) return null;

    // Fail-closed TTL check: if expiresAt is missing or invalid type, treat as expired
    if (!data.expiresAt) {
      return null;
    }

    const expiresAt = data.expiresAt;
    const isTimestamp =
      typeof expiresAt === 'object' &&
      expiresAt !== null &&
      'toMillis' in expiresAt &&
      typeof (expiresAt as { toMillis: unknown }).toMillis === 'function';
    const isDate = expiresAt instanceof Date;

    if (!isTimestamp && !isDate) {
      return null;
    }

    const expiryMs = isTimestamp
      ? (expiresAt as { toMillis: () => number }).toMillis()
      : (expiresAt as Date).getTime();

    if (expiryMs <= Date.now()) {
      return null;
    }

    // Convert Firestore Timestamp to ISO string for the client transport boundary
    let expiresAtIso: string;
    if (isTimestamp && 'toDate' in expiresAt && typeof (expiresAt as { toDate: unknown }).toDate === 'function') {
      expiresAtIso = (expiresAt as { toDate: () => Date }).toDate().toISOString();
    } else if (isDate) {
      expiresAtIso = (expiresAt as Date).toISOString();
    } else {
      return null;
    }

    // Map explicitly to transport schema so internal fields never leak
    return savedPlanSchema.parse({
      id: data.id,
      ownerUid: data.ownerUid,
      userId: data.userId,
      shareToken: data.shareToken,
      input: data.input,
      plan: data.plan,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      expiresAt: expiresAtIso,
    });
  }
}
