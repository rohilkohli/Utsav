import { describe, expect, it } from 'vitest';
import { parseEventDescription } from '../intake.js';
import { parseINR } from '../currency.js';
import { foldLine, generateICS, createGoogleCalendarUrl } from '../ics.js';
import { getRunSheet } from '../runsheet.js';
import { EVENT_TYPES } from '../schemas.js';

describe('natural Indian intake', () => {
  const today = '2030-01-01';
  it('understands the example description including month-first dates and suffix budget', () => {
    const result = parseEventDescription(
      'Wedding in Jaipur, 300 guests, 25 lakh budget, Dec 15, Haldi + Sangeet + Wedding, pure veg, royal marigold theme',
      today,
    );
    expect(result).toMatchObject({
      eventType: 'wedding',
      city: 'Jaipur',
      guestCount: 300,
      totalBudget: 2500000,
      eventDate: '2030-12-15',
      theme: 'royal marigold',
      dietaryPreferences: ['Pure Vegetarian'],
    });
    expect(result.subEvents).toEqual(
      expect.arrayContaining(['Haldi', 'Sangeet', 'Wedding Ceremony']),
    );
  });
  it('parses date variants, rolls missing years forward and rejects invalid calendar dates', () => {
    expect(parseEventDescription('Birthday 15 March 2031 budget: 45k', today)).toMatchObject({
      eventDate: '2031-03-15',
      totalBudget: 45000,
      subEvents: [],
    });
    expect(parseEventDescription('community on 2030-04-01, budget is 2 cr', today)).toMatchObject({
      eventDate: '2030-04-01',
      totalBudget: 20000000,
      subEvents: ['Cultural Night / Garba'],
    });
    expect(parseEventDescription('Birthday Dec 15', '2030-12-20').eventDate).toBe('2031-12-15');
    expect(parseEventDescription('Birthday Feb 31', today).eventDate).toBe('2030-03-02');
    expect(parseEventDescription('Birthday 15 March 2020', today).eventDate).toBe('2030-03-02');
    expect(parseEventDescription('Birthday on 2030-99-99', today).eventDate).toBe('2030-03-02');
    expect(parseEventDescription('Birthday 999999 people budget 10000 crore', today)).toMatchObject(
      { guestCount: 10000, totalBudget: 1000000000 },
    );
  });
  it('returns supported defaults, ceremonies, explicit theme and Hindi preference', () => {
    expect(parseEventDescription('', today)).toMatchObject({
      totalBudget: 2500000,
      guestCount: 100,
      city: 'Jaipur',
      subEvents: ['Wedding Ceremony'],
    });
    expect(parseEventDescription('Birthday theme: marigold, हिंदी', today)).toMatchObject({
      theme: 'marigold',
      language: 'hindi',
      totalBudget: 50000,
    });
    expect(parseEventDescription('Ganesh festival Pandal, Prasad', today)).toMatchObject({
      eventType: 'community',
      totalBudget: 300000,
      subEvents: ['Pandal Setup'],
    });
    for (const type of EVENT_TYPES) expect(getRunSheet(type).blocks.length).toBeGreaterThan(5);
  });
});

describe('currency edge cases', () => {
  it.each([
    ['8 lakh', 800000],
    ['8L', 800000],
    ['8,00,000', 800000],
    ['₹800000', 800000],
    ['8.5 lac', 850000],
    ['2 crore', 20000000],
    ['45k', 45000],
    ['Rs. 20,000', 20000],
    ['INR 0', 0],
    ['1.5 crores', 15000000],
  ])('parses %s', (text, amount) => {
    expect(parseINR(text)).toBe(amount);
  });
  it.each([
    '',
    '-1',
    '5 bananas',
    '1,,000',
    '1,00',
    '99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999',
  ])('rejects malformed amount %s', (text) => {
    expect(parseINR(text)).toBeNull();
  });
});

describe('calendar folding and effective dates', () => {
  it('folds multibyte text by octets without breaking Unicode and restores original text', () => {
    const text = 'DESCRIPTION:' + 'उत्सव 🎉 '.repeat(60);
    const lines = foldLine(text);
    expect(
      lines.map((line) => new TextEncoder().encode(line).length).every((size) => size <= 75),
    ).toBe(true);
    expect(lines.join('\r\n').replace(/\r\n /g, '')).toBe(text);
    expect(foldLine('')).toEqual(['']);
  });
  it('uses deterministic IDs and adjusted dates for export and Google Calendar', () => {
    const event = {
      title: 'हल्दी',
      description: 'a,b;c\\d\nnext',
      dateStr: '2030-01-01',
      effectiveDate: '2030-01-03',
      location: 'Jaipur',
    };
    const content = generateICS([event], '2030-01-01T10:30:00Z');
    expect(content).toContain('DTSTART;VALUE=DATE:20300103');
    expect(content).toContain('DTEND;VALUE=DATE:20300104');
    expect(content).toContain('DTSTAMP:20300101T103000Z');
    expect(content).toContain('LOCATION:Jaipur');
    expect(generateICS([event])).toBe(generateICS([event]));
    expect(createGoogleCalendarUrl(event)).toContain('20300103%2F20300104');
  });
});

it('accepts sentence punctuation after the intake budget without using a default', () => {
  const input = parseEventDescription(
    'Birthday in Mumbai, 45 guests, budget 40000, theme marigold',
    '2030-01-01',
  );
  expect(input.totalBudget).toBe(40000);
  expect(input.city).toBe('Mumbai');
  expect(input.guestCount).toBe(45);
});
