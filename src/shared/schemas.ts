import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const EVENT_TYPES = ['wedding', 'birthday', 'community'] as const;
export const IDEA_SECTIONS = ['theme', 'decor', 'food', 'activities', 'returnGifts'] as const;
export const OUTPUT_LANGUAGES = ['english', 'hindi'] as const;
export const VENDOR_STATUSES = ['to-contact', 'quoted', 'booked'] as const;

export const WEDDING_SUB_EVENTS = [
  'Roka',
  'Haldi',
  'Mehendi',
  'Sangeet',
  'Wedding Ceremony',
  'Reception',
] as const;

export const COMMUNITY_SUB_EVENTS = [
  'Pandal Setup',
  'Inauguration & Aarti',
  'Cultural Night / Garba',
  'Bhandara / Prasad',
  'Visarjan / Procession',
] as const;

/** Get current date string (YYYY-MM-DD) in Asia/Kolkata timezone */
export function getTodayInKolkata(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/** Check if dateStr (YYYY-MM-DD) is >= today in Asia/Kolkata */
export function isDateOnOrAfterTodayInKolkata(dateStr: string): boolean {
  const today = getTodayInKolkata();
  return dateStr >= today;
}

// ─── Wizard Input Schema ──────────────────────────────────────
export const wizardInputSchema = z
  .object({
    eventType: z.enum(EVENT_TYPES),
    subEvents: z.array(z.string().min(1).max(100)).default([]),
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .refine(isDateOnOrAfterTodayInKolkata, {
        message: 'Event date cannot be in the past (IST)',
      }),
    city: z.string().trim().min(1, 'City is required').max(100),
    guestCount: z
      .number()
      .int()
      .min(0, 'Guest count cannot be negative')
      .max(10000, 'Guest count cannot exceed 10,000'),
    totalBudget: z
      .number()
      .min(0, 'Budget cannot be negative')
      .max(1_000_000_000, 'Budget cannot exceed ₹100 Crore'),
    theme: z.string().max(300).default(''),
    dietaryPreferences: z.array(z.string().max(50)).default([]),
    culturalNotes: z.string().max(500).default(''),
    language: z.enum(OUTPUT_LANGUAGES).default('english'),
  })
  .refine(
    (data) => {
      if (data.eventType === 'wedding') {
        return data.subEvents && data.subEvents.length > 0;
      }
      return true;
    },
    {
      message: 'Weddings must include at least one ceremony/function',
      path: ['subEvents'],
    },
  );

export type WizardInput = z.infer<typeof wizardInputSchema>;

// ─── Gemini Structured Plan Output Schema ─────────────────────
// Raw AI output returns categories with suggested percentages, milestone relative days, vendor leads, and ideas.
export const rawBudgetCategorySchema = z.object({
  category: z.string().min(1),
  suggestedPercent: z.number().min(0).max(100),
  subEvent: z.string().optional(),
});

export const rawMilestoneSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  daysBeforeEvent: z.number().int(),
  subEvent: z.string().optional(),
});

export const rawVendorSchema = z.object({
  category: z.string().min(1),
  questionsToAsk: z.array(z.string().min(1)).min(1),
  bookByDaysBeforeEvent: z.number().int().min(0),
  subEvent: z.string().optional(),
});

export const rawIdeaSchema = z.object({
  section: z.enum(IDEA_SECTIONS),
  title: z.string().min(1),
  description: z.string().min(1),
  estimatedCost: z.string().optional(),
  subEvent: z.string().optional(),
});

export const geminiRawPlanSchema = z.object({
  summary: z.string().min(1),
  budget: z.array(rawBudgetCategorySchema).min(1),
  timeline: z.array(rawMilestoneSchema).min(1),
  vendors: z.array(rawVendorSchema).min(1),
  ideas: z.array(rawIdeaSchema).min(5),
});

export type GeminiRawPlan = z.infer<typeof geminiRawPlanSchema>;

// ─── Client / UI Enriched Plan Schema ──────────────────────────
export const budgetCategorySchema = z.object({
  id: z.string(),
  category: z.string(),
  suggestedPercent: z.number(),
  amount: z.number().int(),
  actual: z.number().int(),
  subEvent: z.string().optional(),
});
export type BudgetCategory = z.infer<typeof budgetCategorySchema>;

