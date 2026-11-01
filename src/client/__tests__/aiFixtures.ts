import { planOutputSchema, savedPlanSchema, wizardInputSchema } from '@shared/schemas';

export const input = wizardInputSchema.parse({
  eventType: 'birthday',
  eventDate: '2099-01-01',
  city: 'Mumbai',
  guestCount: 50,
  totalBudget: 40000,
});
export const plan = planOutputSchema.parse({
  summary: 'A celebration in Mumbai',
  budget: [
    { id: 'catering', category: 'Catering', suggestedPercent: 100, amount: 40000, actual: 40000 },
  ],
  timeline: [],
  vendors: [],
  ideas: [],
});
export const savedPlan = savedPlanSchema.parse({
  id: 'plan-1',
  input,
  plan,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
});
