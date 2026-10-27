import { getTodayInKolkata } from './schemas.js';

/**
 * Add or subtract days from an ISO date-only string (YYYY-MM-DD).
 * Deterministic UTC date math ensures no local timezone shifting.
 */
export function addDaysToDateOnly(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Compute the date for a milestone given the eventDate (YYYY-MM-DD) and daysBeforeEvent.
 * e.g. eventDate = "2026-11-15", daysBeforeEvent = 30 -> "2026-10-16"
 */
export function computeMilestoneDate(eventDate: string, daysBeforeEvent: number): string {
  return addDaysToDateOnly(eventDate, -daysBeforeEvent);
}

/**
 * Compute difference in calendar days between two YYYY-MM-DD dates (targetDate - fromDate).
 */
export function diffInDays(fromDate: string, targetDate: string): number {
  const [y1, m1, d1] = fromDate.split('-').map(Number);
  const [y2, m2, d2] = targetDate.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((utc2 - utc1) / MS_PER_DAY);
}

/**
 * Countdown from today in Asia/Kolkata to the eventDate.
 */
export function getCountdownToEvent(eventDate: string): {
  days: number;
  isPast: boolean;
  isToday: boolean;
  label: string;
} {
  const today = getTodayInKolkata();
  const days = diffInDays(today, eventDate);

  if (days === 0) {
    return { days: 0, isPast: false, isToday: true, label: 'Today is the big day! 🎉' };
  } else if (days < 0) {
    return {
      days: Math.abs(days),
      isPast: true,
      isToday: false,
      label: `${Math.abs(days)} days ago`,
    };
  } else {
    return {
      days,
      isPast: false,
      isToday: false,
      label: `${days} ${days === 1 ? 'day' : 'days'} to go`,
    };
  }
}
