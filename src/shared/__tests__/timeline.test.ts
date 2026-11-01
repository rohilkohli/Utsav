import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import type { Milestone } from '../schemas.js';
import { getTodayInKolkata, isDateOnOrAfterTodayInKolkata } from '../schemas.js';

describe('Timeline & Date Math (Asia/Kolkata timezone)', () => {
  it('adds and subtracts days deterministically without timezone drift', () => {
    expect(addDaysToDateOnly('2026-10-20', 5)).toBe('2026-10-25');
    expect(addDaysToDateOnly('2026-10-20', -5)).toBe('2026-10-15');
    expect(addDaysToDateOnly('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateOnly('2024-02-28', 1)).toBe('2024-02-29'); // Leap year test
  });

  it('computes milestone date relative to event date', () => {
    const eventDate = '2026-12-25';
    // 30 days before event
    expect(computeMilestoneDate(eventDate, 30)).toBe('2026-11-25');
    // Event day (0 days before)
    expect(computeMilestoneDate(eventDate, 0)).toBe('2026-12-25');
  });

  it('computes calendar day differences accurately', () => {
    expect(diffInDays('2026-10-20', '2026-10-25')).toBe(5);
    expect(diffInDays('2026-10-25', '2026-10-20')).toBe(-5);
    expect(diffInDays('2026-10-20', '2026-10-20')).toBe(0);
  });

  it('orders dependencies and rejects unknown or cyclic graphs', () => {
    const milestones: Milestone[] = [
      { id: 'b', title: 'Book venue', description: '', daysBeforeEvent: 30, date: '2026-11-01', dependsOn: ['a'] },
      { id: 'a', title: 'Choose date', description: '', daysBeforeEvent: 60, date: '2026-10-02' },
    ];
    expect(topoOrder(milestones).map((milestone) => milestone.id)).toEqual(['a', 'b']);
    expect(detectCycles(milestones)).toBe(false);
    expect(() => topoOrder([{ ...milestones[0], dependsOn: ['missing'] }])).toThrow(ScheduleError);
    expect(detectCycles([
      { ...milestones[0], dependsOn: ['a'] },
      { ...milestones[1], dependsOn: ['b'] },
    ])).toBe(true);
  });

  it('compresses a late plan and propagates prerequisite delays', () => {
    const milestones: Milestone[] = [
      { id: 'a', title: 'Venue', description: '', daysBeforeEvent: 100, date: '2026-09-01' },
      { id: 'b', title: 'Catering', description: '', daysBeforeEvent: 50, date: '2026-10-21', dependsOn: ['a'] },
    ];
    const compressed = compressTasks(milestones, '2026-12-01', '2026-11-01');
    expect(Math.max(...compressed.map((milestone) => milestone.daysBeforeEvent))).toBe(30);
    const delayed = propagateDelay(compressed, 'a', 5);
    expect(delayed.find((milestone) => milestone.id === 'b')?.delayDays).toBe(5);
    expect(affectedByDelays(delayed).get('b')).toEqual(['Venue']);
    expect(buildSchedule(delayed, '2026-12-01', '2026-11-01').every((milestone) => milestone.dueDate)).toBe(true);
  });

  it('groups timeline work into five planning phases', () => {
    expect(phaseFor(180)).toBe('4+ months out');
    expect(phaseFor(90)).toBe('2 to 4 months out');
    expect(phaseFor(45)).toBe('1 to 2 months out');
    expect(phaseFor(14)).toBe('Final month');
    expect(phaseFor(3)).toBe('Final week');
  });

  describe('IST (Asia/Kolkata) Midnight & 00:30 Boundary Tests', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('correctly reports today in Kolkata at 00:30 IST (19:00 UTC previous day)', () => {
      // 2026-10-20 19:00:00 UTC is 2026-10-21 00:30:00 IST (+5:30)
      vi.setSystemTime(new Date('2026-10-20T19:00:00Z'));

      const todayKolkata = getTodayInKolkata();
      expect(todayKolkata).toBe('2026-10-21');

      // An event on 2026-10-20 should now be in the past
      expect(isDateOnOrAfterTodayInKolkata('2026-10-20')).toBe(false);
      // An event on 2026-10-21 is today
      expect(isDateOnOrAfterTodayInKolkata('2026-10-21')).toBe(true);

      const countdown = getCountdownToEvent('2026-10-21');
      expect(countdown.isToday).toBe(true);
      expect(countdown.days).toBe(0);
    });

    it('correctly handlescountdown for future and past dates', () => {
      vi.setSystemTime(new Date('2026-10-20T10:00:00Z')); // 15:30 IST on 2026-10-20
      const countdownFuture = getCountdownToEvent('2026-10-30');
      expect(countdownFuture.isPast).toBe(false);
      expect(countdownFuture.days).toBe(10);

      const countdownPast = getCountdownToEvent('2026-10-10');
      expect(countdownPast.isPast).toBe(true);
      expect(countdownPast.days).toBe(10);
    });
  });
});
