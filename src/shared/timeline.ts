import { requireValue } from './invariants.js';
import { getTodayInKolkata, type Milestone } from './schemas.js';
import { addDaysToDateOnly, computeMilestoneDate, diffInDays } from './dateMath.js';
export { addDaysToDateOnly, computeMilestoneDate, diffInDays } from './dateMath.js';

export class ScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleError';
  }
}
export interface ScheduledMilestone extends Milestone {
  dueDate: string;
  effectiveDate: string;
  pushedBy: string[];
  flags: { overdue: boolean; atRisk: boolean; impossible: boolean; tooLate: boolean };
}

function graph(milestones: Milestone[]): Map<string, Milestone> {
  const byId = new Map(milestones.map((milestone) => [milestone.id, milestone]));
  if (byId.size !== milestones.length) throw new ScheduleError('Duplicate milestone ID');
  for (const milestone of milestones)
    for (const dependency of milestone.dependsOn ?? []) {
      if (!byId.has(dependency)) throw new ScheduleError(`Unknown dependency ID: ${dependency}`);
    }
  return byId;
}

export function detectCycles(milestones: Milestone[]): boolean {
  const byId = graph(milestones);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependency of requireValue(byId.get(id)).dependsOn ?? [])
      if (visit(dependency)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return milestones.some((milestone) => visit(milestone.id));
}

export function topoOrder(milestones: Milestone[]): Milestone[] {
  const byId = graph(milestones);
  if (detectCycles(milestones)) throw new ScheduleError('Milestone dependency cycle detected');
  const ordered: Milestone[] = [];
  const visited = new Set<string>();
  const visit = (milestone: Milestone): void => {
    if (visited.has(milestone.id)) return;
    visited.add(milestone.id);
    for (const dependency of milestone.dependsOn ?? []) {
      visit(requireValue(byId.get(dependency)));
    }
    ordered.push(milestone);
  };
  milestones.forEach(visit);
  return ordered;
}

/**
 * Deadlines and task durations share one scale, preserving dependency order even
 * on zero-day runways. A due date denotes completion, not a start-time promise.
 */
export function compressTasks(
  milestones: Milestone[],
  eventDate: string,
  today: string,
): Milestone[] {
  const ordered = topoOrder(milestones);
  const runway = Math.max(0, diffInDays(today, eventDate));
  const longest = Math.max(0, ...milestones.map((milestone) => milestone.daysBeforeEvent));
  const positions = new Map<string, number>();
  for (const milestone of ordered) {
    const prerequisite = Math.max(
      0,
      ...(milestone.dependsOn ?? []).map((id) => requireValue(positions.get(id))),
    );
    const duration = (milestone.dependsOn?.length ?? 0) > 0 ? (milestone.durationDays ?? 3) : 0;
    positions.set(
      milestone.id,
      Math.max(longest - milestone.daysBeforeEvent, prerequisite + duration),
    );
  }
  const horizon = Math.max(longest, ...positions.values(), 0);
  const scale = horizon > runway ? runway / horizon : 1;
  const start = addDaysToDateOnly(eventDate, -Math.min(horizon, runway));
  return ordered.map((milestone) => {
    const position = Math.floor(requireValue(positions.get(milestone.id)) * scale);
    const date = addDaysToDateOnly(start, position);
    return {
      ...milestone,
      daysBeforeEvent: diffInDays(date, eventDate),
      date,
      durationDays: Math.floor((milestone.durationDays ?? 3) * scale),
    };
  });
}

export function buildSchedule(
  milestones: Milestone[],
  eventDate: string,
  today: string,
): ScheduledMilestone[] {
  const scheduled = new Map<string, ScheduledMilestone>();
  const sources = new Map<string, Set<string>>();
  return topoOrder(milestones).map((milestone) => {
    const dueDate = computeMilestoneDate(eventDate, milestone.daysBeforeEvent);
    const done = milestone.status === 'done' || milestone.completed === true;
    let effectiveDate = addDaysToDateOnly(dueDate, milestone.delayDays ?? 0);
    const reasons = new Set<string>();
    for (const id of milestone.dependsOn ?? []) {
      const dependency = requireValue(scheduled.get(id));
      const earliest = addDaysToDateOnly(dependency.effectiveDate, milestone.durationDays ?? 3);
      if (earliest > effectiveDate) effectiveDate = earliest;
      if (earliest > dueDate)
        for (const source of requireValue(sources.get(id))) reasons.add(source);
    }
    const pushedBy = [...reasons];
    if ((milestone.delayDays ?? 0) > 0) reasons.add(milestone.title);
    sources.set(milestone.id, reasons);
    const item: ScheduledMilestone = {
      ...milestone,
      dueDate,
      effectiveDate,
      pushedBy,
      flags: {
        overdue: !done && effectiveDate < today,
        atRisk: !done && (effectiveDate > dueDate || milestone.status === 'delayed'),
        impossible: !done && effectiveDate > eventDate,
        tooLate: !done && (effectiveDate > eventDate || eventDate < today),
      },
    };
    scheduled.set(milestone.id, item);
    return item;
  });
}

/** Store the local delay once. Derived schedules propagate it through the DAG. */
export function propagateDelay(
  milestones: Milestone[],
  id: string,
  delayDays: number,
): Milestone[] {
  topoOrder(milestones);
  if (!milestones.some((milestone) => milestone.id === id))
    throw new ScheduleError(`Unknown milestone ID: ${id}`);
  if (!Number.isFinite(delayDays)) throw new ScheduleError('Delay must be finite');
  const delay = Math.max(0, Math.round(delayDays));
  return milestones.map((milestone) =>
    milestone.id === id
      ? {
          ...milestone,
          delayDays: delay,
          status: delay > 0 ? 'delayed' : milestone.completed ? 'done' : 'todo',
        }
      : { ...milestone },
  );
}

export function affectedByDelays(milestones: Milestone[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const ancestors = new Map<string, Set<string>>();
  for (const milestone of topoOrder(milestones)) {
    const titles = new Set<string>();
    for (const id of milestone.dependsOn ?? []) {
      for (const title of requireValue(ancestors.get(id))) titles.add(title);
    }
    if (titles.size > 0) result.set(milestone.id, [...titles]);
    if ((milestone.delayDays ?? 0) > 0) titles.add(milestone.title);
    ancestors.set(milestone.id, titles);
  }
  return result;
}

export function phaseFor(daysBeforeEvent: number): string {
  if (daysBeforeEvent >= 120) return '4+ months out';
  if (daysBeforeEvent >= 60) return '2 to 4 months out';
  if (daysBeforeEvent >= 30) return '1 to 2 months out';
  if (daysBeforeEvent >= 7) return 'Final month';
  return 'Final week';
}

/** The optional clock adapter preserves the existing UI API; engines pass today. */
export function getCountdownToEvent(
  eventDate: string,
  today = getTodayInKolkata(),
): {
  days: number;
  isPast: boolean;
  isToday: boolean;
  label: string;
} {
  const days = diffInDays(today, eventDate);
  if (days === 0)
    return { days: 0, isPast: false, isToday: true, label: 'Today is the big day! 🎉' };
  if (days < 0)
    return {
      days: Math.abs(days),
      isPast: true,
      isToday: false,
      label: `${Math.abs(days)} days ago`,
    };
  return {
    days,
    isPast: false,
    isToday: false,
    label: `${days} ${days === 1 ? 'day' : 'days'} to go`,
  };
}
