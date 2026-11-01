import { requireValue } from './invariants.js';
import { addDaysToDateOnly } from './timeline.js';

export interface CalendarEvent {
  title: string;
  description: string;
  dateStr: string; // YYYY-MM-DD
  effectiveDate?: string; // Delay-adjusted date, when scheduling has propagated delays
  location?: string;
}

/** Fold a content line to the RFC 5545 maximum of 75 UTF-8 octets. */
export function foldLine(line: string): string[] {
  const chunks: string[] = [];
  let chunk = '';
  let octets = 0;
  const encoder = new TextEncoder();
  for (const character of line) {
    const size = encoder.encode(character).length;
    const limit = 75;
    if (chunk && octets + size > limit) {
      chunks.push(chunk);
      chunk = ' ';
      octets = 1;
    }
    chunk += character;
    octets += size;
  }
  chunks.push(chunk);
  return chunks;
}

/**
 * Escapes characters for RFC 5545 ICS format:
 * \ -> \\, ; -> \;, , -> \,, \n -> \n
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Converts a YYYY-MM-DD date string to YYYYMMDD for all-day iCalendar DTSTART
 */
function toICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (const character of value)
    hash = Math.imul(hash ^ requireValue(character.codePointAt(0)), 16777619);
  return (hash >>> 0).toString(36);
}

/**
 * Generates an RFC 5545 compliant .ics file content string with CRLF endings.
 */
export function generateICS(events: CalendarEvent[], timestamp = '2000-01-01T00:00:00Z'): string {
  const now = timestamp.replace(/[-:]/g, '').slice(0, 15) + 'Z';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Utsav//India Celebration Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const [i, e] of events.entries()) {
    const uid = `utsav-${i}-${toICSDate(e.dateStr)}-${stableId(e.title + e.description)}@utsav.app`;
    const eventDate = e.effectiveDate ?? e.dateStr;
    const startDate = toICSDate(eventDate);
    // All-day events in RFC 5545 specify DTEND as the next day (exclusive)
    const nextDay = addDaysToDateOnly(eventDate, 1);
    const endDate = toICSDate(nextDay);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      `SUMMARY:${escapeICS(e.title)}`,
      `DESCRIPTION:${escapeICS(e.description)}`,
    );

    if (e.location) {
      lines.push(`LOCATION:${escapeICS(e.location)}`);
    }

    lines.push('STATUS:CONFIRMED', 'END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // RFC 5545 requires CRLF line terminators and folded content lines.
  return lines.flatMap(foldLine).join('\r\n') + '\r\n';
}

/**
 * Generates an "Add to Google Calendar" URL.
 * All-day events use YYYYMMDD/YYYYMMDD where the end date is exclusive (day + 1).
 */
export function createGoogleCalendarUrl(event: CalendarEvent): string {
  const eventDate = event.effectiveDate ?? event.dateStr;
  const startDate = toICSDate(eventDate);
  const nextDay = addDaysToDateOnly(eventDate, 1);
  const endDate = toICSDate(nextDay);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startDate}/${endDate}`,
    details: event.description,
  });

  if (event.location) {
    params.set('location', event.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
