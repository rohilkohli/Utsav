import { addDaysToDateOnly } from './timeline.js';

export interface CalendarEvent {
  title: string;
  description: string;
  dateStr: string; // YYYY-MM-DD
  location?: string;
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

/**
 * Generates an RFC 5545 compliant .ics file content string with CRLF endings.
 */
export function generateICS(events: CalendarEvent[]): string {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .slice(0, 15) + 'Z';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Utsav//India Celebration Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const uid = `utsav-${i}-${toICSDate(e.dateStr)}-${Math.random().toString(36).slice(2, 8)}@utsav.app`;
    const startDate = toICSDate(e.dateStr);
    // All-day events in RFC 5545 specify DTEND as the next day (exclusive)
    const nextDay = addDaysToDateOnly(e.dateStr, 1);
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

  // RFC 5545 requires CRLF line terminators
  return lines.join('\r\n') + '\r\n';
}

/**
 * Generates an "Add to Google Calendar" URL.
 * All-day events use YYYYMMDD/YYYYMMDD where the end date is exclusive (day + 1).
 */
export function createGoogleCalendarUrl(event: CalendarEvent): string {
  const startDate = toICSDate(event.dateStr);
  const nextDay = addDaysToDateOnly(event.dateStr, 1);
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
