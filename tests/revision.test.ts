import { describe, expect, it } from 'vitest';
import { RevisionScheduler } from '../src/services/RevisionScheduler';
import { localDate } from '../src/utils/date';
import type { ProblemProgress } from '../src/types';

const now = new Date(2026, 9, 8, 12);
const previous = (overrides: Partial<ProblemProgress> = {}): ProblemProgress => ({
  problemId: 'a',
  state: 'independent',
  attemptIds: ['old'],
  firstSolvedAt: '2026-08-01T12:00:00.000Z',
  successfulRevisions: 0,
  revisionIntervalDays: 30,
  ...overrides,
});

describe('RevisionScheduler', () => {
  it.each([
    ['independent', 30, '2026-11-07'],
    ['assisted', 7, '2026-10-15'],
    ['relearn', 1, '2026-10-09'],
  ] as const)(
    'schedules an initial %s solve with a %d-day interval',
    (confidence, interval, date) => {
      const schedule = RevisionScheduler.schedule(confidence, undefined, now);
      expect(schedule.revisionIntervalDays).toBe(interval);
      expect(localDate(new Date(schedule.revisionDueAt))).toBe(date);
      expect(schedule.successfulRevisions).toBe(0);
    },
  );
  it('doubles intervals only after an independent revision', () => {
    const firstRevision = RevisionScheduler.schedule('independent', previous(), now);
    expect(firstRevision.revisionIntervalDays).toBe(60);
    expect(firstRevision.successfulRevisions).toBe(1);
    const secondRevision = RevisionScheduler.schedule('independent', previous(firstRevision), now);
    expect(secondRevision.revisionIntervalDays).toBe(120);
    expect(secondRevision.successfulRevisions).toBe(2);
  });
  it('returns to short review intervals after assisted/relearn while retaining success history', () => {
    const prior = previous({ revisionIntervalDays: 120, successfulRevisions: 2 });
    expect(RevisionScheduler.schedule('assisted', prior, now)).toMatchObject({
      revisionIntervalDays: 7,
      successfulRevisions: 2,
    });
    expect(RevisionScheduler.schedule('relearn', prior, now)).toMatchObject({
      revisionIntervalDays: 1,
      successfulRevisions: 2,
    });
    expect(prior.revisionIntervalDays).toBe(120);
  });
  it('caps long revision spacing at one year', () => {
    expect(
      RevisionScheduler.schedule('independent', previous({ revisionIntervalDays: 240 }), now)
        .revisionIntervalDays,
    ).toBe(365);
  });
  it('does not count an in-progress first solve as a successful revision', () => {
    const result = RevisionScheduler.schedule(
      'independent',
      previous({ state: 'in_progress', firstSolvedAt: undefined }),
      now,
    );
    expect(result.revisionIntervalDays).toBe(30);
    expect(result.successfulRevisions).toBe(0);
  });
  it('schedules by local calendar days across DST while retaining the time of day', () => {
    const beforeDST = new Date(2026, 2, 7, 14, 30);
    const due = new Date(RevisionScheduler.schedule('relearn', undefined, beforeDST).revisionDueAt);
    expect(localDate(due)).toBe('2026-03-08');
    expect(due.getHours()).toBe(14);
    expect(due.getMinutes()).toBe(30);
  });
});
