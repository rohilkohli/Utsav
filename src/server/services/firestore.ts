import { getPlanRepository, getShareRepository } from '../repositories/index.js';
import type { SavedPlan, WizardInput, PlanOutput } from '../../shared/schemas.js';

/**
 * Save or update an event plan in the configured repository.
 * In production, delegates to FirestoreRepository.
 */
export async function savePlanToDb(plan: SavedPlan): Promise<void> {
  return getPlanRepository().savePlan(plan);
}

/**
 * Retrieve an event plan by ID from the configured repository.
 * In production, delegates to FirestoreRepository.
 */
export async function getPlanFromDb(id: string): Promise<SavedPlan | null> {
  return getPlanRepository().getPlan(id);
}

/**
 * Creates a public, read-only guest snapshot under a secure 128-bit random token.
 * Valid for 30 days. Contains NO user identification.
 * In production, stores expiresAt as a Firestore Timestamp and returns expiresAt as an ISO string.
 */
export async function createShareSnapshot(
  input: WizardInput,
  plan: PlanOutput,
): Promise<{ shareToken: string; expiresAt: string }> {
  return getShareRepository().createShare(input, plan);
}

/**
 * Retrieves a shared snapshot by token from the configured repository, verifying expiry.
 * Returns transport-shaped SavedPlan (expiresAt as ISO string), or null if expired or missing.
 */
export async function getShareSnapshot(shareToken: string): Promise<SavedPlan | null> {
  return getShareRepository().getShare(shareToken);
}
