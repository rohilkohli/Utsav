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

/** Execute a promise with a timeout (default 30 seconds) */
async function withTimeout<T>(promise: Promise<T>, timeoutMs = 30000): Promise<T> {
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

/** Sleep helper for retry exponential backoff */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// generateFallbackPlan is defined in ./fallback.ts (extracted for SRP).
// Re-exported here so existing imports from this module continue to work.
export { generateFallbackPlan } from './fallback.js';

/**
 * Transforms raw Gemini JSON plan into fully enriched PlanOutput
 * with calculated rupee allocations (largest-remainder), unique IDs, and milestone dates.
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
    // Attempt matching budgeted amount with relevant category
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
 * Call Gemini API with structured response schema, 30s timeout, and 1 retry with backoff.
 * Returns enriched plan and meta source ('gemini' | 'cache' | 'fallback').
 */
export async function generateEventPlan(
  input: WizardInput,
): Promise<{ plan: PlanOutput; source: 'gemini' | 'cache' | 'fallback' }> {
  // Check LRU cache
  const cacheKey = createPlanCacheKey(input as Record<string, unknown>);
  const cached = getCachedPlan(cacheKey);
  if (cached) {
    logger.info(`[Plan Generation] Source: cache (Event: ${input.eventType}, City: ${input.city})`);
    return { plan: cached, source: 'cache' };
  }

  // If no API key configured (e.g. initial dev or test), return fallback
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    logger.info('[Plan Generation] Source: fallback (GEMINI_API_KEY not configured)');
    const fallback = generateFallbackPlan(input);
    return { plan: fallback, source: 'fallback' };
  }

  const prompt = buildPlanPrompt(input);
  const jsonSchema = getGeminiPlanJsonSchema();

  let _lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff before retry (1.5s)
        await sleep(1500);
      }

      const generateCall = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchema,
          temperature: 0.7,
        },
      });

      const response = await withTimeout(generateCall, 30000);
      const text = response.text || '';
      const parsed = JSON.parse(text);
      const sanitized = sanitizeObject(parsed);
      const validated = geminiRawPlanSchema.parse(sanitized);

      const enriched = enrichRawPlan(validated, input);
      setCachedPlan(cacheKey, enriched);

      logger.info(`[Plan Generation] Source: gemini (Model: ${modelName}, Event: ${input.eventType})`);
      return { plan: enriched, source: 'gemini' };
    } catch (err) {
      _lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // If both attempts failed, return graceful fallback plan
  logger.warn(`[Plan Generation] Source: fallback (Gemini error: ${_lastError?.message || 'unknown'})`);
  const fallback = generateFallbackPlan(input);
  return { plan: fallback, source: 'fallback' };
}

export interface PlanReview {
  strengths: string[];
  risks: string[];
  suggestions: string[];
  overallScore: number; // 1-10
}

/**
 * AI-powered plan review: returns strengths, risks, and actionable suggestions.
 * Falls back to a heuristic review when Gemini is unavailable.
 */
export async function reviewPlan(
  plan: PlanOutput,
  input: WizardInput,
): Promise<{ review: PlanReview; source: 'gemini' | 'fallback' }> {
  const heuristicReview = (): PlanReview => {
    const overBudget = plan.budget.reduce((s, c) => s + c.actual, 0) > input.totalBudget;
    const unbookedVendors = plan.vendors.filter((v) => v.status === 'to-contact').length;
    const completedMilestones = plan.timeline.filter((m) => m.completed).length;
    return {
      strengths: [
        `${plan.vendors.length} vendor categories identified`,
        `${plan.timeline.length} timeline milestones planned`,
        completedMilestones > 0 ? `${completedMilestones} milestones already completed` : 'Plan ready to execute',
      ],
      risks: [
        overBudget ? 'Actual spend exceeds total budget — review categories' : 'Budget allocation looks healthy',
        unbookedVendors > 3 ? `${unbookedVendors} vendors still uncontacted — start booking early` : 'Vendor booking on track',
      ],
      suggestions: [
        'Get 2-3 competing quotes per vendor category to ensure best value',
        'Mark milestones as complete as you progress to stay on track',
        'Share the plan link with family coordinators for visibility',
      ],
      overallScore: overBudget ? 6 : unbookedVendors > plan.vendors.length / 2 ? 7 : 8,
    };
  };

  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    return { review: heuristicReview(), source: 'fallback' };
  }

  const prompt = `You are Utsav, an expert Indian event planner. Review this celebration plan and give honest feedback.

EVENT: ${input.eventType} in ${input.city} for ${input.guestCount} guests on ${input.eventDate}
BUDGET: ₹${input.totalBudget.toLocaleString('en-IN')}
PLAN SUMMARY: ${plan.summary}
BUDGET CATEGORIES: ${plan.budget.map((b) => `${b.category} (₹${b.amount.toLocaleString('en-IN')})`).join(', ')}
VENDOR COUNT: ${plan.vendors.length} categories
MILESTONE COUNT: ${plan.timeline.length}

Respond with JSON: { "strengths": [3 strings], "risks": [2-3 strings], "suggestions": [3 actionable strings], "overallScore": number 1-10 }`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await sleep(1000);
      const generateCall = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.5,
        },
      });
      const response = await withTimeout(generateCall, 20000);
      const text = response.text || '';
      const parsed = sanitizeObject(JSON.parse(text)) as PlanReview;
      if (Array.isArray(parsed.strengths) && Array.isArray(parsed.risks) && Array.isArray(parsed.suggestions)) {
        logger.info(`[Review Plan] Source: gemini`);
        return { review: parsed, source: 'gemini' };
      }
    } catch {
      // retry
    }
  }

  logger.warn('[Review Plan] Source: fallback (Gemini API failed)');
  return { review: heuristicReview(), source: 'fallback' };
}

/**
 * Refine ideas for a specific section via Gemini with retry and fallback.
 * Returns refined ideas and meta source ('gemini' | 'fallback').
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

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(1000);
      }

      const generateCall = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchema,
          temperature: 0.8,
        },
      });

      const response = await withTimeout(generateCall, 30000);
      const text = response.text || '';
      const parsed = JSON.parse(text);
      const sanitized = sanitizeObject(parsed);
      const validated = geminiRefineOutputSchema.parse(sanitized);

      const ideas = validated.ideas.map((raw) => ({
        id: nanoid(),
        section: raw.section,
        title: raw.title,
        description: raw.description,
        estimatedCost: raw.estimatedCost,
        subEvent: raw.subEvent,
      }));

      logger.info(`[Refine Section] Source: gemini (Section: ${section}, Model: ${modelName})`);
      return { ideas, source: 'gemini' };
    } catch {
      // Continue loop for retry
    }
  }

  logger.warn(`[Refine Section] Source: fallback (Gemini API failed for section ${section})`);
  return { ideas: currentIdeas, source: 'fallback' };
}
