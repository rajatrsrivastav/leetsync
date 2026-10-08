import { describe, expect, it } from 'vitest';
import {
  completedCount,
  currentStreak,
  isSuccessfulDay,
  weekDays,
  weeklyCompleted,
} from '../src/domain/streak';
import { addDateKeyDays, localDate, parseLocalDate } from '../src/utils/date';
import type { DailyActivity } from '../src/types';

const activity = (date: string, count = 2, goal = 2): DailyActivity => ({
  date,
  goal,
  attemptIds: Array.from({ length: count }, (_, i) => `attempt-${i}`),
  problemIds: Array.from({ length: count }, (_, i) => `problem-${i}`),
});
const now = new Date(2026, 9, 8, 0, 2);

describe('local calendar streaks', () => {
  it('preserves the streak while today is still incomplete', () => {
    expect(
      currentStreak(
        [activity('2026-10-06'), activity('2026-10-07'), activity('2026-10-08', 1)],
        now,
      ),
    ).toBe(2);
  });
  it('includes today when its own daily goal is met', () => {
    expect(
      currentStreak(
        [activity('2026-10-06', 1, 1), activity('2026-10-07'), activity('2026-10-08')],
        now,
      ),
    ).toBe(3);
  });
  it('breaks on an unsuccessful completed calendar day and ignores future data', () => {
    expect(
      currentStreak(
        [activity('2026-10-06'), activity('2026-10-07', 1), activity('2026-10-09')],
        now,
      ),
    ).toBe(0);
    expect(
      currentStreak(
        [activity('2026-10-06'), activity('2026-10-07', 1), activity('2026-10-08')],
        now,
      ),
    ).toBe(1);
  });
  it('does not inflate meaningful activity with repeated attempts of one problem', () => {
    const duplicate = { ...activity('2026-10-08'), problemIds: ['a', 'a'] };
    expect(completedCount(duplicate)).toBe(1);
    expect(isSuccessfulDay(duplicate)).toBe(false);
    expect(currentStreak([duplicate], now)).toBe(0);
  });
  it('handles missing activity and invalid zero goals safely', () => {
    expect(currentStreak({}, now)).toBe(0);
    expect(completedCount()).toBe(0);
    expect(isSuccessfulDay(activity('2026-10-08', 0, 0))).toBe(false);
  });
  it('returns Monday–Sunday local keys including a cross-month week', () => {
    const days = weekDays(new Date(2026, 10, 1, 23));
    expect(days).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });
  it('calculates the week from meaningful unique problem counts', () => {
    expect(
      weeklyCompleted(
        [activity('2026-10-04'), activity('2026-10-05'), activity('2026-10-08', 1)],
        now,
      ),
    ).toBe(3);
  });
  it('formats the local calendar date instead of truncating a UTC timestamp', () => {
    expect(localDate(new Date(2026, 9, 8, 0, 1))).toBe('2026-10-08');
    expect(localDate(new Date(2026, 9, 8, 23, 59))).toBe('2026-10-08');
  });
  it('adds calendar days through month/year/leap boundaries', () => {
    expect(addDateKeyDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDateKeyDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDateKeyDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(() => parseLocalDate('2026-02-30')).toThrow(RangeError);
    expect(() => parseLocalDate('10/08/2026')).toThrow(RangeError);
  });
  it('keeps calendar arithmetic correct across the spring and fall DST boundaries', () => {
    expect(addDateKeyDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDateKeyDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDateKeyDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(
      currentStreak(
        [activity('2026-03-07'), activity('2026-03-08'), activity('2026-03-09')],
        new Date(2026, 2, 9, 12),
      ),
    ).toBe(3);
  });
});
