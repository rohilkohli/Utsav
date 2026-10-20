import type {
  WizardInput,
  PlanOutput,
  GeneratePlanResponse,
  RefineSectionResponse,
  PublicConfig,
  SavedPlan,
  IdeaSection,
} from '@shared/schemas';

export interface ShareResponse {
  shareToken: string;
  shareUrl: string;
  expiresAt: string;
}

export async function fetchRuntimeConfig(): Promise<PublicConfig> {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Failed to load configuration');
  return res.json();
}

export async function apiGeneratePlan(input: WizardInput): Promise<GeneratePlanResponse> {
  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate plan');
  }
  return res.json();
}

export async function apiRefineSection(
  section: IdeaSection,
  instruction: string,
  input: WizardInput,
  currentPlan: PlanOutput,
): Promise<RefineSectionResponse> {
  const res = await fetch('/api/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      section,
      instruction,
      input,
      currentPlan,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to refine ideas');
  }
  return res.json();
}

export async function apiCreateShare(
  input: WizardInput,
  plan: PlanOutput,
): Promise<ShareResponse> {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, plan }),
  });
  if (!res.ok) {
    throw new Error('Failed to create share link');
  }
  return res.json();
}

export async function apiGetSharedPlan(token: string): Promise<SavedPlan> {
  const res = await fetch(`/api/share/${token}`);
  if (!res.ok) {
    throw new Error('Shared plan not found or expired');
  }
  return res.json();
}

export async function apiGetPlan(id: string): Promise<SavedPlan> {
  const res = await fetch(`/api/plan/${id}`);
  if (!res.ok) {
    throw new Error('Plan not found');
  }
  return res.json();
}

export async function apiUpdatePlan(plan: SavedPlan): Promise<void> {
  const res = await fetch(`/api/plan/${plan.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  });
  if (!res.ok) {
    throw new Error('Failed to update plan');
  }
}
