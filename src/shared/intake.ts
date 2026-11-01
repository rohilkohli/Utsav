import type { EventType, WizardInput } from './schemas.js';
import { COMMUNITY_SUB_EVENTS, WEDDING_SUB_EVENTS } from './schemas.js';
import { parseINR } from './currency.js';
import { addDaysToDateOnly } from './dateMath.js';

const months = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const monthPattern = months.map((month) => `${month.slice(0, 3)}(?:${month.slice(3)})?`).join('|');
function parseDate(text: string, today: string): string {
  const iso = /\b\d{4}-\d{2}-\d{2}\b/.exec(text)?.[0];
  const dayFirst = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})(?:\\s+(\\d{4}))?`,
    'i',
  ).exec(text);
  const monthFirst = new RegExp(
    `\\b(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`,
    'i',
  ).exec(text);
  const day = dayFirst?.[1] ?? monthFirst?.[2];
  const monthName = dayFirst?.[2] ?? monthFirst?.[1];
  const explicitYear = dayFirst?.[3] ?? monthFirst?.[3];
  const year = Number(explicitYear ?? today.slice(0, 4));
  const month = monthName
    ? months.findIndex((entry) => entry.startsWith(monthName.toLowerCase())) + 1
    : 0;
  let date =
    iso ??
    (day && month
      ? `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`
      : addDaysToDateOnly(today, 60));
  if (date < today && !iso && !explicitYear) date = `${year + 1}-${date.slice(5)}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date &&
    date >= today
    ? date
    : addDaysToDateOnly(today, 60);
}
function detectEventType(text: string): EventType {
  if (/birthday|anniversary|party|जन्मदिन/i.test(text)) return 'birthday';
  if (/community|festival|mela|garba|diwali|ganesh|त्योहार/i.test(text)) return 'community';
  return 'wedding';
}

export function parseEventDescription(description: string, today: string): WizardInput {
  const text = description.trim();
  const eventType = detectEventType(text);
  const guestMatch = /([\d,]+)\s*(?:guests?|people|mehm[aā]n|मेहमान)/i.exec(text);
  const amount = '(\\d[\\d,.]*\\s*(?:crores?|cr|lakhs?|lacs?|l|k)?)';
  const budgetMatch =
    new RegExp(`(?:budget|₹|rs\\.?)\\s*(?:of|is|:)?\\s*${amount}`, 'i').exec(text) ??
    new RegExp(`${amount}\\s+budget`, 'i').exec(text);
  const cityMatch = /\bin\s+([A-Za-z][A-Za-z .'-]+?)(?=,|\s+\d|\s+(?:guests?|people)|$)/i.exec(
    text,
  );
  const themeMatch =
    /theme\s*(?:is|:|-)\s*([^,]+)/i.exec(text) ?? /([^,]+?)\s+theme(?:,|$)/i.exec(text);
  const choices = eventType === 'wedding' ? WEDDING_SUB_EVENTS : COMMUNITY_SUB_EVENTS;
  const subEvents = choices.filter((name) =>
    text.toLowerCase().includes(name.replace(/[\s/&].*$/, '').toLowerCase()),
  );
  const parsedBudget = budgetMatch?.[1]
    ? parseINR(budgetMatch[1].trim().replace(/[,.]+$/, ''))
    : null;
  const guestCount = guestMatch?.[1] ? Number(guestMatch[1].replace(/,/g, '')) : 100;
  return {
    eventType,
    subEvents:
      eventType === 'birthday'
        ? []
        : subEvents.length > 0
          ? subEvents
          : eventType === 'wedding'
            ? ['Wedding Ceremony']
            : ['Cultural Night / Garba'],
    eventDate: parseDate(text, today),
    city: cityMatch?.[1]?.trim().slice(0, 100) ?? 'Jaipur',
    guestCount: Math.min(10000, guestCount),
    totalBudget: Math.min(
      1_000_000_000,
      parsedBudget ??
        (eventType === 'wedding' ? 2_500_000 : eventType === 'community' ? 300_000 : 50_000),
    ),
    theme: themeMatch?.[1]?.trim().slice(0, 300) ?? '',
    dietaryPreferences: /pure\s*veg|vegetarian|शाकाहारी/i.test(text) ? ['Pure Vegetarian'] : [],
    culturalNotes: '',
    language: /hindi|हिंदी|देवनागरी/i.test(text) ? 'hindi' : 'english',
  };
}
