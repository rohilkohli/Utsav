import type { PlanOutput, WizardInput } from './schemas.js';
import { formatINR } from './currency.js';
import { diffInDays } from './timeline.js';

export interface PlanFacts {
  budget: { total: number; actual: number; remaining: number };
  guests: number;
  eventDate: string;
  daysToEvent: number;
  nextTask?: string;
  unbookedVendors: number;
}

export function planFacts(plan: PlanOutput, input: WizardInput, today: string): PlanFacts {
  const actual = plan.budget.reduce((sum, category) => sum + category.actual, 0);
  const nextTask = plan.timeline
    .filter((milestone) => !milestone.completed && milestone.date >= today)
    .sort((left, right) => left.date.localeCompare(right.date))[0]?.title;
  return {
    budget: { total: input.totalBudget, actual, remaining: input.totalBudget - actual },
    guests: input.guestCount,
    eventDate: input.eventDate,
    daysToEvent: diffInDays(today, input.eventDate),
    nextTask,
    unbookedVendors: plan.vendors.filter((vendor) => vendor.status !== 'booked').length,
  };
}

export function localAnswer(question: string, plan: PlanOutput, input: WizardInput, today: string): string {
  const facts = planFacts(plan, input, today);
  const normalized = question.toLowerCase();
  if (/(budget|kharcha|paisa)/.test(normalized)) {
    return `Your budget is ${formatINR(facts.budget.total)} and current planned spend is ${formatINR(facts.budget.actual)}. ${facts.budget.remaining >= 0 ? `${formatINR(facts.budget.remaining)} remains.` : `${formatINR(Math.abs(facts.budget.remaining))} is over budget.`}`;
  }
  if (/(vendor|caterer)/.test(normalized)) {
    return `${facts.unbookedVendors} vendor categories still need confirmation. Start with the category whose booking date is closest.`;
  }
  if (/(next|kya kare)/.test(normalized)) {
    return facts.nextTask ? `Your next task is ${facts.nextTask}.` : 'All dated tasks are complete or need a date review.';
  }
  if (/(time|kab)/.test(normalized)) {
    return `${facts.daysToEvent >= 0 ? `${facts.daysToEvent} days remain` : 'The event date has passed'} until ${facts.eventDate}.`;
  }
  if (/(guest|mehman)/.test(normalized)) {
    return `The current plan is sized for ${facts.guests} guests. Catering should use this count and the confirmed per-plate quote.`;
  }
  return 'I can help with your budget, vendors, next task, timing, or guest count using the live plan.';
}
