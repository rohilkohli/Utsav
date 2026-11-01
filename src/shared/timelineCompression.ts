import { requireValue } from './invariants.js';
import type { Milestone } from './schemas.js';
import { topoOrder } from './timelineGraph.js';
import { addDaysToDateOnly, diffInDays } from './dateMath.js';

export interface CompressionResult {
  milestones: Milestone[];
  compressed: boolean;
  originalSpanDays: number;
  availableDays: number;
}

/**
 * Deadlines and task durations share one scale, preserving dependency order even
 * on zero-day runways. A due date denotes completion, not a start-time promise.
 */
export function compressMilestones(
  milestones: Milestone[],
  eventDate: string,
  today: string,
): CompressionResult {
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
  const horizon = Math.max(
    longest,
    ...ordered
      .filter((milestone) => milestone.daysBeforeEvent >= 0)
      .map((milestone) => requireValue(positions.get(milestone.id))),
    0,
  );
  const scale = horizon > runway ? runway / horizon : 1;
  const start = addDaysToDateOnly(eventDate, -Math.min(horizon, runway));
  const result = ordered.map((milestone) => {
    if (milestone.daysBeforeEvent < 0) return { ...milestone };
    const position = Math.floor(requireValue(positions.get(milestone.id)) * scale);
    const date = addDaysToDateOnly(start, position);
    return {
      ...milestone,
      daysBeforeEvent: diffInDays(date, eventDate),
      date,
      durationDays: Math.floor((milestone.durationDays ?? 3) * scale),
    };
  });
  return {
    milestones: result,
    compressed: horizon > runway,
    originalSpanDays: horizon,
    availableDays: runway,
  };
}

/** Compatibility adapter for callers that only need the normalized milestones. */
export function compressTasks(
  milestones: Milestone[],
  eventDate: string,
  today: string,
): Milestone[] {
  return compressMilestones(milestones, eventDate, today).milestones;
}
