import type { PlanOutput, WizardInput } from './schemas.js';
import { formatINR } from './currency.js';
import { buildSchedule, diffInDays } from './timeline.js';

export interface PlanFacts {
  budget: { total: number; actual: number; remaining: number };
  guests: number;
  eventDate: string;
  daysToEvent: number;
  nextTask?: string;
  nextTaskDate?: string;
  unbookedVendors: number;
  requiredCatering: number;
}
export function planFacts(plan: PlanOutput, input: WizardInput, today: string): PlanFacts {
  const actual = plan.budget.reduce((sum, category) => sum + category.actual, 0);
  let next: { title: string; effectiveDate: string } | undefined;
  try {
    next = buildSchedule(plan.timeline, input.eventDate, today)
      .filter((task) => !task.completed && task.status !== 'done' && task.effectiveDate >= today)
      .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))[0];
  } catch {
    /* Invalid schedules are reported by planInsights, not invented here. */
  }
  return {
    budget: { total: input.totalBudget, actual, remaining: input.totalBudget - actual },
    guests: input.guestCount,
    eventDate: input.eventDate,
    daysToEvent: diffInDays(today, input.eventDate),
    nextTask: next?.title,
    nextTaskDate: next?.effectiveDate,
    unbookedVendors: plan.vendors.filter((vendor) => vendor.status !== 'booked').length,
    requiredCatering: input.guestCount * (plan.perPlate ?? 0),
  };
}

/** Offline answers use live engine facts, with English, Hindi and Hinglish topic detection. */
export function localAnswer(
  question: string,
  plan: PlanOutput,
  input: WizardInput,
  today: string,
): string {
  const facts = planFacts(plan, input, today);
  const text = question.toLowerCase();
  const hindi = /[\u0900-\u097f]/.test(question) || input.language === 'hindi';
  if (/(budget|kharcha|paisa|बजट|खर्च|पैस)/.test(text)) {
    const remaining = formatINR(Math.abs(facts.budget.remaining));
    return hindi
      ? `आपका बजट ${formatINR(facts.budget.total)} है और वर्तमान खर्च ${formatINR(facts.budget.actual)} है। ${remaining} ${facts.budget.remaining >= 0 ? 'बाकी हैं' : 'बजट से अधिक हैं'}।`
      : `Your budget is ${formatINR(facts.budget.total)} and current planned spend is ${formatINR(facts.budget.actual)}. ${remaining} ${facts.budget.remaining >= 0 ? 'remains' : 'is over budget'}.`;
  }
  if (/(vendor|caterer|विक्रेता|कैटर|वेंडर)/.test(text))
    return hindi
      ? `${facts.unbookedVendors} विक्रेता श्रेणियों की पुष्टि बाकी है। सबसे नज़दीकी बुकिंग तारीख से शुरू करें।`
      : `${facts.unbookedVendors} vendor categories still need confirmation. Start with the closest booking deadline.`;
  if (/(next|kya kar|अगला|क्या कर)/.test(text))
    return facts.nextTask
      ? hindi
        ? `अगला काम: ${facts.nextTask}, ${facts.nextTaskDate} तक।`
        : `Your next task is ${facts.nextTask}, due ${facts.nextTaskDate}.`
      : hindi
        ? 'सभी निर्धारित काम पूरे हैं या उनकी तारीख की समीक्षा आवश्यक है।'
        : 'All dated tasks are complete or need a date review.';
  if (/(time|kab|when|दिन|कब|समय)/.test(text))
    return facts.daysToEvent >= 0
      ? hindi
        ? `${facts.eventDate} तक ${facts.daysToEvent} दिन बाकी हैं।`
        : `${facts.daysToEvent} days remain until ${facts.eventDate}.`
      : hindi
        ? 'कार्यक्रम की तारीख बीत चुकी है।'
        : 'The event date has passed.';
  if (/(guest|mehm[aā]n|mehmaan|अतिथि|मेहमान)/.test(text))
    return hindi
      ? `योजना ${facts.guests} मेहमानों के लिए है। प्रति प्लेट दर के अनुसार भोजन का खर्च ${formatINR(facts.requiredCatering)} है।`
      : `The plan is sized for ${facts.guests} guests. At the current per-plate rate catering requires ${formatINR(facts.requiredCatering)}.`;
  return hindi
    ? 'मैं वर्तमान योजना के बजट, विक्रेताओं, अगले काम, समय और मेहमानों में मदद कर सकता हूँ।'
    : 'I can help with your budget, vendors, next task, timing, or guest count using the live plan.';
}
