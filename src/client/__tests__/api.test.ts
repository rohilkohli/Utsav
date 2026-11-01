import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiAskPlanner,
  apiCreateShare,
  apiExplainTradeoffs,
  apiExtractQuote,
  apiGeneratePlan,
  apiGetPlan,
  apiGetSharedPlan,
  apiParseIntake,
  apiRefineSection,
  apiReviewPlan,
  apiSavePlan,
  apiSearchVendors,
  apiUpdatePlan,
  fetchRuntimeConfig,
} from '../lib/api';
import { input, plan, savedPlan } from './aiFixtures';

afterEach(() => vi.unstubAllGlobals());
function respond(data: unknown) {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(() => Promise.resolve(Response.json(data)));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

describe('validated client API boundaries', () => {
  it('validates runtime Firebase config without exposing unrelated fields', async () => {
    respond({
      firebase: { apiKey: 'public', authDomain: 'app.example', projectId: 'app' },
      private: 'hidden',
    });
    expect(await fetchRuntimeConfig()).toEqual({
      firebase: { apiKey: 'public', authDomain: 'app.example', projectId: 'app' },
    });
    respond({ firebase: { apiKey: 'partial' } });
    await expect(fetchRuntimeConfig()).rejects.toThrow('AI_RESPONSE_INVALID');
  });

  it('generates and refines schema-validated plans with optional authentication', async () => {
    const fetcher = respond({ plan, planId: 'plan-1', meta: { source: 'fallback' } });
    expect((await apiGeneratePlan(input, 'token')).plan.summary).toBe(plan.summary);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer token',
    );
    respond({ ideas: [], meta: { source: 'fallback' } });
    expect(await apiRefineSection('food', 'Vegetarian please', input, plan)).toEqual({
      ideas: [],
      meta: { source: 'fallback' },
    });
  });

  it('validates bilingual answers and plan reviews', async () => {
    respond({ answer: 'आपके पास ₹40,000 हैं।', source: 'gemini' });
    expect((await apiAskPlanner('Kitna paisa?', input, plan)).answer).toContain('₹40,000');
    const review = {
      strengths: ['Clear plan'],
      risks: ['Book soon'],
      suggestions: ['Confirm catering'],
      overallScore: 8,
    };
    respond({ review, meta: { source: 'fallback' } });
    expect(await apiReviewPlan(input, plan)).toEqual({ review, source: 'fallback' });
    respond({ review: { ...review, overallScore: 99 }, meta: { source: 'gemini' } });
    await expect(apiReviewPlan(input, plan)).rejects.toThrow('AI_RESPONSE_INVALID');
  });

  it('checks intake and tradeoff output instead of trusting remote JSON', async () => {
    respond({ input, source: 'fallback' });
    expect(await apiParseIntake('Birthday in Mumbai')).toEqual(input);
    respond({ explanation: 'Reduce decor by ₹2,000.', source: 'gemini' });
    expect(
      (
        await apiExplainTradeoffs(2000, [
          { label: 'Decor cut', description: 'Reduce decor', savings: 2000, newTotal: 40000 },
        ])
      ).source,
    ).toBe('gemini');
  });

  it('preserves missing quote information as null and rejects fabricated response shapes', async () => {
    const quote = {
      vendorName: null,
      category: null,
      totalPrice: 20000,
      pricePerPlate: null,
      guestMinimum: null,
      taxIncluded: null,
      advancePercent: null,
      overtimeFee: null,
      cancellationPolicy: null,
    };
    const fetcher = respond({ quote, source: 'fallback' });
    expect((await apiExtractQuote('Total ₹20,000', 'Catering')).quote).toEqual(quote);
    expect(fetcher).toHaveBeenCalledWith(
      '/api/extract-quote',
      expect.objectContaining({ body: '{"text":"Total ₹20,000","category":"Catering"}' }),
    );
    respond({ quote: { totalPrice: 'twenty thousand' }, source: 'gemini' });
    await expect(apiExtractQuote('Quote')).rejects.toThrow('AI_RESPONSE_INVALID');
  });

  it('validates share snapshots, authenticated saves and updates', async () => {
    respond({
      shareToken: 'abcd',
      shareUrl: 'https://utsav.example/share/abcd',
      expiresAt: '2099-01-01',
    });
    expect((await apiCreateShare(input, plan)).shareToken).toBe('abcd');
    respond(savedPlan);
    expect(await apiGetSharedPlan('a/b')).toEqual(savedPlan);
    const getter = respond(savedPlan);
    expect(await apiGetPlan('a/b', 'token')).toEqual(savedPlan);
    expect(getter.mock.calls[0]?.[0]).toBe('/api/plan/a%2Fb');
    respond({ success: true, plan: savedPlan });
    expect(await apiSavePlan(input, plan, 'token')).toEqual(savedPlan);
    const update = respond({ success: true, plan: savedPlan });
    await apiUpdatePlan(savedPlan);
    expect(update).toHaveBeenCalledWith(
      '/api/plan/plan-1',
      expect.objectContaining({ method: 'PUT' }),
    );
    respond({ shareToken: 'a', shareUrl: 'javascript:alert(1)' });
    await expect(apiCreateShare(input, plan)).rejects.toThrow('AI_RESPONSE_INVALID');
  });

  it('encodes snapshot identifiers and supports unauthenticated read attempts safely', async () => {
    const fetcher = respond(savedPlan);
    await apiGetSharedPlan('a/b');
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/share/a%2Fb');
    await apiGetPlan('plan-1');
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).has('Authorization')).toBe(false);
  });

  it('validates Places values and rejects unsafe vendor links', async () => {
    respond({
      suggestions: [
        {
          name: 'Caterer',
          rating: 4.5,
          mapsUrl: 'https://maps.google.com/place',
          website: 'https://vendor.example',
        },
      ],
    });
    expect(await apiSearchVendors('Catering', 'Mumbai', 'Haldi')).toHaveLength(1);
    respond({ suggestions: [{ name: 'Caterer', website: 'javascript:alert(1)' }] });
    await expect(apiSearchVendors('Catering', 'Mumbai')).rejects.toThrow('AI_RESPONSE_INVALID');
  });
});
