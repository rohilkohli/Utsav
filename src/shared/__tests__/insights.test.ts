import { describe, expect, it } from 'vitest';
import { planInsights } from '../insights.js';
import { localAnswer, planFacts } from '../advisor.js';
import type { PlanOutput, WizardInput } from '../schemas.js';

const input: WizardInput = {
  eventType: 'birthday',
  subEvents: [],
  eventDate: '2026-12-01',
  city: 'Pune',
  guestCount: 100,
  totalBudget: 100000,
  theme: '',
  dietaryPreferences: [],
  culturalNotes: '',
  language: 'english',
};

const plan: PlanOutput = {
  summary: 'A plan',
  budget: [
    { id: 'food', category: 'Food', suggestedPercent: 90, amount: 90000, actual: 120000 },
    {
      id: 'contingency-buffer',
      category: 'Contingency Buffer',
      suggestedPercent: 10,
      amount: 10000,
      actual: 10000,
    },
  ],
  timeline: [
    {
      id: 'cake',
      title: 'Order cake',
      description: 'Order',
      daysBeforeEvent: 7,
      date: '2026-11-24',
      completed: false,
    },
  ],
  vendors: [
    {
      id: 'caterer',
      category: 'Caterer',
      questionsToAsk: ['Rate?'],
      bookByDaysBeforeEvent: 30,
      bookByDate: '2026-11-20',
      status: 'to-contact',
      quotedAmount: 0,
      budgetedAmount: 10000,
    },
  ],
  ideas: [],
};

describe('deterministic planning assistant', () => {
  it('ranks live plan issues and produces offline answers', () => {
    const insights = planInsights(plan, input, '2026-11-01');
    expect(insights[0]?.id).toBe('budget-overrun');
    expect(insights.some((insight) => insight.id === 'vendor-caterer')).toBe(true);
    expect(localAnswer('What is my kharcha?', plan, input, '2026-11-01')).toContain('₹1,00,000');
    expect(planFacts(plan, input, '2026-11-01').guests).toBe(100);
  });
});
