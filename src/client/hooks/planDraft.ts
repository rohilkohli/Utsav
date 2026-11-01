import { savedPlanSchema, type SavedPlan } from '@shared/schemas';
const key = (uid: string) => `utsav_account_draft_${uid}`;
export function loadAccountDraft(uid: string): SavedPlan | null {
  try {
    const raw = localStorage.getItem(key(uid));
    if (!raw) return null;
    const parsed = savedPlanSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success && parsed.data.ownerUid === uid ? parsed.data : null;
  } catch {
    return null;
  }
}
export function saveAccountDraft(uid: string, plan: SavedPlan): void {
  try {
    localStorage.setItem(key(uid), JSON.stringify(plan));
  } catch {
    /* Storage can be unavailable. */
  }
}
export function clearAccountDraft(uid: string): void {
  try {
    localStorage.removeItem(key(uid));
  } catch {
    /* Storage can be unavailable. */
  }
}
