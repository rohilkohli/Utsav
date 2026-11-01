import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  askPlannerRequestSchema,
  generatePlanRequestSchema,
  isValidCalendarDate,
  parseIntakeResponseSchema,
  refineInputSchema,
  savedPlanSchema,
  storedWizardInputSchema,
  updatePlanRequestSchema,
  wizardInputSchema,
} from '../schemas.js';
import { input, plan } from './fixtures.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2030-02-02T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('creation and persisted-event date contracts', () => {
  const historical = { ...input, eventDate: '2030-02-01' };
  it('permits existing plans after the event while creation and intake reject the same date', () => {
    expect(storedWizardInputSchema.safeParse(historical).success).toBe(true);
    expect(wizardInputSchema.safeParse(historical).success).toBe(false);
    expect(generatePlanRequestSchema.safeParse({ input: historical }).success).toBe(false);
    expect(
      parseIntakeResponseSchema.safeParse({ input: historical, source: 'fallback' }).success,
    ).toBe(false);
    expect(wizardInputSchema.safeParse({ ...input, eventDate: '2030-02-02' }).success).toBe(true);
    expect(wizardInputSchema.safeParse({ ...input, eventDate: '2030-02-03' }).success).toBe(true);
  });

  it('reads, updates, reviews and refines the same historical plan without bypassing structural checks', () => {
    const currentPlan = plan();
    const record = {
      id: 'retained',
      input: historical,
      plan: currentPlan,
      createdAt: '2030-01-01',
      updatedAt: '2030-02-02',
    };
    expect(savedPlanSchema.parse(record).input.eventDate).toBe(historical.eventDate);
    expect(
      updatePlanRequestSchema.safeParse({ input: historical, plan: currentPlan }).success,
    ).toBe(true);
    expect(updatePlanRequestSchema.safeParse({ plan: currentPlan }).success).toBe(true);
    expect(
      askPlannerRequestSchema.safeParse({
        question: 'What remains?',
        input: historical,
        plan: currentPlan,
      }).success,
    ).toBe(true);
    expect(
      refineInputSchema.safeParse({
        section: 'food',
        instruction: 'Use seasonal dishes',
        input: historical,
        currentPlan,
      }).success,
    ).toBe(true);
    expect(
      savedPlanSchema.safeParse({ ...record, input: { ...historical, guestCount: -1 } }).success,
    ).toBe(false);
  });

  it('accepts real leap days but rejects impossible or malformed calendar dates', () => {
    for (const date of ['2024-02-29', '2000-02-29', '2030-01-31']) {
      expect(isValidCalendarDate(date), date).toBe(true);
      expect(storedWizardInputSchema.safeParse({ ...historical, eventDate: date }).success).toBe(
        true,
      );
    }
    for (const date of [
      '2023-02-29',
      '2030-02-30',
      '2030-04-31',
      '2030-13-01',
      '2030-00-01',
      '2030-01-00',
      '2030-2-01',
      'not a date',
    ]) {
      expect(isValidCalendarDate(date), date).toBe(false);
      expect(storedWizardInputSchema.safeParse({ ...historical, eventDate: date }).success).toBe(
        false,
      );
      expect(wizardInputSchema.safeParse({ ...historical, eventDate: date }).success).toBe(false);
    }
  });

  it('retains wedding ceremony requirements and guest/budget bounds for persisted records', () => {
    expect(
      storedWizardInputSchema.safeParse({
        ...historical,
        eventType: 'wedding',
        subEvents: ['Haldi'],
      }).success,
    ).toBe(true);
    const invalid = [
      { ...historical, eventType: 'wedding', subEvents: [] },
      { ...historical, guestCount: 10001 },
      { ...historical, totalBudget: -1 },
      { ...historical, city: ' ' },
      { ...historical, eventDate: 20300201 },
    ];
    for (const value of invalid)
      expect(storedWizardInputSchema.safeParse(value).success).toBe(false);
  });
});
