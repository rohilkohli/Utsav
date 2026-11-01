import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planOutputSchema, wizardInputSchema } from '../../shared/schemas.js';
import { generateFallbackPlan } from '../services/fallback.js';
import { setModelTransport, type ModelRequest } from '../services/model.js';
import { parseIntake } from '../services/intakeService.js';
import { askPlanner } from '../services/advisorService.js';
import { explainTradeoffs } from '../services/tradeoffService.js';
import { extractQuote, parseQuoteText } from '../services/quoteService.js';

const today = '2026-11-01';
const input = wizardInputSchema.parse({
  eventType: 'birthday',
  eventDate: '2027-12-15',
  city: 'Mumbai',
  guestCount: 100,
  totalBudget: 50000,
});
const plan = planOutputSchema.parse(generateFallbackPlan(input));
const tradeoffs = {
  overBudgetAmount: 10000,
  options: [
    {
      label: 'Reduce decor',
      description: 'Keep catering unchanged',
      savings: 10000,
      newTotal: 50000,
    },
  ],
};

function respond(value: unknown, capture?: (request: ModelRequest) => void) {
  setModelTransport((request) => {
    capture?.(request);
    return Promise.resolve(
      (async function* () {
        await Promise.resolve();
        yield JSON.stringify(value);
      })(),
    );
  });
}

beforeEach(() => vi.stubEnv('GEMINI_API_KEY', 'your-gemini-api-key-here'));
afterEach(() => {
  setModelTransport();
  vi.unstubAllEnvs();
});

describe('Language services preserve deterministic fallbacks', () => {
  it('extracts intake locally and keeps deterministic money, count and dates', async () => {
    const result = await parseIntake(
      'Birthday in Mumbai, 100 guests, budget 50k, 15 December 2027',
      today,
    );
    expect(result.source).toBe('fallback');
    expect(result.input).toMatchObject({
      eventType: 'birthday',
      city: 'Mumbai',
      totalBudget: 50000,
      guestCount: 100,
    });
  });

  it('answers from live facts offline', async () => {
    const result = await askPlanner({ question: 'What is my budget?', input, plan }, today);
    expect(result.source).toBe('fallback');
    expect(result.answer).toContain('50,000');
  });

  it('explains exact savings offline and handles no options', async () => {
    const result = await explainTradeoffs(tradeoffs);
    expect(result.source).toBe('fallback');
    expect(result.explanation).toContain('10,000');
    expect((await explainTradeoffs({ overBudgetAmount: 0, options: [] })).explanation).toContain(
      'Review your allocations',
    );
  });

  it('returns explicit unknown quote fields offline', async () => {
    const result = await extractQuote('Please call us for prices');
    expect(result.source).toBe('fallback');
    expect(Object.values(result.quote).every((value) => value === null)).toBe(true);
  });
});

