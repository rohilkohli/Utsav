import type { Milestone, TimelineCompression } from './schemas.js';
import { compressMilestones } from './timelineCompression.js';
import { buildSchedule } from './timeline.js';

interface TimelinePlan {
  timeline: Milestone[];
  timelineCompression?: TimelineCompression;
}

/** Persist this result at generation/migration. Existing deadlines do not move as days pass. */
export function prepareTimeline(
  plan: TimelinePlan,
  eventDate: string,
  today: string,
): Required<TimelinePlan> {
  if (plan.timelineCompression?.eventDate === eventDate) {
    return { timeline: plan.timeline, timelineCompression: plan.timelineCompression };
  }
  const result = compressMilestones(plan.timeline, eventDate, today);
  return {
    timeline: result.milestones,
    timelineCompression: {
      compressed: result.compressed,
      originalSpanDays: result.originalSpanDays,
      availableDays: result.availableDays,
      preparedOn: today,
      eventDate,
    },
  };
}

/** Legacy and prepared plans retain their saved deadlines across every consumer. */
export function planSchedule(plan: TimelinePlan, eventDate: string, today: string) {
  return buildSchedule(plan.timeline, eventDate, today);
}
