import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateEventPlan } from '../services/planService.js';
import { reviewPlan, buildHeuristicReview } from '../services/reviewService.js';
import { refineIdeasSection } from '../services/refineService.js';
import { generateFallbackPlan } from '../services/fallback.js';
import { AiResponseInvalidError, setModelTransport } from '../services/model.js';
import { wizardInputSchema } from '../../shared/schemas.js';

let sequence = 0;
const input = () =>
  wizardInputSchema.parse({
    eventType: 'birthday',
    eventDate: '2099-12-15',
    city: `Jaipur${String(sequence++)}`,
    guestCount: 45,
    totalBudget: 40000,
  });
async function* json(value: unknown) {
  yield await Promise.resolve(JSON.stringify(value));
}
beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  setModelTransport();
});
afterEach(() => {
  setModelTransport();
  vi.unstubAllEnvs();
});

describe('Creative plan generation with deterministic facts', () => {
  it('keeps every rupee/date/category/task deterministic while adding validated language', async () => {
    const details = input();
    const preset = generateFallbackPlan(details);
    const task = preset.timeline[0];
    const vendor = preset.vendors[0];
    const creative = {
      summary: 'A delightful celebration',
      ideas: preset.ideas.map(({ id: _id, ...idea }) => idea),
      taskDescriptions: [{ task: task?.title, description: 'Creative task guidance' }],
      vendorQuestions: [
        {
          category: vendor?.category,
          questions: ['Is GST included?', 'What is your cancellation policy?'],
        },
      ],
    };
    setModelTransport(() => Promise.resolve(json(creative)));
    const generated = await generateEventPlan(details);
    expect(generated.source).toBe('gemini');
    expect(generated.plan.summary).toBe(creative.summary);
    expect(generated.plan.budget.map((category) => category.amount)).toEqual(
      preset.budget.map((category) => category.amount),
    );
    expect(generated.plan.timeline.map((milestone) => milestone.date)).toEqual(
      preset.timeline.map((milestone) => milestone.date),
    );
    expect(generated.plan.timeline[0]?.description).toBe('Creative task guidance');
    expect(generated.plan.vendors[0]?.questionsToAsk).toEqual(
      creative.vendorQuestions[0]?.questions,
    );
    expect((await generateEventPlan(details)).source).toBe('cache');
  });
  it('returns the complete deterministic plan when no key is configured', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const generated = await generateEventPlan(input());
    expect(generated.source).toBe('fallback');
    expect(generated.plan.ideas.length).toBeGreaterThanOrEqual(5);
    expect(generated.plan.budget.some((category) => /contingency/i.test(category.category))).toBe(
      true,
    );
  });
  it('rejects malformed creative output rather than exposing it', async () => {
    setModelTransport(() => Promise.resolve(json({ summary: 'invalid' })));
    await expect(generateEventPlan(input())).rejects.toBeInstanceOf(AiResponseInvalidError);
  });
});

describe('Structured reviews and section refinement', () => {
  it('reviews with Gemini and wraps all text and trusted facts', async () => {
    const details = input();
    const plan = generateFallbackPlan(details);
    const review = buildHeuristicReview(plan, details);
    let prompt = '';
    setModelTransport((request) => {
      prompt = request.prompt;
      return Promise.resolve(json(review));
    });
    const result = await reviewPlan(plan, details);
    expect(result.source).toBe('gemini');
    expect(result.review).toEqual(review);
    expect(prompt).toContain('<user_text>');
    expect(prompt).toContain('do not recalculate');
  });
  it('builds localized reviews with overdue spending and vendor warnings', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const details = input();
    const plan = generateFallbackPlan(details);
    plan.budget = plan.budget.map((category) => ({ ...category, actual: 100000 }));
    expect((await reviewPlan(plan, details)).review.overallScore).toBe(6);
    expect(buildHeuristicReview(plan, { ...details, language: 'hindi' }).risks.join(' ')).toMatch(
      /[\u0900-\u097f]/,
    );
    const completed = {
      ...plan,
      timeline: plan.timeline.map((task) => ({ ...task, completed: true })),
      vendors: [],
    };
    expect(buildHeuristicReview(completed, details).strengths.join(' ')).toContain('completed');
    expect(
      buildHeuristicReview(completed, { ...details, language: 'hindi' }).strengths.join(' '),
    ).toContain('पूरे');
  });
  it('supports both fully booked and uncontacted healthy plans', () => {
    const details = input();
    const plan = generateFallbackPlan(details);
    expect(buildHeuristicReview(plan, details).overallScore).toBe(7);
    const booked = {
      ...plan,
      vendors: plan.vendors.map((vendor) => ({ ...vendor, status: 'booked' as const })),
    };
    expect(buildHeuristicReview(booked, details).overallScore).toBe(8);
    expect(buildHeuristicReview(booked, { ...details, language: 'hindi' }).overallScore).toBe(8);
  });
  it('refines only the requested section with generated identifiers', async () => {
    const details = input();
    const idea = {
      section: 'food',
      title: 'Regional sweets',
      description: 'Serve a seasonal dessert bar',
    };
    setModelTransport(() => Promise.resolve(json({ ideas: [idea] })));
    const result = await refineIdeasSection('food', 'Regional cuisine', details, []);
    expect(result.source).toBe('gemini');
    expect(result.ideas[0]?.id).toBeTruthy();
  });
  it('returns current ideas offline and rejects unrelated valid sections', async () => {
    const details = input();
    const ideas = generateFallbackPlan(details).ideas;
    vi.stubEnv('GEMINI_API_KEY', '');
    expect((await refineIdeasSection('food', 'Regional cuisine', details, ideas)).ideas).toEqual(
      ideas,
    );
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    setModelTransport(() =>
      Promise.resolve(
        json({
          ideas: [{ section: 'decor', title: 'Lanterns', description: 'Hang paper lanterns' }],
        }),
      ),
    );
    await expect(refineIdeasSection('food', 'Regional cuisine', details, ideas)).rejects.toThrow(
      'AI_RESPONSE_INVALID',
    );
  });
  it('localizes healthy incomplete and over-budget completed review branches', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const details = { ...input(), language: 'hindi' as const };
    const plan = generateFallbackPlan(details);
    expect(buildHeuristicReview(plan, details).risks.join(' ')).toContain('संतुलित');
    expect(buildHeuristicReview(plan, details).overallScore).toBe(7);
    const completed = {
      ...plan,
      timeline: plan.timeline.map((task) => ({ ...task, completed: true })),
    };
    expect(
      buildHeuristicReview(completed, { ...details, language: 'english' }).strengths.join(' '),
    ).toContain('completed');
    setModelTransport(() => Promise.resolve(json(buildHeuristicReview(plan, details))));
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    expect((await reviewPlan(plan, details)).source).toBe('gemini');
  });
});
