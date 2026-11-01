import { wizardInputSchema, type WizardInput } from '../../shared/schemas.js';
import { generateFallbackPlan } from '../services/fallback.js';
import type { PlanGenerationResult } from '../services/sharedPlanGeneration.js';

let sequence = 0;
export function planInput(): WizardInput {
  return wizardInputSchema.parse({
    eventType: 'birthday',
    eventDate: '2099-12-15',
    city: `Concurrency Jaipur ${String(sequence++)}`,
    guestCount: 45,
    totalBudget: 40000,
  });
}
export function planResult(): PlanGenerationResult {
  return { plan: generateFallbackPlan(planInput()), source: 'gemini', model: 'test-model' };
}
export function creativeResponse(input: WizardInput) {
  const plan = generateFallbackPlan(input);
  return {
    summary: 'A shared celebration',
    ideas: plan.ideas.map(({ id: _id, ...idea }) => idea),
    taskDescriptions: [],
    vendorQuestions: [],
  };
}
export async function* json(value: unknown) {
  yield await Promise.resolve(JSON.stringify(value));
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
