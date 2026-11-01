import { describe, expect, it } from 'vitest';
import { localAnswer, planFacts } from '../advisor.js';
import { planInsights } from '../insights.js';
import { plan, input, task, category, quote, vendor, today } from './fixtures.js';

describe('live planning facts and bilingual answers', () => {
  it('answers every supported English and Hinglish topic from live facts', () => {
    const current = plan({
      perPlate: 200,
      budget: [category('Food', 20000)],
      timeline: [task('last', 1), { ...task('done', 20), status: 'done' }, task('first', 10)],
    });
    expect(planFacts(current, input, today)).toMatchObject({
      nextTask: 'first',
      nextTaskDate: '2030-01-22',
      requiredCatering: 20000,
    });
    for (const query of ['budget', 'kharcha', 'paisa'])
      expect(localAnswer(query, current, input, today)).toContain('₹1,00,000');
    expect(localAnswer('caterer', current, input, today)).toContain('1 vendor');
    expect(localAnswer('kya kare', current, input, today)).toContain('first');
    expect(localAnswer('kab', current, input, today)).toContain('31 days');
    expect(localAnswer('mehman', current, input, today)).toContain('100 guests');
    expect(localAnswer('mehman', current, input, today)).toContain('₹20,000');
    expect(localAnswer('something else', current, input, today)).toContain('live plan');
    expect(localAnswer('budget', current, { ...input, totalBudget: 50 }, today)).toContain(
      '₹19,950 is over budget',
    );
    expect(localAnswer('when', current, { ...input, eventDate: '2029-01-01' }, today)).toContain(
      'passed',
    );
    expect(localAnswer('next', plan({ timeline: [] }), input, today)).toContain('complete');
  });
  it('uses current catering actuals for manual estimates and fixed quotations', () => {
    const current = plan({
      perPlate: 200,
      budget: [
        { ...category('Food', 100), actual: 500 },
        { ...category('Catering', 100), actual: 1200, verified: true },
        category('Prasad', 300),
        category('Venue', 5000),
      ],
    });
    expect(planFacts(current, input, today).requiredCatering).toBe(2000);
    expect(localAnswer('guests', current, input, today)).toContain('₹2,000');
    expect(localAnswer('guests', current, input, today)).not.toContain('per-plate rate');
    expect(planFacts(plan({ budget: [] }), input, today).requiredCatering).toBe(0);
  });
  it('answers Devanagari topics and honors Hindi output mode', () => {
    const current = plan();
    const hindi = { ...input, language: 'hindi' as const };
    expect(localAnswer('बजट', current, input, today)).toContain('आपका बजट');
    expect(localAnswer('budget', current, { ...hindi, totalBudget: 50 }, today)).toContain('अधिक');
    expect(localAnswer('विक्रेता', current, input, today)).toContain('1 विक्रेता');
    expect(localAnswer('अगला', current, input, today)).toContain('next');
    expect(localAnswer('अगला', plan({ timeline: [] }), hindi, today)).toContain('पूरे');
    expect(localAnswer('कब', current, input, today)).toContain('31 दिन');
    expect(localAnswer('कब', current, { ...hindi, eventDate: '2029-01-01' }, today)).toContain(
      'बीत',
    );
    expect(localAnswer('मेहमान', current, input, today)).toContain('100 मेहमान');
    expect(localAnswer('अन्य', current, hindi, today)).toContain('मदद');
    expect(
      planFacts(plan({ timeline: [task('broken', 1, ['missing'])] }), input, today).nextTask,
    ).toBeUndefined();
  });
});

describe('ranked plan insights', () => {
  it('ranks budget, schedule, accepted-quote, contingency and booking issues', () => {
    const current = plan({
      budget: [{ ...category('Food'), actual: 120000 }],
      timeline: [task('old', 40), { ...task('late', 1), delayDays: 4 }, task('next', 3)],
      vendors: [{ ...vendor, acceptedQuoteId: quote.id, quotes: [quote] }],
    });
    const insights = planInsights(current, input, today);
    expect(insights[0]?.severity).toBe('critical');
    expect(insights.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        'budget-overrun',
        'timeline-impossible',
        'timeline-overdue',
        'timeline-delay',
        'low-contingency',
        'quote-food',
        'vendor-food',
        'next-task',
      ]),
    );
    expect(
      planInsights(current, { ...input, totalBudget: 0 }, today).find(
        (entry) => entry.id === 'budget-overrun',
      )?.message,
    ).toContain('no budget allocated');
  });
  it('uses effective dates for next task, distinguishes overdue bookings and ignores completed work', () => {
    const current = plan({
      budget: [category('Contingency Buffer', 10000)],
      timeline: [
        { ...task('later', 7), delayDays: 2 },
        { ...task('first', 6), assignee: 'Family' },
        { ...task('done', 40), completed: true },
      ],
      vendors: [{ ...vendor, bookByDate: '2029-12-01' }],
    });
    const insights = planInsights(current, input, today);
    expect(insights.find((entry) => entry.id === 'next-task')?.message).toContain(
      'first by 2030-01-26 (Family)',
    );
    expect(insights.find((entry) => entry.id === 'vendor-food')?.message).toContain(
      'deadline passed',
    );
    expect(insights.some((entry) => entry.id === 'timeline-overdue')).toBe(false);
    expect(
      planInsights(plan({ timeline: [task('broken', 1, ['missing'])] }), input, today).some(
        (entry) => entry.id === 'timeline-invalid',
      ),
    ).toBe(true);
  });
  it('does not invent healthy-plan or distant vendor warnings', () => {
    const current = plan({
      budget: [category('Contingency Buffer', 10000)],
      timeline: [],
      vendors: [
        { ...vendor, status: 'booked' },
        { ...vendor, id: 'distant', bookByDate: '2030-06-01' },
      ],
    });
    expect(planInsights(current, { ...input, eventDate: '2031-01-01' }, today)).toEqual([]);
    const completeQuote = {
      ...quote,
      budgetedAmount: 500,
      taxIncluded: true,
      cancellationPolicy: 'Full refund',
      advancePercent: 30,
      guestMinimum: 0,
    };
    expect(
      planInsights(
        plan({
          budget: [],
          timeline: [],
          vendors: [
            {
              ...vendor,
              status: 'booked',
              budgetedAmount: 500,
              acceptedQuoteId: quote.id,
              quotes: [completeQuote],
            },
          ],
        }),
        { ...input, totalBudget: 0 },
        today,
      ),
    ).toEqual([]);
  });
});
