import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  type PlanOutput,
  type WizardInput,
  getTodayInKolkata,
  rawIdeaSchema,
} from '../../shared/schemas.js';
import { buildPlanPrompt, wrapUserText } from '../prompts/plan.js';
import { callModel, type AiCallContext } from './model.js';
import { generateFallbackPlan } from './fallback.js';
import { createPlanCacheKey, getCachedPlan, setCachedPlan } from './cache.js';
import { sharePlanGeneration, type PlanGenerationResult } from './sharedPlanGeneration.js';

const creativePlanSchema = z.object({
  summary: z.string().min(1).max(3000),
  ideas: z.array(rawIdeaSchema).min(5).max(20),
  taskDescriptions: z
    .array(z.object({ task: z.string(), description: z.string().min(1).max(1500) }))
    .max(50),
  vendorQuestions: z
    .array(
      z.object({
        category: z.string(),
        questions: z.array(z.string().min(1).max(500)).min(2).max(4),
      }),
    )
    .max(50),
});

/** Creative text augments the deterministic plan; models cannot change money or dates. */
export async function generateEventPlan(
  input: WizardInput,
  context: AiCallContext = {},
): Promise<PlanGenerationResult> {
  context.signal?.throwIfAborted();
  const snapshot = structuredClone(input);
  const planningToday = getTodayInKolkata();
  const cacheKey = createPlanCacheKey({ ...snapshot, planningToday });
  const cached = getCachedPlan(cacheKey);
  if (cached) return { plan: structuredClone(cached), source: 'cache' };
  return sharePlanGeneration(
    cacheKey,
    (sharedContext) => createEventPlan(snapshot, planningToday, cacheKey, sharedContext),
    context,
  );
}

async function createEventPlan(
  input: WizardInput,
  planningToday: string,
  cacheKey: string,
  context: AiCallContext,
): Promise<PlanGenerationResult> {
  const preset = generateFallbackPlan(input, planningToday);
  const result = await callModel({
    ...context,
    schema: creativePlanSchema,
    prompt: `${buildPlanPrompt(input)}\nUse only the creative response schema. Code already owns all prices, percentages, dates and offsets. Do not compute or alter them.\nDescribe these existing tasks by exact name: ${wrapUserText(JSON.stringify(preset.timeline.map((task) => task.title)))}\nProvide questions for these existing vendor categories by exact name: ${wrapUserText(JSON.stringify(preset.vendors.map((vendor) => vendor.category)))}`,
  });
  context.signal?.throwIfAborted();
  if (!result) return { plan: preset, source: 'fallback' };
  const { data, model } = result;
  const plan: PlanOutput = {
    ...preset,
    summary: data.summary,
    ideas: data.ideas.map((idea) => ({ ...idea, id: nanoid() })),
    timeline: preset.timeline.map((task) => ({
      ...task,
      description:
        data.taskDescriptions.find((entry) => entry.task === task.title)?.description ??
        task.description,
    })),
    vendors: preset.vendors.map((vendor) => ({
      ...vendor,
      questionsToAsk:
        data.vendorQuestions.find((entry) => entry.category === vendor.category)?.questions ??
        vendor.questionsToAsk,
    })),
  };
  setCachedPlan(cacheKey, structuredClone(plan));
  return { plan, source: 'gemini', model };
}
