import { nanoid } from 'nanoid';
import {
  geminiRawPlanSchema,
  getTodayInKolkata,
  type GeminiRawPlan,
  type PlanOutput,
  type WizardInput,
} from '../../shared/schemas.js';
import { ensureContingencyCategory, populateCategoryAmounts } from '../../shared/budget.js';
import { computeMilestoneDate } from '../../shared/timeline.js';
import { prepareTimeline } from '../../shared/timelinePreparation.js';

/** Enriches trusted structured presets using deterministic money and date engines. */
export function enrichRawPlan(
  rawInput: GeminiRawPlan,
  input: WizardInput,
  today = getTodayInKolkata(),
): PlanOutput {
  const raw = geminiRawPlanSchema.parse(rawInput);
  const budget = populateCategoryAmounts(
    ensureContingencyCategory(
      raw.budget.map((category) => ({
        ...category,
        id: nanoid(),
      })),
    ),
    input.totalBudget,
    input.priorities,
  );
  const timeline = raw.timeline.map((milestone) => ({
    ...milestone,
    id: nanoid(),
    date: computeMilestoneDate(input.eventDate, milestone.daysBeforeEvent),
    durationDays: milestone.durationDays,
    dependsOn: milestone.dependsOn,
    status: 'todo' as const,
    completed: false,
  }));
  const idsByTitle = new Map(timeline.map((milestone) => [milestone.title, milestone.id]));
  for (const milestone of timeline) {
    milestone.dependsOn = milestone.dependsOn.map(
      (reference) => idsByTitle.get(reference) ?? timeline[Number(reference)]?.id ?? reference,
    );
  }
  const vendors = raw.vendors.map((vendor) => {
    const category = budget.find(
      (entry) =>
        entry.category.toLowerCase().includes(vendor.category.toLowerCase()) ||
        vendor.category.toLowerCase().includes(entry.category.toLowerCase()),
    );
    return {
      ...vendor,
      id: nanoid(),
      bookByDate: computeMilestoneDate(input.eventDate, vendor.bookByDaysBeforeEvent),
      status: 'to-contact' as const,
      quotedAmount: 0,
      budgetedAmount: category?.amount ?? 0,
    };
  });
  return {
    summary: raw.summary,
    budget,
    ...prepareTimeline({ timeline }, input.eventDate, today),
    vendors,
    ideas: raw.ideas.map((idea) => ({ ...idea, id: nanoid() })),
  };
}
