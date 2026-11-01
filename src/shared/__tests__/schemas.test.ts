import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  wizardInputSchema,
  refineInputSchema,
  planOutputSchema,
  getGeminiPlanJsonSchema,
  getGeminiRefineJsonSchema,
} from '../schemas.js';

describe('Zod Schemas - Single Source of Truth Validation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates a valid wedding input with sub-events', () => {
    const validWedding = {
      eventType: 'wedding',
      subEvents: ['Haldi', 'Mehendi', 'Wedding Ceremony'],
      eventDate: '2026-11-20',
      city: 'Delhi',
      guestCount: 350,
      totalBudget: 2_500_000,
      theme: 'Royal Marigold & Sunset Tones',
      dietaryPreferences: ['Pure Vegetarian', 'Jain Options Available'],
      culturalNotes: 'Traditional North Indian Punjabi wedding',
      language: 'english',
    };

    const parsed = wizardInputSchema.safeParse(validWedding);
    expect(parsed.success).toBe(true);
  });

  it('rejects wedding without sub-events', () => {
    const invalidWedding = {
      eventType: 'wedding',
      subEvents: [],
      eventDate: '2026-11-20',
      city: 'Delhi',
      guestCount: 300,
      totalBudget: 1_000_000,
    };
    const parsed = wizardInputSchema.safeParse(invalidWedding);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain('at least one ceremony');
    }
  });

  it('rejects dates in the past (IST)', () => {
    const pastInput = {
      eventType: 'birthday',
      subEvents: [],
      eventDate: '2026-10-15', // Past relative to 2026-10-20
      city: 'Bengaluru',
      guestCount: 30,
      totalBudget: 25_000,
    };
    const parsed = wizardInputSchema.safeParse(pastInput);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain('cannot be in the past');
    }
  });

  it('accepts edge guest counts: 0 and 5,000 and 10,000; rejects negative and >10,000', () => {
    const base = {
      eventType: 'birthday',
      subEvents: [],
      eventDate: '2026-11-01',
      city: 'Pune',
      totalBudget: 50_000,
    };

    expect(wizardInputSchema.safeParse({ ...base, guestCount: 0 }).success).toBe(true);
    expect(wizardInputSchema.safeParse({ ...base, guestCount: 5000 }).success).toBe(true);
    expect(wizardInputSchema.safeParse({ ...base, guestCount: 10000 }).success).toBe(true);
    expect(wizardInputSchema.safeParse({ ...base, guestCount: -1 }).success).toBe(false);
    expect(wizardInputSchema.safeParse({ ...base, guestCount: 10001 }).success).toBe(false);
  });

  it('validates refine input and enforces 300-char max instruction limit', () => {
    const validRefine = {
      section: 'food',
      instruction: 'Make the menu completely vegan with regional street food live counters.',
      currentPlan: {
        summary: 'Wedding plan',
        budget: [],
        timeline: [],
        vendors: [],
        ideas: [],
      },
      input: {
        eventType: 'birthday',
        subEvents: [],
        eventDate: '2026-11-05',
        city: 'Mumbai',
        guestCount: 50,
        totalBudget: 40_000,
      },
    };
    expect(refineInputSchema.safeParse(validRefine).success).toBe(true);

    const tooLongInstruction = 'a'.repeat(301);
    expect(
      refineInputSchema.safeParse({
        ...validRefine,
        instruction: tooLongInstruction,
      }).success,
    ).toBe(false);
  });

  it('generates valid JSON schemas via z.toJSONSchema with non-empty properties and all required keys', () => {
    const planSchema = getGeminiPlanJsonSchema() as Record<string, unknown>;
    expect(planSchema).toBeDefined();
    expect(typeof planSchema).toBe('object');
    expect(planSchema.properties).toBeDefined();
    expect(Object.keys(planSchema.properties as Record<string, unknown>).length).toBeGreaterThan(0);
    expect(planSchema.required).toEqual(
      expect.arrayContaining(['summary', 'budget', 'timeline', 'vendors', 'ideas']),
    );

    const planOutputJson = z.toJSONSchema(planOutputSchema) as Record<string, unknown>;
    expect(planOutputJson.properties).toBeDefined();
    expect(
      Object.keys(planOutputJson.properties as Record<string, unknown>).length,
    ).toBeGreaterThan(0);
    expect(planOutputJson.required).toEqual(
      expect.arrayContaining(['summary', 'budget', 'timeline', 'vendors', 'ideas']),
    );

    const refineSchema = getGeminiRefineJsonSchema() as Record<string, unknown>;
    expect(refineSchema).toBeDefined();
    expect(typeof refineSchema).toBe('object');
    expect(refineSchema.properties).toBeDefined();
    expect(Object.keys(refineSchema.properties as Record<string, unknown>).length).toBeGreaterThan(
      0,
    );
    expect(refineSchema.required).toEqual(expect.arrayContaining(['ideas']));
  });
});
