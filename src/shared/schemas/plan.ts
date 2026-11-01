import { z } from 'zod';
import { IDEA_SECTIONS, VENDOR_STATUSES } from './input.js';
import { vendorQuoteSchema } from '../quoteSchemas.js';

// ─── Gemini Structured Plan Output Schema ─────────────────────
export const rawBudgetCategorySchema = z.object({
  category: z.string().min(1),
  suggestedPercent: z.number().min(0).max(100),
  subEvent: z.string().optional(),
});

export const rawMilestoneSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  daysBeforeEvent: z.number().int(),
  durationDays: z.number().int().nonnegative().default(3),
  dependsOn: z.array(z.string()).default([]),
  assignee: z.string().optional(),
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
  locked: z.boolean().default(false),
  verified: z.boolean().default(false),
  subEvent: z.string().optional(),
  priority: z.boolean().optional(),
});
export type BudgetCategory = z.input<typeof budgetCategorySchema>;

export const milestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  daysBeforeEvent: z.number().int(),
  date: z.string(), // YYYY-MM-DD
  durationDays: z.number().int().nonnegative().default(3),
  dependsOn: z.array(z.string()).default([]),
  status: z.enum(['todo', 'done', 'delayed']).default('todo'),
  delayDays: z.number().int().nonnegative().optional(),
  assignee: z.string().optional(),
  subEvent: z.string().optional(),
  completed: z.boolean().default(false),
});
export type Milestone = z.input<typeof milestoneSchema>;

export const vendorSchema = z.object({
  id: z.string(),
  category: z.string(),
  questionsToAsk: z.array(z.string()),
  bookByDaysBeforeEvent: z.number().int(),
  bookByDate: z.string(), // YYYY-MM-DD
  status: z.enum(VENDOR_STATUSES),
  quotedAmount: z.number().int(),
  budgetedAmount: z.number().int(),
  quotes: z.array(vendorQuoteSchema).max(3).optional(),
  acceptedQuoteId: z.string().optional(),
  businessName: z.string().max(200).optional(),
  budgetCategoryId: z.string().optional(),
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
  perPlate: z.number().int().nonnegative().optional(),
  budget: z.array(budgetCategorySchema),
  timeline: z.array(milestoneSchema),
  vendors: z.array(vendorSchema),
  ideas: z.array(ideaSchema),
});
export type PlanOutput = Omit<z.infer<typeof planOutputSchema>, 'budget' | 'timeline'> & {
  budget: BudgetCategory[];
  timeline: Milestone[];
};

export const geminiRefineOutputSchema = z.object({
  ideas: z.array(rawIdeaSchema).min(1),
});
export type GeminiRefineOutput = z.infer<typeof geminiRefineOutputSchema>;
