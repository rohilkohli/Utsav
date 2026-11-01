import type { EventType, WizardInput } from './schemas.js';
import { COMMUNITY_SUB_EVENTS, WEDDING_SUB_EVENTS } from './schemas.js';
import { parseINR } from './currency.js';
import { addDaysToDateOnly, diffInDays } from './timeline.js';

const monthNumbers: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseDate(text: string, today: string): string {
  const match = text.match(/\b(\d{1,2})\s*(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?/i);
  if (!match) return addDaysToDateOnly(today, 60);
  const year = Number(match[3] ?? today.slice(0, 4));
  const date = `${year}-${String(monthNumbers[match[2]!.toLowerCase()]).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`;
  return diffInDays(today, date) >= 0 ? date : `${year + 1}-${date.slice(5)}`;
}

function detectEventType(text: string): EventType {
  if (/birthday|anniversary|party/i.test(text)) return 'birthday';
  if (/community|festival|mela|garba|diwali|ganesh/i.test(text)) return 'community';
  return 'wedding';
}

export function parseEventDescription(description: string, today: string): WizardInput {
  const text = description.trim();
  const eventType = detectEventType(text);
  const guestMatch = text.match(/([\d,]+)\s*(?:guests?|people|mehm[aā]n)/i);
  const budgetMatch = text.match(/(?:budget|₹|rs\.?)[^\d]{0,8}([\d,.]+\s*(?:lakh|lac|crore|cr|k)?)/i);
  const cityMatch = text.match(/\bin\s+([A-Za-z][A-Za-z .'-]+?)(?=,|\s+\d|\s+(?:guests?|people)|$)/i);
  const themeMatch = text.match(/theme\s*(?:is|:|-)?\s*([^,]+)/i);
  const subEvents = (eventType === 'wedding' ? WEDDING_SUB_EVENTS : COMMUNITY_SUB_EVENTS)
    .filter((name) => new RegExp(name.split(/\s|[/&]/)[0] ?? name, 'i').test(text));
  const parsedBudget = budgetMatch ? parseINR(budgetMatch[1]!.trim()) : null;
  const guestCount = guestMatch ? Number(guestMatch[1]!.replace(/,/g, '')) : 100;
  return {
    eventType,
    subEvents: eventType === 'birthday' ? [] : subEvents.length > 0 ? subEvents : eventType === 'wedding' ? ['Wedding Ceremony'] : ['Cultural Night / Garba'],
    eventDate: parseDate(text, today),
    city: cityMatch?.[1]?.trim() || 'Jaipur',
    guestCount: Number.isFinite(guestCount) ? guestCount : 100,
    totalBudget: parsedBudget ?? (eventType === 'wedding' ? 2_500_000 : eventType === 'community' ? 300_000 : 50_000),
    theme: themeMatch?.[1]?.trim() || '',
    dietaryPreferences: /pure\s*veg|vegetarian/i.test(text) ? ['Pure Vegetarian'] : [],
    culturalNotes: '',
    language: /hindi|हिंदी|देवनागरी/i.test(text) ? 'hindi' : 'english',
  };
}
