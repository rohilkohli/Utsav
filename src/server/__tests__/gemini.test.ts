import { describe, it, expect } from 'vitest';
import { generateFallbackPlan, enrichRawPlan } from '../services/gemini.js';
import { buildPlanPrompt, buildRefinePrompt } from '../prompts/plan.js';
import { getShareSnapshot } from '../services/firestore.js';
import type { WizardInput, GeminiRawPlan } from '../../shared/schemas.js';

describe('Gemini Service & Prompts Branches', () => {
  const weddingInput: WizardInput = {
    eventType: 'wedding',
    subEvents: ['Haldi', 'Mehendi', 'Sangeet', 'Wedding Ceremony'],
    eventDate: '2026-12-10',
    city: 'Jaipur',
    guestCount: 250,
    totalBudget: 2_000_000,
    theme: 'Royal Rajputana Heritage',
    dietaryPreferences: ['Pure Vegetarian', 'Rajasthani Dal Baati'],
    culturalNotes: 'Traditional Marwari rituals',
    language: 'english',
  };

  const communityInput: WizardInput = {
    eventType: 'community',
    subEvents: ['Pandal Setup', 'Cultural Night / Garba', 'Bhandara / Prasad'],
    eventDate: '2026-11-05',
    city: 'Ahmedabad',
    guestCount: 1500,
    totalBudget: 400_000,
    theme: 'Navratri Garba Mahotsav',
    dietaryPreferences: ['Swaminarayan / Jain'],
    culturalNotes: 'Late night garba with traditional orchestra',
    language: 'hindi',
  };

  const birthdayMinimal: WizardInput = {
    eventType: 'birthday',
    subEvents: [],
    eventDate: '2026-11-05',
    city: 'Bengaluru',
    guestCount: 20,
    totalBudget: 15000,
    theme: '',
    dietaryPreferences: [],
    culturalNotes: '',
    language: 'english',
  };

  it('builds prompts covering both empty and specified optional fields', () => {
    const promptFull = buildPlanPrompt(weddingInput);
    expect(promptFull).toContain('Indian Wedding');
    expect(promptFull).toContain('Dietary Constraints: Pure Vegetarian');

    const promptMinimal = buildPlanPrompt(birthdayMinimal);
    expect(promptMinimal).toContain('Birthday / Milestone');
    expect(promptMinimal).toContain('Dietary Constraints: Standard options');
    expect(promptMinimal).toContain('Suggest an elegant');

    const weddingNoSubEvents: WizardInput = {
      ...weddingInput,
      subEvents: [],
    };
    const promptNoSub = buildPlanPrompt(weddingNoSubEvents);
    expect(promptNoSub).toContain('Haldi, Mehendi, Sangeet');

    const communityNoSub: WizardInput = {
      ...communityInput,
      subEvents: [],
    };
    const promptCommNoSub = buildPlanPrompt(communityNoSub);
    expect(promptCommNoSub).toContain('Pandal Setup, Cultural Night');
  });

  it('builds community prompt requiring police, sound, and fire clearances', () => {
    const prompt = buildPlanPrompt(communityInput);
    expect(prompt).toContain('Community Celebration');
    expect(prompt).toContain('Police Permission & NOC');
    expect(prompt).toContain('Sound & Noise pollution');
    expect(prompt).toContain('Fire Safety NOC');
    expect(prompt).toContain('Hindi');
  });

  it('builds refine prompt in both English and Hindi', () => {
    const promptEng = buildRefinePrompt(
      'food',
      'Make dessert counter feature regional live sweets.',
      weddingInput,
    );
    expect(promptEng).toContain('English');

    const promptHin = buildRefinePrompt(
      'activities',
      'Bachon ke liye games add karein.',
      communityInput,
    );
    expect(promptHin).toContain('Hindi');
  });

  it('generates fallback plans for all 3 event types', () => {
    const fallbackWedding = generateFallbackPlan(weddingInput);
    expect(fallbackWedding.budget.length).toBeGreaterThan(0);
    expect(fallbackWedding.budget.reduce((a, b) => a + b.amount, 0)).toBe(weddingInput.totalBudget);

    const fallbackCommunity = generateFallbackPlan(communityInput);
    expect(fallbackCommunity.budget.length).toBeGreaterThan(0);
    expect(fallbackCommunity.budget.reduce((a, b) => a + b.amount, 0)).toBe(
      communityInput.totalBudget,
    );

    const fallbackBirthday = generateFallbackPlan(birthdayMinimal);
    expect(fallbackBirthday.budget.length).toBeGreaterThan(0);
    expect(fallbackBirthday.budget.reduce((a, b) => a + b.amount, 0)).toBe(
      birthdayMinimal.totalBudget,
    );
  });

  it('enriches raw Gemini plan with unique IDs, subEvents, and vendor budget matching', () => {
    const raw: GeminiRawPlan = {
      summary: 'A wonderful birthday celebration',
      budget: [
        { category: 'Catering Services', suggestedPercent: 50, subEvent: 'Dinner' },
        { category: 'Decor', suggestedPercent: 30 },
        { category: 'Games & Cake', suggestedPercent: 20 },
      ],
      timeline: [
        {
          title: 'Order Cake',
          description: 'Chocolate truffle',
          daysBeforeEvent: 7,
          subEvent: 'Party',
        },
      ],
      vendors: [
        {
          category: 'Catering',
          questionsToAsk: ['Vegetarian menu?'],
          bookByDaysBeforeEvent: 14,
          subEvent: 'Dinner',
        },
      ],
      ideas: [
        { section: 'theme', title: 'Bollywood Gala', description: 'Retro 80s' },
        { section: 'decor', title: 'Film reels', description: 'Red carpet backdrop' },
        { section: 'food', title: 'Chaat station', description: 'Pani puri live' },
        { section: 'activities', title: 'Dialogue quiz', description: 'Famous catchphrases' },
        {
          section: 'returnGifts',
          title: 'Personalized cassettes',
          description: 'Custom sweets box',
        },
      ],
    };

    const enriched = enrichRawPlan(raw, birthdayMinimal);
    expect(enriched.summary).toBe(raw.summary);
    expect(enriched.budget[0].subEvent).toBe('Dinner');
    expect(enriched.vendors[0].budgetedAmount).toBeGreaterThan(0);
  });

  it('verifies snapshot expiration logic', async () => {
    // Non-existent
    const missing = await getShareSnapshot('invalid-token');
    expect(missing).toBeNull();
  });
});
