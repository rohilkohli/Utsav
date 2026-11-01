import { nanoid } from 'nanoid';
import { z } from 'zod';
import { type PlanOutput, type WizardInput, rawIdeaSchema } from '../../shared/schemas.js';
import { buildPlanPrompt, wrapUserText } from '../prompts/plan.js';
import { callModel, type AiCallContext } from './model.js';
import { generateFallbackPlan } from './fallback.js';
import { createPlanCacheKey, getCachedPlan, setCachedPlan } from './cache.js';

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
): Promise<{
  plan: PlanOutput;
  source: 'gemini' | 'cache' | 'fallback';
  model?: string;
}> {
  const cacheKey = createPlanCacheKey(input);
  const cached = getCachedPlan(cacheKey);
  if (cached) return { plan: cached, source: 'cache' };
  const preset = generateFallbackPlan(input);
  const result = await callModel({
    ...context,
    schema: creativePlanSchema,
    prompt: `${buildPlanPrompt(input)}\nUse only the creative response schema. Code already owns all prices, percentages, dates and offsets. Do not compute or alter them.\nDescribe these existing tasks by exact name: ${wrapUserText(JSON.stringify(preset.timeline.map((task) => task.title)))}\nProvide questions for these existing vendor categories by exact name: ${wrapUserText(JSON.stringify(preset.vendors.map((vendor) => vendor.category)))}`,
  });
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
  setCachedPlan(cacheKey, plan);
  return { plan, source: 'gemini', model };
}
