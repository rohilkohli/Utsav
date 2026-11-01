import { describe, expect, it } from 'vitest';
import { enrichRawPlan } from '../services/planEnrichment.js';
import { geminiRawPlanSchema, wizardInputSchema } from '../../shared/schemas.js';
const input = wizardInputSchema.parse({
  eventType: 'birthday',
  eventDate: '2099-12-15',
  city: 'Jaipur',
  guestCount: 30,
  totalBudget: 40000,
  priorities: ['Catering'],
});
const fixture = () =>
  geminiRawPlanSchema.parse({
    summary: 'Celebration',
    budget: [
      { category: 'Catering', suggestedPercent: 50 },
      { category: 'Decor', suggestedPercent: 50 },
    ],
    timeline: [
      { title: 'Book venue', description: 'Confirm venue', daysBeforeEvent: 10 },
      {
        title: 'Decorate',
        description: 'Arrange decor',
        daysBeforeEvent: 2,
        dependsOn: ['Book venue', '0'],
      },
    ],
    vendors: [
      {
        category: 'Catering service',
        questionsToAsk: ['GST included?'],
        bookByDaysBeforeEvent: 10,
      },
      { category: 'Unknown vendor', questionsToAsk: ['Availability?'], bookByDaysBeforeEvent: 1 },
    ],
    ideas: ['theme', 'decor', 'food', 'activities', 'returnGifts'].map((section) => ({
      section,
      title: 'Idea',
      description: 'Details',
    })),
  });
describe('Plan enrichment references and deterministic allocations', () => {
  it('remaps human task references before DAG validation and preserves exact money', () => {
    const plan = enrichRawPlan(fixture(), input);
    expect(plan.timeline[1]?.dependsOn).toEqual([plan.timeline[0]?.id, plan.timeline[0]?.id]);
    expect(plan.budget.reduce((sum, category) => sum + category.amount, 0)).toBe(40000);
    expect(plan.vendors[0]?.budgetedAmount).toBeGreaterThan(0);
    expect(plan.vendors[1]?.budgetedAmount).toBe(0);
  });
  it('rejects unresolved dependencies and cycles instead of returning a corrupt schedule', () => {
    const raw = fixture();
    raw.timeline[1] = {
      ...raw.timeline[1],
      title: 'Decorate',
      description: 'Decor',
      daysBeforeEvent: 2,
      durationDays: 1,
      dependsOn: ['missing'],
    };
    expect(() => enrichRawPlan(raw, input)).toThrow();
    raw.timeline[1].dependsOn = ['Decorate'];
    expect(() => enrichRawPlan(raw, input)).toThrow();
  });
});
