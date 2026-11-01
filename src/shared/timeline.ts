import { requireValue } from './invariants.js';
import { getTodayInKolkata, type Milestone } from './schemas.js';
import { addDaysToDateOnly, computeMilestoneDate, diffInDays } from './dateMath.js';
import { inferCeremonyDependencies, ScheduleError, topoOrder } from './timelineGraph.js';
export { ScheduleError, detectCycles, topoOrder } from './timelineGraph.js';
export { compressTasks, compressMilestones } from './timelineCompression.js';
export { addDaysToDateOnly, computeMilestoneDate, diffInDays } from './dateMath.js';

export interface ScheduledMilestone extends Milestone {
  dueDate: string;
  effectiveDate: string;
  pushedBy: string[];
  flags: { overdue: boolean; atRisk: boolean; impossible: boolean; tooLate: boolean };
}

export function buildSchedule(
  milestones: Milestone[],
  eventDate: string,
  today: string,
): ScheduledMilestone[] {
  const scheduled = new Map<string, ScheduledMilestone>();
  const sources = new Map<string, Set<string>>();
  const inferred = inferCeremonyDependencies(milestones);
  return topoOrder(inferred.milestones).map((milestone) => {
    const dueDate = computeMilestoneDate(eventDate, milestone.daysBeforeEvent);
    const done = milestone.status === 'done' || milestone.completed === true;
    const localDate = addDaysToDateOnly(dueDate, milestone.delayDays ?? 0);
    let effectiveDate = localDate;
    const reasons = new Set<string>();
    for (const id of milestone.dependsOn ?? []) {
      const dependency = requireValue(scheduled.get(id));
      const earliest =
        inferred.ceremonyEdges.get(milestone.id) === id
          ? addDaysToDateOnly(
              dueDate,
              Math.max(0, diffInDays(dependency.dueDate, dependency.effectiveDate)),
            )
          : addDaysToDateOnly(dependency.effectiveDate, milestone.durationDays ?? 3);
      if (earliest > effectiveDate) {
        effectiveDate = earliest;
        reasons.clear();
      }
      if (earliest === effectiveDate && earliest > dueDate)
        for (const source of requireValue(sources.get(id))) reasons.add(source);
    }
    const pushedBy = [...reasons];
    if ((milestone.delayDays ?? 0) > 0 && localDate === effectiveDate) reasons.add(milestone.title);
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
  const delay = Math.min(365, Math.max(0, Math.round(delayDays)));
  return milestones.map((milestone) =>
    milestone.id === id
      ? {
          ...milestone,
          delayDays: milestone.completed || milestone.status === 'done' ? 0 : delay,
          status:
            milestone.completed || milestone.status === 'done'
              ? 'done'
              : delay > 0
                ? 'delayed'
                : 'todo',
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