export const milestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  daysBeforeEvent: z.number().int(),
  date: z.string(), // YYYY-MM-DD
  subEvent: z.string().optional(),
  completed: z.boolean().default(false),
});
export type Milestone = z.infer<typeof milestoneSchema>;

export const vendorSchema = z.object({
  id: z.string(),
  category: z.string(),
  questionsToAsk: z.array(z.string()),
  bookByDaysBeforeEvent: z.number().int(),
  bookByDate: z.string(), // YYYY-MM-DD
  status: z.enum(VENDOR_STATUSES),
  quotedAmount: z.number().int(),
  budgetedAmount: z.number().int(),
  subEvent: z.string().optional(),
});
export type Vendor = z.infer<typeof vendorSchema>;

export const ideaSchema = z.object({
  id: z.string(),
  section: z.enum(IDEA_SECTIONS),
  title: z.string(),
  description: z.string(),
  estimatedCost: z.string().optional(),
  subEvent: z.string().optional(),
});
export type Idea = z.infer<typeof ideaSchema>;

export const planOutputSchema = z.object({
  summary: z.string(),
  budget: z.array(budgetCategorySchema),
  timeline: z.array(milestoneSchema),
  vendors: z.array(vendorSchema),
  ideas: z.array(ideaSchema),
});
export type PlanOutput = z.infer<typeof planOutputSchema>;

// ─── Refinement Schema ────────────────────────────────────────
export const refineInputSchema = z.object({
  planId: z.string().optional(),
  section: z.enum(IDEA_SECTIONS),
  instruction: z
    .string()
    .trim()
    .min(1, 'Instruction cannot be empty')
    .max(300, 'Instruction must be 300 characters or fewer'),
  currentPlan: planOutputSchema,
  input: wizardInputSchema,
});
export type RefineInput = z.infer<typeof refineInputSchema>;

export const geminiRefineOutputSchema = z.object({
  ideas: z.array(rawIdeaSchema).min(1),
});
export type GeminiRefineOutput = z.infer<typeof geminiRefineOutputSchema>;

// ─── Saved Plan & Share Schema ────────────────────────────────
export const savedPlanSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  shareToken: z.string().optional(),
  input: wizardInputSchema,
  plan: planOutputSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().optional(), // For read-only guest shares (30 days)
});
export type SavedPlan = z.infer<typeof savedPlanSchema>;

// ─── API Payloads ─────────────────────────────────────────────
export const generatePlanRequestSchema = z.object({
  input: wizardInputSchema,
});
export type GeneratePlanRequest = z.infer<typeof generatePlanRequestSchema>;

export const generatePlanResponseSchema = z.object({
  plan: planOutputSchema,
  planId: z.string().optional(),
  isFallback: z.boolean().optional(),
});
export type GeneratePlanResponse = z.infer<typeof generatePlanResponseSchema>;

export const refineSectionResponseSchema = z.object({
  ideas: z.array(ideaSchema),
});
export type RefineSectionResponse = z.infer<typeof refineSectionResponseSchema>;

// ─── Runtime Firebase Config Schema ───────────────────────────
export const publicConfigSchema = z.object({
  firebase: z.object({
    apiKey: z.string(),
    authDomain: z.string(),
    projectId: z.string(),
    storageBucket: z.string().optional(),
    messagingSenderId: z.string().optional(),
    appId: z.string().optional(),
  }),
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;

/** Generate JSON Schema for Gemini structured output via zod-to-json-schema */
export function getGeminiPlanJsonSchema(): Record<string, unknown> {
  const fullSchema = zodToJsonSchema(geminiRawPlanSchema, 'GeminiRawPlan');
  // Return the main definition without $schema or root-level envelope
  const definitions = (fullSchema as { definitions?: Record<string, unknown> }).definitions;
  if (definitions?.GeminiRawPlan) {
    return definitions.GeminiRawPlan as Record<string, unknown>;
  }
  return fullSchema as Record<string, unknown>;
}

export function getGeminiRefineJsonSchema(): Record<string, unknown> {
  const fullSchema = zodToJsonSchema(geminiRefineOutputSchema, 'GeminiRefineOutput');
  const definitions = (fullSchema as { definitions?: Record<string, unknown> }).definitions;
  if (definitions?.GeminiRefineOutput) {
    return definitions.GeminiRefineOutput as Record<string, unknown>;
  }
  return fullSchema as Record<string, unknown>;
}
