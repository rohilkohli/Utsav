import { z } from 'zod';
import { geminiRawPlanSchema, geminiRefineOutputSchema } from './schemas/plan.js';
export * from './schemas/input.js';
export * from './schemas/plan.js';
export * from './schemas/api.js';
export * from './quoteSchemas.js';

/**
 * Generate native JSON Schema for Gemini structured output via Zod 4's native z.toJSONSchema
 */
export function getGeminiPlanJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(geminiRawPlanSchema);
}

export function getGeminiRefineJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(geminiRefineOutputSchema);
}
