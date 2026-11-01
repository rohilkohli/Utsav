import {
  type PlanOutput,
  type WizardInput,
  type PlanReview,
  planReviewSchema,
  getTodayInKolkata,
} from '../../shared/schemas.js';
import { planFacts } from '../../shared/advisor.js';
import { wrapUserText } from '../prompts/plan.js';
import { callModel, type AiCallContext } from './model.js';

export function buildHeuristicReview(plan: PlanOutput, input: WizardInput): PlanReview {
  const overBudget =
    plan.budget.reduce((sum, category) => sum + category.actual, 0) > input.totalBudget;
  const unbooked = plan.vendors.filter((vendor) => vendor.status === 'to-contact').length;
  const completed = plan.timeline.filter((task) => task.completed).length;
  if (input.language === 'hindi')
    return {
      strengths: [
        `${plan.vendors.length} विक्रेता श्रेणियाँ पहचानी गईं`,
        `${plan.timeline.length} कार्य तय हैं`,
        completed ? `${completed} कार्य पूरे हैं` : 'योजना तैयार है',
      ],
      risks: [
        overBudget ? 'खर्च बजट से अधिक है — श्रेणियाँ जाँचें' : 'बजट संतुलित है',
        unbooked > 3
          ? `${unbooked} विक्रेताओं से संपर्क बाकी है`
          : 'विक्रेता बुकिंग सही दिशा में है',
      ],
      suggestions: [
        'हर श्रेणी में 2–3 विक्रेताओं के कोटेशन लें',
        'कार्य पूरे होने पर चिह्नित करें',
        'परिवार के साथ योजना साझा करें',
      ],
      overallScore: overBudget ? 6 : unbooked > plan.vendors.length / 2 ? 7 : 8,
    };
  return {
    strengths: [
      `${plan.vendors.length} vendor categories identified`,
      `${plan.timeline.length} timeline milestones planned`,
      completed ? `${completed} milestones already completed` : 'Plan ready to execute',
    ],
    risks: [
      overBudget
        ? 'Actual spend exceeds total budget — review categories'
        : 'Budget allocation looks healthy',
      unbooked > 3
        ? `${unbooked} vendors still uncontacted — start booking early`
        : 'Vendor booking on track',
    ],
    suggestions: [
      'Get 2-3 competing quotes per vendor category to ensure best value',
      'Mark milestones as complete as you progress to stay on track',
      'Share the plan link with family coordinators for visibility',
    ],
    overallScore: overBudget ? 6 : unbooked > plan.vendors.length / 2 ? 7 : 8,
  };
}

export async function reviewPlan(
  plan: PlanOutput,
  input: WizardInput,
  context: AiCallContext = {},
): Promise<{
  review: PlanReview;
  source: 'gemini' | 'fallback';
  model?: string;
}> {
  const result = await callModel({
    ...context,
    schema: planReviewSchema,
    prompt: `Review this celebration plan in ${input.language === 'hindi' ? 'Hindi (Devanagari)' : 'English'}. Give practical strengths, risks and suggestions. Use the supplied deterministic facts; do not recalculate amounts, dates, or shortfalls.\nFACTS: ${wrapUserText(JSON.stringify(planFacts(plan, input, getTodayInKolkata())))}\nSUMMARY: ${wrapUserText(plan.summary)}\nCITY: ${wrapUserText(input.city)}\nCULTURAL NOTES: ${wrapUserText(input.culturalNotes)}`,
  });
  return result
    ? { review: result.data, source: 'gemini', model: result.model }
    : { review: buildHeuristicReview(plan, input), source: 'fallback' };
}