describe('Gemini-backed language synthesis', () => {
  beforeEach(() => vi.stubEnv('GEMINI_API_KEY', 'test-key'));

  it('enriches semantics without allowing a model to change deterministic numerical fields', async () => {
    respond(
      {
        eventType: 'wedding',
        city: 'जयपुर',
        subEvents: ['Haldi'],
        theme: 'Marigolds',
        dietaryPreferences: ['Pure Vegetarian'],
        culturalNotes: 'Rajasthani rituals',
        language: 'hindi',
      },
      (request) => {
        expect(request.prompt).toContain('<user_text>');
        expect(request.prompt).toContain('Do not calculate money');
        expect(request.jsonSchema).toHaveProperty('properties');
      },
    );
    const result = await parseIntake(
      'Wedding in Jaipur, 300 guests, budget 25 lakh, 15 December 2027',
      today,
    );
    expect(result).toMatchObject({
      source: 'gemini',
      input: {
        eventType: 'wedding',
        city: 'जयपुर',
        subEvents: ['Haldi'],
        totalBudget: 2500000,
        guestCount: 300,
        eventDate: '2027-12-15',
        language: 'hindi',
      },
    });
    expect('model' in result && typeof result.model).toBe('string');
  });

  it.each([
    ['birthday', [], []],
    ['wedding', [], ['Wedding Ceremony']],
    ['community', ['Cultural Night / Garba'], ['Cultural Night / Garba']],
  ])('keeps valid ceremony defaults for %s', async (eventType, subEvents, expected) => {
    respond({
      eventType,
      city: null,
      subEvents,
      theme: null,
      dietaryPreferences: null,
      culturalNotes: null,
      language: null,
    });
    const result = await parseIntake('Birthday in Mumbai, 100 guests, budget 50k', today);
    expect(result.input.subEvents).toEqual(expected);
  });

  it('preserves parsed ceremonies when the model leaves ceremonies unstated', async () => {
    respond({
      eventType: null,
      city: null,
      subEvents: null,
      theme: null,
      dietaryPreferences: null,
      culturalNotes: null,
      language: null,
    });
    const result = await parseIntake('Wedding in Jaipur, Haldi, 300 guests, budget 25 lakh', today);
    expect(result.input.subEvents).toContain('Haldi');
  });

  it('supplies a community stage when language changes an ambiguous event type', async () => {
    respond({
      eventType: 'community',
      city: null,
      subEvents: [],
      theme: null,
      dietaryPreferences: null,
      culturalNotes: null,
      language: null,
    });
    const result = await parseIntake('Birthday in Mumbai, 100 guests, budget 50k', today);
    expect(result.input.subEvents).toEqual(['Cultural Night / Garba']);
  });

  it.each([
    ['How much budget remains?', 'english', 'clear English'],
    ['Kitna kharcha hai?', 'english', 'natural Hinglish'],
    ['कितना खर्च हुआ?', 'english', 'Hindi in Devanagari'],
    ['What is next?', 'hindi', 'Hindi in Devanagari'],
  ] as const)('grounds %s with the requested language', async (question, language, expected) => {
    respond({ answer: 'Use the confirmed plan budget.' }, (request) => {
      expect(request.prompt).toContain(expected);
      expect(request.prompt).toContain('LIVE FACTS: <user_text>');
      expect(request.prompt).toContain(`QUESTION: <user_text>\n${question}\n</user_text>`);
    });
    expect(
      await askPlanner({ question, plan, input: { ...input, language } }, today),
    ).toMatchObject({ source: 'gemini', answer: 'Use the confirmed plan budget.' });
  });

  it('wraps untrusted option labels and descriptions before synthesis', async () => {
    respond({ explanation: 'Reduce decor while keeping food unchanged.' }, (request) => {
      expect(request.prompt).toContain('OPTIONS: <user_text>');
      expect(request.prompt).toContain('Copy amounts exactly');
    });
    expect(await explainTradeoffs(tradeoffs)).toMatchObject({
      source: 'gemini',
      explanation: 'Reduce decor while keeping food unchanged.',
    });
  });

  it('extracts only stated quote facts through a structured model schema', async () => {
    const quote = parseQuoteText('Vendor: Saffron Events; Total ₹40,000; GST extra', 'Decor');
    respond(quote, (request) => {
      expect(request.prompt).toContain('QUOTATION: <user_text>');
      expect(request.prompt).toContain('never multiply plates');
    });
    expect(
      await extractQuote('Vendor: Saffron Events; Total ₹40,000; GST extra', 'Decor'),
    ).toMatchObject({ source: 'gemini', quote });
  });
});

describe('Conservative quote parsing', () => {
  it('distinguishes total, plate rate, minimum, tax, advance and terms', () => {
    const quote = parseQuoteText(
      'Vendor: Saffron Events; Category: Catering; Total ₹1,25,000; ₹500 per plate; minimum 250 guests; GST extra; 60% advance; overtime ₹1500/hr; cancellation non-refundable',
    );
    expect(quote).toEqual({
      vendorName: 'Saffron Events',
      category: 'Catering',
      totalPrice: 125000,
      pricePerPlate: 500,
      guestMinimum: 250,
      taxIncluded: false,
      advancePercent: 60,
      overtimeFee: 'overtime ₹1500/hr',
      cancellationPolicy: 'cancellation non-refundable',
    });
  });

  it('never mistakes per-plate, overtime or advance amounts for quoted totals', () => {
    expect(parseQuoteText('₹800/plate, advance ₹5000; overtime ₹1000/hr')).toMatchObject({
      totalPrice: null,
      pricePerPlate: 800,
      advancePercent: null,
    });
    expect(parseQuoteText('per plate: ₹800; deposit ₹5000')).toMatchObject({
      totalPrice: null,
      pricePerPlate: 800,
    });
  });

  it('supports labeled plain money and Indian units', () => {
    expect(parseQuoteText('Package price 2 lakh; taxes included; advance 25%')).toMatchObject({
      totalPrice: 200000,
      taxIncluded: true,
      advancePercent: 25,
    });
    expect(parseQuoteText('Rs. 45k; inclusive of GST')).toMatchObject({
      totalPrice: 45000,
      taxIncluded: true,
    });
    expect(parseQuoteText('plate rate Rs. 900, min 100 plates')).toMatchObject({
      pricePerPlate: 900,
      guestMinimum: 100,
    });
    expect(parseQuoteText('Total 0, tax excluded; 0% deposit')).toMatchObject({
      totalPrice: 0,
      taxIncluded: false,
      advancePercent: 0,
    });
  });

  it('keeps ambiguous tax, vendor and invalid bounds unknown', () => {
    expect(parseQuoteText('Catering ₹45000, GST 18%')).toMatchObject({
      totalPrice: 45000,
      vendorName: null,
      taxIncluded: null,
    });
    expect(
      parseQuoteText('minimum 999999 guests, advance 150%, total ₹999999999999999999999'),
    ).toMatchObject({ totalPrice: null, guestMinimum: null, advancePercent: null });
  });
});
