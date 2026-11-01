import type { IdeaSection, PlanOutput, WizardInput } from '@shared/schemas';
import {
  askPlannerResponseSchema,
  explainTradeoffsResponseSchema,
  extractQuoteResponseSchema,
  generatePlanResponseSchema,
  parseIntakeResponseSchema,
  planReviewResponseSchema,
  refineSectionResponseSchema,
} from '@shared/schemas';
import { apiRequest, postJson, type AiRequestOptions } from './apiTransport';

export function apiGeneratePlan(input: WizardInput, token?: string, options?: AiRequestOptions) {
  return apiRequest('/api/plan', generatePlanResponseSchema, postJson({ input }, token), options);
}

export function apiRefineSection(
  section: IdeaSection,
  instruction: string,
  input: WizardInput,
  currentPlan: PlanOutput,
  options?: AiRequestOptions,
) {
  return apiRequest(
    '/api/refine',
    refineSectionResponseSchema,
    postJson({ section, instruction, input, currentPlan }),
    options,
  );
}

export function apiAskPlanner(
  question: string,
  input: WizardInput,
  plan: PlanOutput,
  options?: AiRequestOptions,
) {
  return apiRequest(
    '/api/ask-planner',
    askPlannerResponseSchema,
    postJson({ question, input, plan }),
    options,
  );
}

export async function apiReviewPlan(
  input: WizardInput,
  plan: PlanOutput,
  options?: AiRequestOptions,
) {
  const data = await apiRequest(
    '/api/review-plan',
    planReviewResponseSchema,
    postJson({ input, plan }),
    options,
  );
  return { review: data.review, source: data.meta.source };
}

export async function apiParseIntake(
  description: string,
  options?: AiRequestOptions,
): Promise<WizardInput> {
  return (
    await apiRequest(
      '/api/parse-intake',
      parseIntakeResponseSchema,
      postJson({ description }),
      options,
    )
  ).input;
}

export function apiExplainTradeoffs(
  overBudgetAmount: number,
  options: { label: string; description: string; savings: number; newTotal: number }[],
  requestOptions?: AiRequestOptions,
) {
  return apiRequest(
    '/api/explain-tradeoffs',
    explainTradeoffsResponseSchema,
    postJson({ overBudgetAmount, options }),
    requestOptions,
  );
}

export function apiExtractQuote(text: string, category?: string, options?: AiRequestOptions) {
  return apiRequest(
    '/api/extract-quote',
    extractQuoteResponseSchema,
    postJson({ text, category }),
    options,
  );
}
