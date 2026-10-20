import { GoogleGenAI } from '@google/genai';
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
import {
  SYSTEM_INSTRUCTION,
  buildPlanPrompt,
  buildRefinePrompt,
} from '../prompts/plan.js';
import { createPlanCacheKey, getCachedPlan, setCachedPlan } from './cache.js';

const apiKey = process.env.GEMINI_API_KEY || '';
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const ai = new GoogleGenAI({ apiKey });

/** Sanitizes strings against HTML/script injection */
function sanitizeText(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeText(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as unknown as T;
  }
  if (obj && typeof obj === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = sanitizeObject(v);
    }
    return clean as T;
  }
  return obj;
}

/** Execute a promise with a timeout (default 30 seconds) */
async function withTimeout<T>(promise: Promise<T>, timeoutMs = 30000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Sleep helper for retry exponential backoff */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate a graceful fallback plan if Gemini is unreachable or exhausts retries.
 */
export function generateFallbackPlan(input: WizardInput): PlanOutput {
  const isWedding = input.eventType === 'wedding';
  const isCommunity = input.eventType === 'community';

  const defaultCategories = isWedding
    ? [
        { id: nanoid(), category: 'Venue & Staging', suggestedPercent: 30, subEvent: 'Wedding Ceremony' },
        { id: nanoid(), category: 'Catering & Beverages', suggestedPercent: 30, subEvent: 'Wedding Ceremony' },
        { id: nanoid(), category: 'Decor & Floral Mandap', suggestedPercent: 15, subEvent: 'Wedding Ceremony' },
        { id: nanoid(), category: 'Photography & Videography', suggestedPercent: 10, subEvent: 'General' },
        { id: nanoid(), category: 'Bridal & Groom Attire / Jewellery', suggestedPercent: 10, subEvent: 'General' },
        { id: nanoid(), category: 'Sound, DJ & Entertainment', suggestedPercent: 5, subEvent: 'Sangeet' },
      ]
    : isCommunity
      ? [
          { id: nanoid(), category: 'Pandal & Stage Setup', suggestedPercent: 35, subEvent: 'Pandal Setup' },
          { id: nanoid(), category: 'Sound, Lighting & Permissions', suggestedPercent: 20, subEvent: 'General' },
          { id: nanoid(), category: 'Bhandara / Prasad Catering', suggestedPercent: 25, subEvent: 'Bhandara / Prasad' },
          { id: nanoid(), category: 'Cultural Artists & Emcee', suggestedPercent: 10, subEvent: 'Cultural Night / Garba' },
          { id: nanoid(), category: 'Security, Sanitization & Waste', suggestedPercent: 10, subEvent: 'General' },
        ]
      : [
          { id: nanoid(), category: 'Venue & Atmosphere Decor', suggestedPercent: 30 },
          { id: nanoid(), category: 'Food, Snacks & Refreshments', suggestedPercent: 35 },
          { id: nanoid(), category: 'Custom Cake & Confections', suggestedPercent: 10 },
          { id: nanoid(), category: 'Entertainment, Games & Host', suggestedPercent: 15 },
          { id: nanoid(), category: 'Return Gifts & Mementos', suggestedPercent: 10 },
        ];

  const enrichedBudget = populateCategoryAmounts(defaultCategories, input.totalBudget);

  const defaultMilestones = isWedding
    ? [
        { id: nanoid(), title: 'Book Venue & Dates', description: 'Finalize and lock in the main venue', daysBeforeEvent: 120, date: computeMilestoneDate(input.eventDate, 120), subEvent: 'Wedding Ceremony', completed: false },
        { id: nanoid(), title: 'Caterer Food Tasting', description: 'Sample menu items and freeze counters', daysBeforeEvent: 60, date: computeMilestoneDate(input.eventDate, 60), subEvent: 'Wedding Ceremony', completed: false },
        { id: nanoid(), title: 'Mehendi & Sangeet Playlist', description: 'Confirm choreography & song list', daysBeforeEvent: 20, date: computeMilestoneDate(input.eventDate, 20), subEvent: 'Sangeet', completed: false },
        { id: nanoid(), title: 'Wedding Ceremony & Pheras', description: 'The auspicious main day', daysBeforeEvent: 0, date: input.eventDate, subEvent: 'Wedding Ceremony', completed: false },
      ]
    : isCommunity
      ? [
          { id: nanoid(), title: 'Apply for Police & Municipal NOC', description: 'Submit paperwork for sound and pandal permissions', daysBeforeEvent: 30, date: computeMilestoneDate(input.eventDate, 30), subEvent: 'General', completed: false },
          { id: nanoid(), title: 'Pandal Erection & Electrical Inspection', description: 'Set up temporary structure and fire safety checks', daysBeforeEvent: 3, date: computeMilestoneDate(input.eventDate, 3), subEvent: 'Pandal Setup', completed: false },
          { id: nanoid(), title: 'Festival Celebration & Mahaprasad', description: 'Main event day and community gathering', daysBeforeEvent: 0, date: input.eventDate, subEvent: 'Bhandara / Prasad', completed: false },
        ]
      : [
          { id: nanoid(), title: 'Finalize Guest List & Theme', description: 'Confirm expected attendees', daysBeforeEvent: 21, date: computeMilestoneDate(input.eventDate, 21), completed: false },
          { id: nanoid(), title: 'Order Custom Cake & Treats', description: 'Pick flavor and custom topper design', daysBeforeEvent: 7, date: computeMilestoneDate(input.eventDate, 7), completed: false },
          { id: nanoid(), title: 'Birthday Celebration Day!', description: 'Enjoy the party with family and friends', daysBeforeEvent: 0, date: input.eventDate, completed: false },
        ];

  const defaultVendors = isCommunity
    ? [
        { id: nanoid(), category: 'Municipal & Police Clearances', questionsToAsk: ['What is the sound cutoff time (10 PM)?', 'Is a dedicated fire extinguisher setup required?'], bookByDaysBeforeEvent: 30, bookByDate: computeMilestoneDate(input.eventDate, 30), status: 'to-contact' as const, quotedAmount: 0, budgetedAmount: enrichedBudget.find(b => b.category.includes('Permission'))?.amount || 0, subEvent: 'General' },
        { id: nanoid(), category: 'Pandal & Tent Contractor', questionsToAsk: ['Are waterproof materials used?', 'Are emergency exits planned?'], bookByDaysBeforeEvent: 20, bookByDate: computeMilestoneDate(input.eventDate, 20), status: 'to-contact' as const, quotedAmount: 0, budgetedAmount: enrichedBudget.find(b => b.category.includes('Pandal'))?.amount || 0, subEvent: 'Pandal Setup' },
      ]
    : [
        { id: nanoid(), category: 'Catering & Live Counters', questionsToAsk: ['Do you provide live counters?', 'What is your staff-to-guest ratio?'], bookByDaysBeforeEvent: 45, bookByDate: computeMilestoneDate(input.eventDate, 45), status: 'to-contact' as const, quotedAmount: 0, budgetedAmount: enrichedBudget.find(b => b.category.includes('Catering') || b.category.includes('Food'))?.amount || 0 },
        { id: nanoid(), category: 'Floral & Thematic Decorator', questionsToAsk: ['Can we do a mockup preview?', 'Are real or artificial flowers used?'], bookByDaysBeforeEvent: 30, bookByDate: computeMilestoneDate(input.eventDate, 30), status: 'to-contact' as const, quotedAmount: 0, budgetedAmount: enrichedBudget.find(b => b.category.includes('Decor'))?.amount || 0 },
      ];

  const defaultIdeas: Idea[] = [
    { id: nanoid(), section: 'theme', title: 'Marigold Sunshine & Desi Vibe', description: 'Vibrant yellow and orange florals with brass bells, earthen diyas, and festive fabric drapes.', estimatedCost: '₹15,000-₹30,000' },
    { id: nanoid(), section: 'decor', title: 'Floral Mandap / Photobooth with Rickshaw', description: 'Quirky painted auto-rickshaw photo corner decorated with marigold garlands and fairy lights.', estimatedCost: '₹10,000-₹25,000' },
    { id: nanoid(), section: 'food', title: 'Live Chaat & Jalebi Rabri Counters', description: 'Hot piping pani puri, aloo tikki, and fresh jalebi made live in front of guests.', estimatedCost: '₹350-₹600 per plate' },
    { id: nanoid(), section: 'activities', title: 'Dhol Tasha & Antakshari Face-off', description: 'Energizing beats to bring both sides together for friendly competition and dancing.', estimatedCost: '₹8,000-₹15,000' },
    { id: nanoid(), section: 'returnGifts', title: 'Eco-Friendly Seed Paper & Mithai Boxes', description: 'Handcrafted box with traditional artisanal sweets and plantable seed paper tags.', estimatedCost: '₹200-₹400 per guest' },
  ];

  return {
    summary: `A vibrant ${input.eventType} celebration designed for ${input.guestCount} guests in ${input.city}, bringing memorable cultural hospitality within your ₹${input.totalBudget.toLocaleString('en-IN')} budget.`,
    budget: enrichedBudget,
    timeline: defaultMilestones,
    vendors: defaultVendors,
    ideas: defaultIdeas,
  };
}

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
    const matchedCategory = enrichedBudget.find((b) =>
      b.category.toLowerCase().includes(v.category.toLowerCase()) ||
      v.category.toLowerCase().includes(b.category.toLowerCase())
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
 * Returns enriched plan, or falls back gracefully on repeated failure.
 */
export async function generateEventPlan(input: WizardInput): Promise<{ plan: PlanOutput; isFallback: boolean }> {
  // Check LRU cache
  const cacheKey = createPlanCacheKey(input as unknown as Record<string, unknown>);
  const cached = getCachedPlan(cacheKey);
  if (cached) {
    return { plan: cached, isFallback: false };
  }

  // If no API key configured (e.g. initial dev or test), return fallback
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    const fallback = generateFallbackPlan(input);
    return { plan: fallback, isFallback: true };
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
          responseSchema: jsonSchema,
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

      return { plan: enriched, isFallback: false };
    } catch (err) {
      _lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // If both attempts failed, return graceful fallback plan
  const fallback = generateFallbackPlan(input);
  return { plan: fallback, isFallback: true };
}

/**
 * Refine ideas for a specific section via Gemini with retry and fallback.
 */
export async function refineIdeasSection(
  section: IdeaSection,
  instruction: string,
  input: WizardInput,
  currentIdeas: Idea[],
): Promise<Idea[]> {
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    return currentIdeas;
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
          responseSchema: jsonSchema,
          temperature: 0.8,
        },
      });

      const response = await withTimeout(generateCall, 30000);
      const text = response.text || '';
      const parsed = JSON.parse(text);
      const sanitized = sanitizeObject(parsed);
      const validated = geminiRefineOutputSchema.parse(sanitized);

      return validated.ideas.map((raw) => ({
        id: nanoid(),
        section: raw.section,
        title: raw.title,
        description: raw.description,
        estimatedCost: raw.estimatedCost,
        subEvent: raw.subEvent,
      }));
    } catch {
      // Continue loop for retry
    }
  }

  return currentIdeas;
}
