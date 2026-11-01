import { getTodayInKolkata, type Milestone } from './schemas.js';

export class ScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleError';
  }
}

export interface ScheduledMilestone extends Milestone {
  dueDate: string;
  effectiveDate: string;
  flags: {
    overdue: boolean;
    atRisk: boolean;
    impossible: boolean;
    tooLate: boolean;
  };
}

/**
 * Add or subtract days from an ISO date-only string (YYYY-MM-DD).
 * Deterministic UTC date math ensures no local timezone shifting.
 */
export function addDaysToDateOnly(dateStr: string, days: number): string {
  const [y = 0, m = 1, d = 1] = dateStr.split('-').map(Number);
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
  const [y1 = 0, m1 = 1, d1 = 1] = fromDate.split('-').map(Number);
  const [y2 = 0, m2 = 1, d2 = 1] = targetDate.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((utc2 - utc1) / MS_PER_DAY);
}

function dependenciesFor(milestone: Milestone): string[] {
  return milestone.dependsOn ?? [];
}

export function detectCycles(milestones: Milestone[]): boolean {
  const states = new Map<string, 'visiting' | 'visited'>();
  const byId = new Map(milestones.map((milestone) => [milestone.id, milestone]));

  const visit = (id: string): boolean => {
    const state = states.get(id);
    if (state === 'visiting') return true;
    if (state === 'visited') return false;
    const milestone = byId.get(id);
    if (!milestone) throw new ScheduleError(`Unknown dependency ID: ${id}`);
    states.set(id, 'visiting');
    for (const dependency of dependenciesFor(milestone)) {
      if (visit(dependency)) return true;
    }
    states.set(id, 'visited');
    return false;
  };

  return milestones.some((milestone) => visit(milestone.id));
}

export function topoOrder(milestones: Milestone[]): Milestone[] {
  const byId = new Map(milestones.map((milestone) => [milestone.id, milestone]));
  for (const milestone of milestones) {
    for (const dependency of dependenciesFor(milestone)) {
      if (!byId.has(dependency)) throw new ScheduleError(`Unknown dependency ID: ${dependency}`);
    }
  }
  if (detectCycles(milestones)) throw new ScheduleError('Milestone dependency cycle detected');

  const ordered: Milestone[] = [];
  const visited = new Set<string>();
  const visit = (milestone: Milestone) => {
    if (visited.has(milestone.id)) return;
    visited.add(milestone.id);
    for (const dependency of dependenciesFor(milestone)) visit(byId.get(dependency)!);
    ordered.push(milestone);
  };
  milestones.forEach(visit);
  return ordered;
}

export function compressTasks(milestones: Milestone[], eventDate: string, today: string): Milestone[] {
  const runway = Math.max(0, diffInDays(today, eventDate));
  const longest = Math.max(0, ...milestones.map((milestone) => milestone.daysBeforeEvent));
  if (longest <= runway || longest === 0) return milestones.map((milestone) => ({ ...milestone }));
  const ratio = runway / longest;
  return milestones.map((milestone) => ({
    ...milestone,
    daysBeforeEvent: Math.floor(milestone.daysBeforeEvent * ratio),
    durationDays: Math.max(1, Math.floor((milestone.durationDays ?? 3) * ratio)),
    date: computeMilestoneDate(eventDate, Math.floor(milestone.daysBeforeEvent * ratio)),
  }));
}

export function buildSchedule(milestones: Milestone[], eventDate: string, today: string): ScheduledMilestone[] {
  const ordered = topoOrder(milestones);
  const delays = new Map<string, number>();
  return ordered.map((milestone) => {
    const dependencyDelay = Math.max(0, ...dependenciesFor(milestone).map((id) => delays.get(id) ?? 0));
    const delayDays = dependencyDelay + (milestone.delayDays ?? 0);
    const dueDate = computeMilestoneDate(eventDate, milestone.daysBeforeEvent);
    const effectiveDate = addDaysToDateOnly(dueDate, delayDays);
    const durationDays = milestone.durationDays ?? 3;
    delays.set(milestone.id, delayDays);
    return {
      ...milestone,
      dueDate,
      effectiveDate,
      flags: {
        overdue: effectiveDate < today && milestone.status !== 'done' && !milestone.completed,
        atRisk: milestone.status === 'delayed' || diffInDays(today, effectiveDate) <= 7,
        impossible: diffInDays(effectiveDate, addDaysToDateOnly(effectiveDate, durationDays)) > diffInDays(effectiveDate, eventDate),
        tooLate: effectiveDate > eventDate,
      },
    };
  });
}

export function propagateDelay(milestones: Milestone[], id: string, delayDays: number): Milestone[] {
  const byId = new Map(milestones.map((milestone) => [milestone.id, milestone]));
  if (!byId.has(id)) throw new ScheduleError(`Unknown milestone ID: ${id}`);
  const delays = new Map<string, number>([[id, Math.max(0, Math.round(delayDays))]]);
  const ordered = topoOrder(milestones);
  for (const milestone of ordered) {
    const upstream = Math.max(0, ...dependenciesFor(milestone).map((dependency) => delays.get(dependency) ?? 0));
    if (upstream > 0) delays.set(milestone.id, upstream);
  }
  return milestones.map((milestone) => ({
    ...milestone,
    delayDays: delays.get(milestone.id) ?? milestone.delayDays,
    status: delays.has(milestone.id) ? 'delayed' : milestone.status,
  }));
}

export function affectedByDelays(milestones: Milestone[]): Map<string, string[]> {
  const affected = new Map<string, string[]>();
  for (const milestone of milestones) {
    for (const dependency of dependenciesFor(milestone)) {
      const upstream = milestones.find((candidate) => candidate.id === dependency);
      if (upstream?.delayDays && upstream.delayDays > 0) {
        affected.set(milestone.id, [...(affected.get(milestone.id) ?? []), upstream.title]);
      }
    }
  }
  return affected;
}

export function phaseFor(daysBeforeEvent: number): string {
  if (daysBeforeEvent >= 120) return '4+ months out';
  if (daysBeforeEvent >= 60) return '2 to 4 months out';
  if (daysBeforeEvent >= 30) return '1 to 2 months out';
  if (daysBeforeEvent >= 7) return 'Final month';
  return 'Final week';
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
