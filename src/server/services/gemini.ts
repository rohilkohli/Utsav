import { GoogleGenAI } from '@google/genai';
import { logger } from '../lib/logger.js';
import { nanoid } from 'nanoid';
import {
  type WizardInput,
  type PlanOutput,
  type GeminiRawPlan,
  type IdeaSection,
  type Idea,
  geminiRawPlanSchema,
  geminiRefineOutputSchema,
  getGeminiPlanJsonSchema,
  getGeminiRefineJsonSchema,
} from '../../shared/schemas.js';
import { populateCategoryAmounts } from '../../shared/budget.js';
import { computeMilestoneDate } from '../../shared/timeline.js';
import { SYSTEM_INSTRUCTION, buildPlanPrompt, buildRefinePrompt } from '../prompts/plan.js';
import { createPlanCacheKey, getCachedPlan, setCachedPlan } from './cache.js';
import { sanitizeObject } from '../lib/sanitize.js';
import { generateFallbackPlan } from './fallback.js';

const apiKey = process.env.GEMINI_API_KEY || '';
// Default to gemini-3.5-flash (gemini-2.5-flash is deprecated/shutdown).
// Note: If /api/plan latency approaches the 30s timeout on live deployment,
// lower the model's thinking level via SDK config (e.g. thinkingConfig: { thinkingBudget: ... }) instead of raising timeout.
const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const ai = new GoogleGenAI({ apiKey });

// generateFallbackPlan is defined in ./fallback.ts (extracted for SRP).
// Re-exported here so existing imports from this module continue to work.
export { generateFallbackPlan } from './fallback.js';

/**
 * Wraps a promise with a hard timeout. Rejects with a descriptive error if
 * the promise does not resolve within `timeoutMs` milliseconds.
 *
 * @param promise - The async operation to time-box
 * @param timeoutMs - Maximum wait time in milliseconds (default 30 000)
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs = 30_000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Pause execution for `ms` milliseconds (used for retry backoff). */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Generic Gemini retry wrapper: attempts `operation` up to `maxAttempts` times
 * with `delayMs` backoff between attempts. Returns the first successful result
 * or `null` when all attempts fail (caller decides on fallback strategy).
 *
 * @param operation - Async factory returning a result of type T
 * @param context - Log prefix used in debug messages (e.g. '[Plan Generation]')
 * @param maxAttempts - Total attempts including the first (default 2)
 * @param delayMs - Wait between retries in milliseconds (default 1 500)
 */
