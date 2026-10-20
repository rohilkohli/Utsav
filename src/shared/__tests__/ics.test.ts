import { describe, it, expect } from 'vitest';
import { generateICS, createGoogleCalendarUrl } from '../ics.js';

describe('Calendar Export - RFC 5545 & Google Calendar', () => {
  it('generates valid RFC 5545 ICS format with CRLF endings and escaped text', () => {
    const events = [
      {
        title: 'Sangeet & Dance; Rehearsal, Fun',
        description: 'Practice performances, stage setup & sound.\nWear comfortable shoes!',
        dateStr: '2026-11-15',
        location: 'Grand Ballroom, Hotel Taj, Mumbai',
      },
    ];

    const ics = generateICS(events);

    // RFC 5545 requires CRLF line terminators (\r\n)
    expect(ics).toContain('\r\n');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);

    // Escaped characters check
    expect(ics).toContain('Dance\\; Rehearsal\\, Fun');
    expect(ics).toContain('Wear comfortable shoes!');

    // All-day DTSTART and exclusive DTEND check
    expect(ics).toContain('DTSTART;VALUE=DATE:20261115');
    expect(ics).toContain('DTEND;VALUE=DATE:20261116'); // next day
    expect(ics).toContain('LOCATION:Grand Ballroom\\, Hotel Taj\\, Mumbai');
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it('generates an accurate Google Calendar link with YYYYMMDD/YYYYMMDD exclusive end date', () => {
    const event = {
      title: 'Haldi Ceremony',
      description: 'Morning auspicious haldi ritual',
      dateStr: '2026-11-14',
      location: 'Banquet Hall, Jaipur',
    };

    const url = createGoogleCalendarUrl(event);
    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Haldi+Ceremony');
    // Start date 20261114, End date 20261115
    expect(url).toContain('dates=20261114%2F20261115');
    expect(url).toContain('location=Banquet+Hall%2C+Jaipur');
  });
});
