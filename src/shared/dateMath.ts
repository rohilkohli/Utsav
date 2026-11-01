/** Calendar arithmetic uses UTC date-only values, independently of worker timezone. */
export function addDaysToDateOnly(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function computeMilestoneDate(eventDate: string, daysBeforeEvent: number): string {
  return addDaysToDateOnly(eventDate, -daysBeforeEvent);
}
export function diffInDays(fromDate: string, targetDate: string): number {
  return Math.round(
    (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000,
  );
}
