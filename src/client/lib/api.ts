import type {
  WizardInput,
  PlanOutput,
  IdeaSection,
  PublicConfig,
  GeneratePlanResponse,
  SavedPlan,
  RefineSectionResponse,
} from '../../shared/schemas.js';

type ShareResponse = { shareToken: string; shareUrl: string };

export async function fetchRuntimeConfig(): Promise<PublicConfig> {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Failed to load configuration');
  return res.json();
}

export async function apiGeneratePlan(input: WizardInput, token?: string): Promise<GeneratePlanResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/plan', {
    method: 'POST',
    headers,
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

export async function apiCreateShare(input: WizardInput, plan: PlanOutput): Promise<ShareResponse> {
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

export async function apiGetPlan(id: string, token?: string): Promise<SavedPlan> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`/api/plan/${id}`, { headers });
  if (!res.ok) {
    throw new Error('Plan not found');
  }
  return res.json();
}

export async function apiSavePlan(input: WizardInput, plan: PlanOutput, token: string): Promise<SavedPlan> {
  const res = await fetch('/api/plan/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ input, plan }),
  });
  if (!res.ok) {
    throw new Error('Failed to save plan');
  }
  const data = await res.json();
  return data.plan;
}

export interface VendorSuggestion {
  name: string;
  phone?: string;
  address?: string;
  rating?: number;
  mapsUrl?: string;
  website?: string;
}

export async function apiSearchVendors(
  category: string,
  city: string,
  subEvent?: string,
): Promise<VendorSuggestion[]> {
  const res = await fetch('/api/vendors/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, city, subEvent }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Vendor search failed');
  }
  const data = await res.json();
  return data.suggestions as VendorSuggestion[];
}

export async function apiUpdatePlan(plan: SavedPlan, token?: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`/api/plan/${plan.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ input: plan.input, plan: plan.plan }),
  });
  if (!res.ok) {
    throw new Error('Failed to update plan');
  }
}
