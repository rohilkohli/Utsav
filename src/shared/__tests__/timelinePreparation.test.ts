import { describe, expect, it } from 'vitest';
import { generateFallbackPlan } from '../fallback.js';
import { planFacts } from '../advisor.js';
import { planInsights } from '../insights.js';
import { milestoneSchema, planOutputSchema } from '../schemas.js';
import {
  affectedByDelays,
  buildSchedule,
  compressMilestones,
  propagateDelay,
} from '../timeline.js';
import { inferCeremonyDependencies } from '../timelineGraph.js';
import { planSchedule, prepareTimeline } from '../timelinePreparation.js';
import { input, plan, task, today } from './fixtures.js';

describe('persisted planning deadlines', () => {
  it('compresses at generation and retains those deadlines as the planning day advances', () => {
    const shortNotice = { ...input, eventType: 'wedding' as const, eventDate: '2030-01-26' };
    const generated = generateFallbackPlan(shortNotice, today);
    expect(generated.timelineCompression).toMatchObject({
      compressed: true,
      originalSpanDays: 120,
      availableDays: 25,
      preparedOn: today,
      eventDate: shortNotice.eventDate,
    });
    expect(planOutputSchema.parse(generated).timelineCompression).toEqual(
      generated.timelineCompression,
    );
    expect(
      generated.timeline.every(
        (entry) => entry.date >= today && entry.date <= shortNotice.eventDate,
      ),
    ).toBe(true);
    expect(
      planInsights(generated, shortNotice, today).some((entry) => entry.id === 'timeline-overdue'),
    ).toBe(false);
    const tomorrow = '2030-01-02';
    const later = prepareTimeline(generated, shortNotice.eventDate, tomorrow);
    expect(later.timeline).toBe(generated.timeline);
    expect(later.timelineCompression).toBe(generated.timelineCompression);
    expect(
      planInsights(generated, shortNotice, tomorrow).some(
        (entry) => entry.id === 'timeline-overdue',
      ),
    ).toBe(true);
    expect(planFacts(generated, shortNotice, today).nextTaskDate).toBe(generated.timeline[0]?.date);
  });
  it('preserves historical legacy deadlines and only explicitly re-prepares changed dates', () => {
    const legacy = plan({ timeline: [task('old', 60)] });
    expect(planSchedule(legacy, input.eventDate, today)[0]?.flags.overdue).toBe(true);
    expect(affectedByDelays([{ ...task('legacy'), dependsOn: undefined }]).size).toBe(0);
    expect(
      buildSchedule(
        [task('parent', 20), { ...task('legacy-child', 0, ['parent']), durationDays: undefined }],
        input.eventDate,
        today,
      )[1]?.effectiveDate,
    ).toBe(input.eventDate);
    const prepared = prepareTimeline(legacy, input.eventDate, today);
    const changed = prepareTimeline(prepared, '2030-02-02', today);
    expect(changed.timelineCompression.eventDate).toBe('2030-02-02');
    expect(changed.timelineCompression).not.toBe(prepared.timelineCompression);
    expect(compressMilestones([], input.eventDate, today)).toEqual({
      milestones: [],
      compressed: false,
      originalSpanDays: 0,
      availableDays: 31,
    });
  });
  it('infers ceremony chains alongside explicit dependencies while leaving general tasks independent', () => {
    const tasks = [
      { ...task('later', 1), subEvent: 'Haldi' },
      { ...task('general', 10), subEvent: 'General' },
      { ...task('earlier', 10), subEvent: 'Haldi' },
      { ...task('other', 5), subEvent: 'Sangeet' },
      task('independent', 0),
      { ...task('legacy', 0), dependsOn: undefined },
    ];
    const inferred = inferCeremonyDependencies(tasks).milestones;
    expect(inferred.find((entry) => entry.id === 'later')?.dependsOn).toEqual(['earlier']);
    expect(inferred.find((entry) => entry.id === 'independent')?.dependsOn).toEqual([]);
    expect(inferred.find((entry) => entry.id === 'general')?.dependsOn).toEqual([]);
    expect(inferred.find((entry) => entry.id === 'other')?.dependsOn).toEqual([]);
    const explicit = [...tasks, task('explicit', 0, ['earlier'])];
    expect(
      inferCeremonyDependencies(explicit).milestones.find((entry) => entry.id === 'explicit')
        ?.dependsOn,
    ).toEqual(['earlier']);
    const scheduled = prepareTimeline({ timeline: tasks }, input.eventDate, today);
    const delayed = { ...scheduled, timeline: propagateDelay(scheduled.timeline, 'earlier', 30) };
    expect(
      planSchedule(delayed, input.eventDate, today).find((entry) => entry.id === 'later')?.pushedBy,
    ).toEqual(['earlier']);
    expect(tasks[0]?.dependsOn).toEqual([]);
  });
  it('supplements mixed and legacy ceremony lists without moving undelayed deadlines or creating cycles', () => {
    const tasks = [
      task('unrelated', 20),
      task('edge', 10, ['unrelated']),
      { ...task('haldi-first', 5), subEvent: 'Haldi' },
      { ...task('haldi-equal', 5), subEvent: 'Haldi', dependsOn: undefined },
      { ...task('haldi-next', 4), subEvent: 'Haldi' },
    ];
    const unchanged = planSchedule(plan({ timeline: tasks }), input.eventDate, today);
    expect(unchanged.find((entry) => entry.id === 'haldi-equal')?.effectiveDate).toBe('2030-01-27');
    expect(unchanged.find((entry) => entry.id === 'haldi-next')?.effectiveDate).toBe('2030-01-28');
    const delayed = plan({ timeline: propagateDelay(tasks, 'haldi-first', 20) });
    const scheduled = planSchedule(delayed, input.eventDate, today);
    expect(scheduled.find((entry) => entry.id === 'haldi-next')).toMatchObject({
      effectiveDate: '2030-02-17',
      pushedBy: ['haldi-first'],
      flags: { impossible: true },
    });
    expect(delayed.timeline.find((entry) => entry.id === 'haldi-next')?.dependsOn).toEqual([]);
    const explicit = [
      { ...task('before', 5, ['after']), subEvent: 'Haldi' },
      { ...task('after', 0), subEvent: 'Haldi' },
    ];
    expect(inferCeremonyDependencies(explicit).ceremonyEdges.size).toBe(0);
    const direct = [
      { ...task('a', 5), subEvent: 'Haldi' },
      { ...task('b', 4, ['a']), subEvent: 'Haldi', durationDays: 3 },
    ];
    expect(buildSchedule(direct, input.eventDate, today)[1]?.effectiveDate).toBe('2030-01-30');
  });
  it('attributes only delays that determine the effective date after slack and competing prerequisites', () => {
    const first = { ...task('first', 20), delayDays: 15 };
    const second = { ...task('second', 20), delayDays: 17 };
    const child = task('child', 10, ['first', 'second']);
    expect(buildSchedule([first, second, child], input.eventDate, today)[2]?.pushedBy).toEqual([
      'second',
    ]);
    expect(
      buildSchedule([first, { ...second, delayDays: 15 }, child], input.eventDate, today)[2]
        ?.pushedBy,
    ).toEqual(['first', 'second']);
    expect(
      buildSchedule([first, second, { ...child, delayDays: 30 }], input.eventDate, today)[2]
        ?.pushedBy,
    ).toEqual([]);
    expect(
      buildSchedule(
        [{ ...first, delayDays: 1 }, task('slack', 10, ['first'])],
        input.eventDate,
        today,
      )[1]?.pushedBy,
    ).toEqual([]);
  });
  it('preserves after-event work instead of compressing it into the planning runway', () => {
    const tasks = [
      { ...task('celebrate', 0), date: input.eventDate },
      { ...task('cleanup', -2, ['celebrate']), date: '2030-02-03' },
    ];
    const result = compressMilestones(tasks, input.eventDate, today);
    expect(result.compressed).toBe(false);
    expect(result.milestones).toEqual(tasks);
    const short = compressMilestones([task('prepare', 120), ...tasks], input.eventDate, today);
    expect(short.compressed).toBe(true);
    expect(short.milestones.find((entry) => entry.id === 'cleanup')).toEqual(tasks[1]);
  });
  it('bounds delays in both validation and the engine and protects finished tasks', () => {
    expect(milestoneSchema.safeParse({ ...task('a'), delayDays: 366 }).success).toBe(false);
    expect(milestoneSchema.safeParse({ ...task('a'), delayDays: 365 }).success).toBe(true);
    expect(propagateDelay([task('a')], 'a', 999)[0]?.delayDays).toBe(365);
    expect(propagateDelay([task('a')], 'a', 1.7)[0]?.delayDays).toBe(2);
    expect(propagateDelay([{ ...task('a'), status: 'done' }], 'a', 7)[0]).toMatchObject({
      status: 'done',
      delayDays: 0,
    });
    expect(propagateDelay([{ ...task('a'), completed: true }], 'a', 7)[0]).toMatchObject({
      status: 'done',
      delayDays: 0,
    });
  });
});
