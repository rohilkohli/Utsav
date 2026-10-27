import crypto from 'crypto';
import { savedPlanSchema, type SavedPlan, type WizardInput, type PlanOutput } from '../../shared/schemas.js';
import type { PlanRepository, ShareRepository, ShareSnapshotResult } from './types.js';

export interface RawShareDoc extends Omit<SavedPlan, 'expiresAt'> {
  expiresAt?: {
    toMillis: () => number;
    toDate: () => Date;
  } | Date | unknown;
}

/**
 * In-memory repository used strictly for unit/integration tests and explicitly configured local dev.
 * NEVER allowed in production (enforced via fail-fast assertion at server startup).
 */
export class InMemoryRepository implements PlanRepository, ShareRepository {
  private plans = new Map<string, SavedPlan>();
  private shares = new Map<string, RawShareDoc>();

  async savePlan(plan: SavedPlan): Promise<void> {
    this.plans.set(plan.id, plan);
  }

  async getPlan(id: string): Promise<SavedPlan | null> {
    const plan = this.plans.get(id);
    if (!plan) return null;
    return savedPlanSchema.parse(plan);
  }

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

    this.shares.set(shareToken, {
      ...baseDoc,
      expiresAt: {
        toMillis: () => expiresAtDate.getTime(),
        toDate: () => expiresAtDate,
      },
    });

    return {
      shareToken,
      expiresAt: expiresAtDate.toISOString(),
    };
  }

  async getShare(shareToken: string): Promise<SavedPlan | null> {
    const doc = this.shares.get(shareToken) || this.shares.get(`share_${shareToken}`) || null;
    if (!doc) {
      return null;
    }

    // Fail closed: if expiresAt is missing or invalid type, treat as expired
    if (!doc.expiresAt) {
      return null;
    }

    const expiresAt = doc.expiresAt;
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

    let expiresAtIso: string;
    if (isTimestamp && 'toDate' in expiresAt && typeof (expiresAt as { toDate: unknown }).toDate === 'function') {
      expiresAtIso = (expiresAt as { toDate: () => Date }).toDate().toISOString();
    } else if (isDate) {
      expiresAtIso = (expiresAt as Date).toISOString();
    } else {
      return null;
    }

    return savedPlanSchema.parse({
      id: doc.id,
      ownerUid: doc.ownerUid,
      userId: doc.userId,
      shareToken: doc.shareToken,
      input: doc.input,
      plan: doc.plan,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      expiresAt: expiresAtIso,
    });
  }

  /**
   * Test helper to directly seed share snapshots (e.g. simulated expired documents).
   */
  seedShare(token: string, doc: RawShareDoc): void {
    this.shares.set(token, doc);
  }

  /**
   * Reset store state between tests
   */
  clear(): void {
    this.plans.clear();
    this.shares.clear();
  }
}
