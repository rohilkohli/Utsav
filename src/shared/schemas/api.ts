import { z } from 'zod';
import { wizardInputSchema, storedWizardInputSchema, IDEA_SECTIONS } from './input.js';
import { planOutputSchema, ideaSchema, type PlanOutput } from './plan.js';

// ─── Plan Meta Source ─────────────────────────────────────────
export const planMetaSchema = z.object({
  source: z.enum(['gemini', 'cache', 'fallback']),
});
export type PlanMeta = z.infer<typeof planMetaSchema>;

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
  input: storedWizardInputSchema,
});
export type RefineInput = Omit<z.infer<typeof refineInputSchema>, 'currentPlan'> & {
  currentPlan: PlanOutput;
};

// ─── Saved Plan & Share Schema ────────────────────────────────
export const savedPlanSchema = z.object({
  id: z.string(),
  ownerUid: z.string().optional(),
  userId: z.string().optional(),
  shareToken: z.string().optional(),
  input: storedWizardInputSchema,
  plan: planOutputSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().optional(), // ISO string at the API boundary; Firestore Timestamp is handled internally in firestore.ts
});
export type SavedPlan = Omit<z.infer<typeof savedPlanSchema>, 'plan'> & { plan: PlanOutput };

export const updatePlanRequestSchema = z
  .object({
    input: storedWizardInputSchema.optional(),
    plan: planOutputSchema,
  })
  .strict();
export type UpdatePlanRequest = Omit<z.infer<typeof updatePlanRequestSchema>, 'plan'> & {
  plan: PlanOutput;
};

// ─── API Payloads ─────────────────────────────────────────────
export const generatePlanRequestSchema = z.object({
  input: wizardInputSchema,
});
export type GeneratePlanRequest = z.infer<typeof generatePlanRequestSchema>;

export const generatePlanResponseSchema = z.object({
  plan: planOutputSchema,
  planId: z.string().optional(),
  meta: planMetaSchema,
});
export type GeneratePlanResponse = Omit<z.infer<typeof generatePlanResponseSchema>, 'plan'> & {
  plan: PlanOutput;
};

export const refineSectionResponseSchema = z.object({
  ideas: z.array(ideaSchema),
  meta: planMetaSchema,
});
export type RefineSectionResponse = z.infer<typeof refineSectionResponseSchema>;

export const planReviewSchema = z.object({
  strengths: z.array(z.string().min(1)).min(1).max(6),
  risks: z.array(z.string().min(1)).min(1).max(6),
  suggestions: z.array(z.string().min(1)).min(1).max(6),
  overallScore: z.number().int().min(1).max(10),
});
export type PlanReview = z.infer<typeof planReviewSchema>;

export const planReviewResponseSchema = z.object({
  review: planReviewSchema,
  meta: z.object({ source: z.enum(['gemini', 'fallback']) }),
});

export const askPlannerRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  plan: planOutputSchema,
  input: storedWizardInputSchema,
});
export type AskPlannerRequest = Omit<z.infer<typeof askPlannerRequestSchema>, 'plan'> & {
  plan: PlanOutput;
};

export const askPlannerResponseSchema = z.object({
  answer: z.string(),
  source: z.enum(['gemini', 'fallback']),
});
export type AskPlannerResponse = z.infer<typeof askPlannerResponseSchema>;

export const parseIntakeRequestSchema = z.object({
  description: z.string().trim().min(1).max(1000),
});

export const parseIntakeResponseSchema = z.object({
  input: wizardInputSchema,
  source: z.enum(['gemini', 'fallback']),
});

export const explainTradeoffsRequestSchema = z.object({
  overBudgetAmount: z.number().int().nonnegative(),
  options: z
    .array(
      z.object({
        label: z.string().max(200),
        description: z.string().max(500),
        savings: z.number().int().nonnegative(),
        newTotal: z.number().int().nonnegative(),
      }),
    )
    .max(3),
});

export const explainTradeoffsResponseSchema = z.object({
  explanation: z.string(),
  source: z.enum(['gemini', 'fallback']),
});

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