async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  context: string,
  maxAttempts = 2,
  delayMs = 1_500,
): Promise<T | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (attempt > 0) await sleep(delayMs);
      return await operation();
    } catch (err) {
      logger.debug(
        `${context} attempt ${attempt + 1}/${maxAttempts} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return null;
}

/**
 * Transforms raw Gemini JSON plan into a fully enriched PlanOutput:
 * calculates rupee allocations via the Largest-Remainder method,
 * assigns unique IDs to every entity, and resolves absolute milestone dates.
 *
 * @param raw - Parsed and validated Gemini response object
 * @param input - Original wizard input used to derive dates and budget totals
 */
export function enrichRawPlan(raw: GeminiRawPlan, input: WizardInput): PlanOutput {
  const categoriesWithIds = raw.budget.map((b) => ({
    id: nanoid(),
    category: b.category,
    suggestedPercent: b.suggestedPercent,
    subEvent: b.subEvent,
  }));

  const enrichedBudget = populateCategoryAmounts(categoriesWithIds, input.totalBudget);

  const enrichedTimeline = raw.timeline.map((m) => ({
    id: nanoid(),
    title: m.title,
    description: m.description,
    daysBeforeEvent: m.daysBeforeEvent,
    date: computeMilestoneDate(input.eventDate, m.daysBeforeEvent),
    subEvent: m.subEvent,
    completed: false,
  }));

  const enrichedVendors = raw.vendors.map((v) => {
    // Match budgeted amount to the closest category by name substring
    const matchedCategory = enrichedBudget.find(
      (b) =>
        b.category.toLowerCase().includes(v.category.toLowerCase()) ||
        v.category.toLowerCase().includes(b.category.toLowerCase()),
    );
    return {
      id: nanoid(),
      category: v.category,
      questionsToAsk: v.questionsToAsk,
      bookByDaysBeforeEvent: v.bookByDaysBeforeEvent,
      bookByDate: computeMilestoneDate(input.eventDate, v.bookByDaysBeforeEvent),
      status: 'to-contact' as const,
      quotedAmount: 0,
      budgetedAmount: matchedCategory ? matchedCategory.amount : 0,
      subEvent: v.subEvent,
    };
  });

  const enrichedIdeas = raw.ideas.map((i) => ({
    id: nanoid(),
    section: i.section,
    title: i.title,
    description: i.description,
    estimatedCost: i.estimatedCost,
    subEvent: i.subEvent,
  }));

  return {
    summary: raw.summary,
    budget: enrichedBudget,
    timeline: enrichedTimeline,
    vendors: enrichedVendors,
    ideas: enrichedIdeas,
  };
}

/**
 * Generates a fully enriched event plan via Gemini with LRU caching,
 * structured JSON schema output, 30 s timeout, and one retry with backoff.
 * Falls back to `generateFallbackPlan` when the API key is absent or all
 * Gemini attempts fail.
 *
 * @param input - Validated wizard input from the client
 * @returns Enriched plan with a `source` tag ('gemini' | 'cache' | 'fallback')
 */
export async function generateEventPlan(
  input: WizardInput,
): Promise<{ plan: PlanOutput; source: 'gemini' | 'cache' | 'fallback' }> {
  const cacheKey = createPlanCacheKey(input as Record<string, unknown>);
  const cached = getCachedPlan(cacheKey);
  if (cached) {
    logger.info(`[Plan Generation] Source: cache (Event: ${input.eventType}, City: ${input.city})`);
    return { plan: cached, source: 'cache' };
  }

  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    logger.info('[Plan Generation] Source: fallback (GEMINI_API_KEY not configured)');
    return { plan: generateFallbackPlan(input), source: 'fallback' };
  }

  const prompt = buildPlanPrompt(input);
  const jsonSchema = getGeminiPlanJsonSchema();

  const result = await withGeminiRetry(
    async () => {
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseJsonSchema: jsonSchema,
            temperature: 0.7,
          },
        }),
        30_000,
      );
      const validated = geminiRawPlanSchema.parse(sanitizeObject(JSON.parse(response.text || '')));
      return enrichRawPlan(validated, input);
    },
    '[Plan Generation]',
  );

  if (result) {
    setCachedPlan(cacheKey, result);
    logger.info(`[Plan Generation] Source: gemini (Model: ${modelName}, Event: ${input.eventType})`);
    return { plan: result, source: 'gemini' };
  }

  logger.warn('[Plan Generation] Source: fallback (all Gemini attempts failed)');
  return { plan: generateFallbackPlan(input), source: 'fallback' };
}

/** Structured AI review returned by {@link reviewPlan}. */
export interface PlanReview {
  strengths: string[];
  risks: string[];
  suggestions: string[];
  /** Overall plan health score from 1 (poor) to 10 (excellent). */
  overallScore: number;
}

/**
 * Builds a heuristic plan review without calling Gemini.
 * Used when the API key is absent or all Gemini attempts fail.
 */
function buildHeuristicReview(plan: PlanOutput, input: WizardInput): PlanReview {
  const overBudget = plan.budget.reduce((s, c) => s + c.actual, 0) > input.totalBudget;
  const unbookedVendors = plan.vendors.filter((v) => v.status === 'to-contact').length;
  const completedMilestones = plan.timeline.filter((m) => m.completed).length;
  return {
    strengths: [
      `${plan.vendors.length} vendor categories identified`,
      `${plan.timeline.length} timeline milestones planned`,
      completedMilestones > 0
        ? `${completedMilestones} milestones already completed`
        : 'Plan ready to execute',
    ],
    risks: [
      overBudget
        ? 'Actual spend exceeds total budget — review categories'
        : 'Budget allocation looks healthy',
      unbookedVendors > 3
        ? `${unbookedVendors} vendors still uncontacted — start booking early`
        : 'Vendor booking on track',
    ],
    suggestions: [
      'Get 2-3 competing quotes per vendor category to ensure best value',
      'Mark milestones as complete as you progress to stay on track',
      'Share the plan link with family coordinators for visibility',
    ],
    overallScore: overBudget ? 6 : unbookedVendors > plan.vendors.length / 2 ? 7 : 8,
  };
}

/**
 * AI-powered plan review returning structured strengths, risks, and
 * actionable suggestions. Falls back to a heuristic review when Gemini is
 * unavailable (no key or all retries exhausted).
 *
 * @param plan - The saved plan to review
 * @param input - Wizard input that produced the plan
 * @returns Review object with a `source` tag ('gemini' | 'fallback')
 */
export async function reviewPlan(
  plan: PlanOutput,
  input: WizardInput,
): Promise<{ review: PlanReview; source: 'gemini' | 'fallback' }> {
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    return { review: buildHeuristicReview(plan, input), source: 'fallback' };
  }

  const prompt = `You are Utsav, an expert Indian event planner. Review this celebration plan and give honest feedback.

EVENT: ${input.eventType} in ${input.city} for ${input.guestCount} guests on ${input.eventDate}
BUDGET: ₹${input.totalBudget.toLocaleString('en-IN')}
PLAN SUMMARY: ${plan.summary}
BUDGET CATEGORIES: ${plan.budget.map((b) => `${b.category} (₹${b.amount.toLocaleString('en-IN')})`).join(', ')}
VENDOR COUNT: ${plan.vendors.length} categories
MILESTONE COUNT: ${plan.timeline.length}

Respond with JSON: { "strengths": [3 strings], "risks": [2-3 strings], "suggestions": [3 actionable strings], "overallScore": number 1-10 }`;

  const result = await withGeminiRetry(
    async () => {
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            temperature: 0.5,
          },
        }),
        20_000,
      );
      const parsed = sanitizeObject(JSON.parse(response.text || '')) as PlanReview;
      if (
        !Array.isArray(parsed.strengths) ||
        !Array.isArray(parsed.risks) ||
        !Array.isArray(parsed.suggestions)
      ) {
        throw new Error('Invalid review structure from Gemini');
      }
      return parsed;
    },
    '[Review Plan]',
    2,
    1_000,
  );

  if (result) {
    logger.info('[Review Plan] Source: gemini');
    return { review: result, source: 'gemini' };
  }

  logger.warn('[Review Plan] Source: fallback (Gemini API failed)');
  return { review: buildHeuristicReview(plan, input), source: 'fallback' };
}

/**
 * Refines ideas for a specific section via Gemini with one retry and backoff.
 * Returns the unchanged `currentIdeas` array when the API key is absent or
 * all Gemini attempts fail, ensuring the UI always has something to show.
 *
 * @param section - Dashboard section being refined (e.g. 'food', 'decor')
 * @param instruction - User's free-text refinement instruction (≤300 chars)
 * @param input - Original wizard input for context
 * @param currentIdeas - Existing ideas shown if Gemini is unavailable
 * @returns New ideas array with a `source` tag ('gemini' | 'fallback')
 */
export async function refineIdeasSection(
  section: IdeaSection,
  instruction: string,
  input: WizardInput,
  currentIdeas: Idea[],
): Promise<{ ideas: Idea[]; source: 'gemini' | 'fallback' }> {
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    logger.info('[Refine Section] Source: fallback (GEMINI_API_KEY not configured)');
    return { ideas: currentIdeas, source: 'fallback' };
  }

  const prompt = buildRefinePrompt(section, instruction, input);
  const jsonSchema = getGeminiRefineJsonSchema();

  const result = await withGeminiRetry(
    async () => {
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseJsonSchema: jsonSchema,
            temperature: 0.8,
          },
        }),
        30_000,
      );
      const validated = geminiRefineOutputSchema.parse(
        sanitizeObject(JSON.parse(response.text || '')),
      );
      return validated.ideas.map((raw) => ({
        id: nanoid(),
        section: raw.section,
        title: raw.title,
        description: raw.description,
        estimatedCost: raw.estimatedCost,
        subEvent: raw.subEvent,
      }));
    },
    `[Refine Section:${section}]`,
    2,
    1_000,
  );

  if (result) {
    logger.info(`[Refine Section] Source: gemini (Section: ${section}, Model: ${modelName})`);
    return { ideas: result, source: 'gemini' };
  }

  logger.warn(`[Refine Section] Source: fallback (Gemini API failed for section ${section})`);
  return { ideas: currentIdeas, source: 'fallback' };
}
