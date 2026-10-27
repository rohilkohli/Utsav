import type { SavedPlan, WizardInput, PlanOutput } from '../../shared/schemas.js';

export interface ShareSnapshotResult {
  shareToken: string;
  expiresAt: string;
}

export interface PlanRepository {
  savePlan(plan: SavedPlan): Promise<void>;
  getPlan(id: string): Promise<SavedPlan | null>;
}

export interface ShareRepository {
  createShare(input: WizardInput, plan: PlanOutput): Promise<ShareSnapshotResult>;
  getShare(shareToken: string): Promise<SavedPlan | null>;
}
