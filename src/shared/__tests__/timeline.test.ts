import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDaysToDateOnly,
  computeMilestoneDate,
  diffInDays,
  getCountdownToEvent,
  detectCycles,
  topoOrder,
  compressTasks,
  buildSchedule,
  propagateDelay,
  affectedByDelays,
  phaseFor,
  ScheduleError,
} from '../timeline.js';
import { EVENT_TYPES, getTodayInKolkata, isDateOnOrAfterTodayInKolkata } from '../schemas.js';
import { task, today } from './fixtures.js';

afterEach(() => vi.useRealTimers());
describe('calendar arithmetic', () => {
  it('handles UTC, leap years and month boundaries', () => {
    expect(addDaysToDateOnly('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysToDateOnly('2026-12-31', 1)).toBe('2027-01-01');
    expect(computeMilestoneDate('2026-12-01', 30)).toBe('2026-11-01');
    expect(diffInDays('2026-12-01', '2026-11-01')).toBe(-30);
  });
  it('respects IST midnight and exposes an explicit today adapter', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T19:00:00Z'));
    expect(getTodayInKolkata()).toBe('2026-10-21');
    expect(isDateOnOrAfterTodayInKolkata('2026-10-20')).toBe(false);
    expect(isDateOnOrAfterTodayInKolkata('2026-10-21')).toBe(true);
    expect(getCountdownToEvent('2026-10-21').isToday).toBe(true);
    expect(getCountdownToEvent('2030-01-02', today).label).toBe('1 day to go');
    expect(getCountdownToEvent('2030-01-03', today).label).toBe('2 days to go');
    expect(getCountdownToEvent('2029-12-30', today).label).toBe('2 days ago');
  });
});

describe('DAG schedule', () => {
  it('orders all prerequisites, detects cycles, unknown and duplicate IDs', () => {
    const a = task('a');
    const b = task('b', 0, ['a']);
    expect(topoOrder([b, a]).map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(topoOrder([])).toEqual([]);
    expect(detectCycles([a, b])).toBe(false);
    expect(detectCycles([{ ...a, dependsOn: ['b'] }, b])).toBe(true);
    expect(() => topoOrder([{ ...a, dependsOn: ['b'] }, b])).toThrow(ScheduleError);
    expect(() => detectCycles([task('a', 1, ['missing'])])).toThrow('Unknown dependency');
    expect(() => topoOrder([a, a])).toThrow('Duplicate');
  });
  it('absorbs slack before pushing dependent tasks and never double counts a delay', () => {
    const tasks = [task('a', 20), task('b', 10, ['a']), task('c', 0, ['b'])];
    const delayed = propagateDelay(tasks, 'a', 15);
    expect(delayed.find((entry) => entry.id === 'b')?.delayDays).toBeUndefined();
    const schedule = buildSchedule(delayed, '2030-02-01', today);
    expect(schedule.find((entry) => entry.id === 'a')?.effectiveDate).toBe('2030-01-27');
    expect(schedule.find((entry) => entry.id === 'b')?.effectiveDate).toBe('2030-01-30');
    expect(schedule.find((entry) => entry.id === 'c')?.effectiveDate).toBe('2030-02-02');
    expect(schedule.find((entry) => entry.id === 'c')?.pushedBy).toEqual(['a']);
    expect(schedule.find((entry) => entry.id === 'c')?.flags.impossible).toBe(true);
    expect(affectedByDelays(delayed).get('c')).toEqual(['a']);
    const reset = propagateDelay(delayed, 'a', 0);
    expect(buildSchedule(reset, '2030-02-01', today).every((entry) => !entry.flags.atRisk)).toBe(
      true,
    );
    expect(affectedByDelays(reset).size).toBe(0);
    expect(() => propagateDelay(tasks, 'missing', 3)).toThrow(ScheduleError);
    expect(() => propagateDelay(tasks, 'a', NaN)).toThrow('finite');
  });
  it('retains independent local delays, supports done tasks and overdue flags', () => {
    const tasks = [
      task('a', 30),
      { ...task('b', 5, ['a']), delayDays: 2 },
      task('c', 0, ['a', 'b']),
    ];
    const delayed = propagateDelay(tasks, 'a', 1);
    expect(delayed.find((entry) => entry.id === 'b')?.delayDays).toBe(2);
    expect(affectedByDelays(delayed).get('c')).toEqual(['a', 'b']);
    const finished = propagateDelay([{ ...task('done'), completed: true }], 'done', -2);
    expect(finished[0]?.status).toBe('done');
    expect(
      buildSchedule(
        [{ ...task('old', 40), dependsOn: undefined, durationDays: undefined, status: undefined }],
        '2030-02-01',
        today,
      )[0]?.flags.overdue,
    ).toBe(true);
    expect(
      buildSchedule([{ ...task('done', 40), status: 'done' }], '2030-02-01', today)[0]?.flags
        .overdue,
    ).toBe(false);
    expect(buildSchedule([task('past', 0)], '2029-12-31', today)[0]?.flags.tooLate).toBe(true);
  });
  it.each(EVENT_TYPES)(
    'compresses every %s runway from 0 to 200 without false warnings',
    (eventType) => {
      const lead = eventType === 'wedding' ? 180 : eventType === 'community' ? 60 : 21;
      const tasks = [
        task('venue', lead),
        task('catering', Math.floor(lead / 2), ['venue']),
        task('confirm', 3, ['catering']),
        task('celebrate', 0, ['confirm']),
      ];
      for (let runway = 0; runway <= 200; runway++) {
        const eventDate = addDaysToDateOnly(today, runway);
        const compressed = compressTasks(tasks, eventDate, today);
        const schedule = buildSchedule(compressed, eventDate, today);
        expect(schedule).toHaveLength(tasks.length);
        for (const [index, entry] of schedule.entries()) {
          expect(entry.effectiveDate >= today && entry.effectiveDate <= eventDate).toBe(true);
          expect(entry.flags).toEqual({
            overdue: false,
            atRisk: false,
            impossible: false,
            tooLate: false,
          });
          for (const dependency of entry.dependsOn ?? []) {
            expect(schedule.findIndex((candidate) => candidate.id === dependency)).toBeLessThan(
              index,
            );
          }
        }
        expect(schedule[0]?.effectiveDate).toBe(
          runway <= lead ? today : addDaysToDateOnly(eventDate, -lead),
        );
      }
    },
  );
  it('handles zero lead, empty graphs and explicit optional legacy defaults', () => {
    expect(compressTasks([], '2030-01-01', today)).toEqual([]);
    expect(compressTasks([task('day', 0)], today, today)[0]?.date).toBe(today);
    const tasks = [
      { ...task('a', 2), dependsOn: undefined, durationDays: undefined },
      { ...task('b', 0, ['a']), durationDays: undefined },
    ];
    expect(
      buildSchedule(compressTasks(tasks, '2030-01-03', today), '2030-01-03', today).every(
        (entry) => !entry.flags.impossible,
      ),
    ).toBe(true);
  });
  it('groups five phases with exact boundaries', () => {
    expect([120, 60, 30, 7, 6].map(phaseFor)).toEqual([
      '4+ months out',
      '2 to 4 months out',
      '1 to 2 months out',
      'Final month',
      'Final week',
    ]);
  });
});
