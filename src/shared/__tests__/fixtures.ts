import type { BudgetCategory, Milestone, PlanOutput, WizardInput, Vendor } from '../schemas.js';
import type { VendorQuote } from '../quotes.js';
export const today = '2030-01-01';
export const input: WizardInput = {
  eventType: 'birthday',
  subEvents: [],
  eventDate: '2030-02-01',
  city: 'Pune',
  guestCount: 100,
  totalBudget: 100000,
  theme: '',
  dietaryPreferences: [],
  culturalNotes: '',
  language: 'english',
};
export const category = (id: string, amount = 100): BudgetCategory => ({
  id,
  category: id,
  suggestedPercent: 50,
  amount,
  actual: amount,
  locked: false,
  verified: false,
});
export const task = (id: string, daysBeforeEvent = 7, dependsOn: string[] = []): Milestone => ({
  id,
  title: id,
  description: id,
  daysBeforeEvent,
  date: '2030-01-25',
  durationDays: 3,
  dependsOn,
  completed: false,
  status: 'todo',
});
export const vendor: Vendor = {
  id: 'food',
  category: 'Food',
  status: 'to-contact',
  quotedAmount: 0,
  budgetedAmount: 100,
  questionsToAsk: ['Tax?'],
  bookByDate: '2030-01-10',
  bookByDaysBeforeEvent: 22,
};
export const quote: VendorQuote = {
  id: 'q1',
  vendorId: 'food',
  vendorName: 'Asha',
  category: 'Food',
  quotedAmount: 120,
  budgetedAmount: 100,
  notes: '',
  receivedAt: '2030-01-01',
};
export const plan = (updates: Partial<PlanOutput> = {}): PlanOutput => ({
  summary: 'Test plan',
  budget: [category('Food')],
  timeline: [task('next')],
  vendors: [vendor],
  ideas: [],
  ...updates,
});
