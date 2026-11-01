import type { PlanOutput, WizardInput } from './schemas.js';
import { formatINR } from './currency.js';
import { diffInDays } from './timeline.js';
import { planSchedule } from './timelinePreparation.js';
import { riskFlags } from './quotes.js';

export type InsightSeverity = 'critical' | 'warning' | 'suggestion';
export type InsightTab = 'budget' | 'timeline' | 'vendors';
export interface PlanInsight {
  id: string;
  severity: InsightSeverity;
  message: string;
  tab: InsightTab;
}
const severityRank: Record<InsightSeverity, number> = { critical: 0, warning: 1, suggestion: 2 };

export function planInsights(plan: PlanOutput, input: WizardInput, today: string): PlanInsight[] {
  const insights: PlanInsight[] = [];
  const actual = plan.budget.reduce((sum, category) => sum + category.actual, 0);
  const overBudget = actual - input.totalBudget;
  if (overBudget > 0) {
    const percentage =
      input.totalBudget > 0
        ? `${Math.round((overBudget * 100) / input.totalBudget)}%`
        : 'no budget allocated';
    insights.push({
      id: 'budget-overrun',
      severity: 'critical',
      message: `Actual spend is ${formatINR(overBudget)} over budget (${percentage}).`,
      tab: 'budget',
    });
  }
  try {
    const schedule = planSchedule(plan, input.eventDate, today);
    if (schedule.some((task) => task.flags.impossible || task.flags.tooLate)) {
      insights.push({
        id: 'timeline-impossible',
        severity: 'critical',
        message: 'One or more tasks cannot finish before the celebration date.',
        tab: 'timeline',
      });
    }
    if (schedule.some((task) => task.flags.overdue)) {
      insights.push({
        id: 'timeline-overdue',
        severity: 'warning',
        message: 'Some timeline tasks are overdue.',
        tab: 'timeline',
      });
    }
    if (
      schedule.some(
        (task) => task.flags.atRisk && (task.pushedBy.length > 0 || (task.delayDays ?? 0) > 0),
      )
    ) {
      insights.push({
        id: 'timeline-delay',
        severity: 'warning',
        message: 'A delayed prerequisite has pushed downstream work.',
        tab: 'timeline',
      });
    }
    const next = schedule
      .filter((task) => task.effectiveDate >= today && task.status !== 'done' && !task.completed)
      .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))[0];
    if (next)
      insights.push({
        id: 'next-task',
        severity: 'suggestion',
        message: `Next: ${next.title} by ${next.effectiveDate}${next.assignee ? ` (${next.assignee})` : ''}.`,
        tab: 'timeline',
      });
  } catch {
    insights.push({
      id: 'timeline-invalid',
      severity: 'critical',
      message: 'Timeline dependencies need attention before scheduling can continue.',
      tab: 'timeline',
    });
  }
  const contingency = plan.budget
    .filter((category) => /contingency/i.test(category.category))
    .reduce((sum, category) => sum + category.amount, 0);
  if (contingency < input.totalBudget * 0.05) {
    insights.push({
      id: 'low-contingency',
      severity: 'warning',
      message: 'Keep at least 5% of the budget as a contingency buffer.',
      tab: 'budget',
    });
  }
  const daysToEvent = diffInDays(today, input.eventDate);
  for (const vendor of plan.vendors) {
    const quote = vendor.quotes?.find((entry) => entry.id === vendor.acceptedQuoteId);
    const risks = quote
      ? riskFlags({ ...quote, budgetedAmount: vendor.budgetedAmount }, input.guestCount)
      : [];
    if (risks.length > 0)
      insights.push({
        id: `quote-${vendor.id}`,
        severity: 'warning',
        message: `${vendor.category}: accepted quote needs attention (${risks.join(', ')}).`,
        tab: 'vendors',
      });
    if (vendor.status !== 'booked' && (daysToEvent <= 60 || vendor.bookByDate <= today)) {
      insights.push({
        id: `vendor-${vendor.id}`,
        severity: 'warning',
        message: `${vendor.category} still needs confirmation${vendor.bookByDate < today ? ' (booking deadline passed)' : ' before the celebration'}.`,
        tab: 'vendors',
      });
    }
  }
  return insights.sort((left, right) => severityRank[left.severity] - severityRank[right.severity]);
}
