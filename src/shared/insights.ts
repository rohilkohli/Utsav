import type { PlanOutput, WizardInput } from './schemas.js';
import { formatINR } from './currency.js';
import { buildSchedule, diffInDays } from './timeline.js';

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
    const percentage = input.totalBudget > 0 ? Math.round((overBudget / input.totalBudget) * 100) : 0;
    insights.push({
      id: 'budget-overrun',
      severity: 'critical',
      message: `Actual spend is ${formatINR(overBudget)} over budget (${percentage}%).`,
      tab: 'budget',
    });
  }

  try {
    const schedule = buildSchedule(plan.timeline, input.eventDate, today);
    if (schedule.some((milestone) => milestone.flags.impossible || milestone.flags.tooLate)) {
      insights.push({ id: 'timeline-impossible', severity: 'critical', message: 'One or more tasks cannot finish before the celebration date.', tab: 'timeline' });
    }
    if (schedule.some((milestone) => milestone.flags.overdue)) {
      insights.push({ id: 'timeline-overdue', severity: 'warning', message: 'Some timeline tasks are overdue.', tab: 'timeline' });
    }
    if (schedule.some((milestone) => milestone.flags.atRisk && milestone.delayDays)) {
      insights.push({ id: 'timeline-delay', severity: 'warning', message: 'A delayed prerequisite has pushed downstream work.', tab: 'timeline' });
    }
    const next = schedule.find((milestone) => milestone.effectiveDate >= today && milestone.status !== 'done' && !milestone.completed);
    if (next) {
      insights.push({
        id: 'next-task',
        severity: 'suggestion',
        message: `Next: ${next.title} by ${next.effectiveDate}${next.assignee ? ` (${next.assignee})` : ''}.`,
        tab: 'timeline',
      });
    }
  } catch {
    insights.push({ id: 'timeline-invalid', severity: 'critical', message: 'Timeline dependencies need attention before scheduling can continue.', tab: 'timeline' });
  }

  const contingency = plan.budget.find((category) => category.category.toLowerCase().includes('contingency'));
  if (!contingency || contingency.amount < input.totalBudget * 0.05) {
    insights.push({ id: 'low-contingency', severity: 'warning', message: 'Keep at least 5% of the budget as a contingency buffer.', tab: 'budget' });
  }
  for (const vendor of plan.vendors) {
    if (vendor.status !== 'booked' && diffInDays(today, vendor.bookByDate) <= 60 && diffInDays(today, vendor.bookByDate) >= 0) {
      insights.push({ id: `vendor-${vendor.id}`, severity: 'warning', message: `${vendor.category} should be confirmed within the next 60 days.`, tab: 'vendors' });
    }
  }

  return insights.sort((left, right) => severityRank[left.severity] - severityRank[right.severity]);
}
