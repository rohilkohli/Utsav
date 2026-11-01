import { z } from 'zod';
import type { PlanOutput, SavedPlan, WizardInput } from '@shared/schemas';
import { publicConfigSchema, savedPlanSchema } from '@shared/schemas';
import { apiRequest, postJson, type AiRequestOptions } from './apiTransport';

const shareSchema = z.object({
  shareToken: z.string().min(1),
  shareUrl: z.url().refine((value) => /^https?:\/\//i.test(value), 'Expected an HTTP(S) URL'),
  expiresAt: z.string().optional(),
});
const savedResponseSchema = z.object({ success: z.literal(true), plan: savedPlanSchema });

export function fetchRuntimeConfig() {
  return apiRequest('/api/config', publicConfigSchema);
}

export function apiCreateShare(input: WizardInput, plan: PlanOutput) {
  return apiRequest('/api/share', shareSchema, postJson({ input, plan }));
}

export function apiGetSharedPlan(token: string) {
  return apiRequest(`/api/share/${encodeURIComponent(token)}`, savedPlanSchema);
}

export function apiGetPlan(id: string, token?: string) {
  return apiRequest(`/api/plan/${encodeURIComponent(id)}`, savedPlanSchema, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function apiSavePlan(input: WizardInput, plan: PlanOutput, token: string) {
  const data = await apiRequest(
    '/api/plan/save',
    savedResponseSchema,
    postJson({ input, plan }, token),
  );
  return data.plan;
}

export async function apiUpdatePlan(
  plan: SavedPlan,
  token?: string,
  options?: AiRequestOptions,
): Promise<void> {
  await apiRequest(
    `/api/plan/${encodeURIComponent(plan.id)}`,
    savedResponseSchema,
    {
      ...postJson({ input: plan.input, plan: plan.plan }, token),
      method: 'PUT',
    },
    options,
  );
}
