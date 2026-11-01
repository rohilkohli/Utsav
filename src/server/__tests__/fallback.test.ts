import { describe, it, expect } from 'vitest';
import { generateFallbackPlan } from '../services/fallback.js';
import type { WizardInput } from '../../shared/schemas.js';

const base: WizardInput = {
  eventType: 'wedding',
  subEvents: ['Haldi', 'Mehendi', 'Sangeet', 'Wedding Ceremony'],
  eventDate: '2026-12-10',
  city: 'Jaipur',
  guestCount: 250,
  totalBudget: 2_000_000,
  theme: 'Royal Rajputana Heritage',
  dietaryPreferences: ['Pure Vegetarian'],
  culturalNotes: 'Traditional Marwari rituals',
  language: 'english',
};

describe('generateFallbackPlan', () => {
  it('returns a plan with all required fields', () => {
    const plan = generateFallbackPlan(base);
    expect(plan.summary).toBeTruthy();
    expect(plan.budget.length).toBeGreaterThan(0);
    expect(plan.timeline.length).toBeGreaterThan(0);
    expect(plan.vendors.length).toBeGreaterThan(0);
    expect(plan.ideas.length).toBeGreaterThan(0);
  });

  it('budget amounts sum to totalBudget for wedding', () => {
    const plan = generateFallbackPlan(base);
    const total = plan.budget.reduce((s, c) => s + c.amount, 0);
    expect(total).toBe(base.totalBudget);
  });

  it('budget amounts sum to totalBudget for birthday', () => {
    const input: WizardInput = { ...base, eventType: 'birthday', subEvents: [], totalBudget: 50_000 };
    const plan = generateFallbackPlan(input);
    const total = plan.budget.reduce((s, c) => s + c.amount, 0);
    expect(total).toBe(50_000);
  });

  it('budget amounts sum to totalBudget for community', () => {
    const input: WizardInput = {
      ...base,
      eventType: 'community',
      subEvents: ['Pandal Setup', 'Cultural Night / Garba'],
      totalBudget: 400_000,
    };
    const plan = generateFallbackPlan(input);
    const total = plan.budget.reduce((s, c) => s + c.amount, 0);
    expect(total).toBe(400_000);
  });

  it('each budget category has a unique id', () => {
    const plan = generateFallbackPlan(base);
    const ids = plan.budget.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each timeline milestone has a computed date string', () => {
    const plan = generateFallbackPlan(base);
    plan.timeline.forEach((m) => {
      expect(m.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(m.completed).toBe(false);
    });
  });

  it('each vendor has a bookByDate and status to-contact', () => {
    const plan = generateFallbackPlan(base);
    plan.vendors.forEach((v) => {
      expect(v.bookByDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(v.status).toBe('to-contact');
    });
  });

  it('ideas have a non-empty title and description', () => {
    const plan = generateFallbackPlan(base);
    plan.ideas.forEach((idea) => {
      expect(idea.title.length).toBeGreaterThan(0);
      expect(idea.description.length).toBeGreaterThan(0);
    });
  });

  it('summary mentions the city', () => {
    const plan = generateFallbackPlan(base);
    expect(plan.summary.toLowerCase()).toContain('jaipur');
  });

  it('summary mentions guest count for birthday', () => {
    const input: WizardInput = { ...base, eventType: 'birthday', subEvents: [], city: 'Mumbai', guestCount: 30 };
    const plan = generateFallbackPlan(input);
    expect(plan.summary).toContain('30');
  });

  it('works with zero-length subEvents', () => {
    const input: WizardInput = { ...base, subEvents: [] };
    expect(() => generateFallbackPlan(input)).not.toThrow();
  });

  it('handles very small budgets without negative amounts', () => {
    const input: WizardInput = { ...base, totalBudget: 100 };
    const plan = generateFallbackPlan(input);
    plan.budget.forEach((c) => expect(c.amount).toBeGreaterThanOrEqual(0));
    const total = plan.budget.reduce((s, c) => s + c.amount, 0);
    expect(total).toBe(100);
  });
});
