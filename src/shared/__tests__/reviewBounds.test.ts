import { expect, it } from 'vitest';
import { planReviewSchema, planReviewResponseSchema } from '../schemas.js';

const review = {
  strengths: ['Clear plan'],
  risks: ['Confirm bookings'],
  suggestions: ['Compare quotes'],
  overallScore: 8,
};
it('accepts concise executive reviews with up to six items per section', () => {
  for (const section of ['strengths', 'risks', 'suggestions'] as const) {
    const populated = {
      ...review,
      [section]: Array.from({ length: 6 }, (_, index) => `Item ${index + 1}`),
    };
    expect(
      planReviewResponseSchema.safeParse({ review: populated, meta: { source: 'gemini' } }).success,
    ).toBe(true);
  }
});
it('rejects empty or oversized executive sections and invalid scores at the shared boundary', () => {
  for (const section of ['strengths', 'risks', 'suggestions'] as const) {
    expect(planReviewSchema.safeParse({ ...review, [section]: [] }).success).toBe(false);
    expect(
      planReviewSchema.safeParse({
        ...review,
        [section]: Array.from({ length: 7 }, () => 'Overflow'),
      }).success,
    ).toBe(false);
  }
  for (const overallScore of [0, 11, 4.5])
    expect(planReviewSchema.safeParse({ ...review, overallScore }).success).toBe(false);
});
