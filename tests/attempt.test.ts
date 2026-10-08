import { describe, expect, it } from 'vitest';
import {
  abandonAttempt,
  completeAttempt,
  elapsedSeconds,
  manualAccept,
  pauseAttempt,
  prepareAttempt,
  recordSubmission,
  startAttempt,
} from '../src/domain/attempt';
import { DailyQueueService } from '../src/services/DailyQueueService';
import {
  emptyState,
  STATE_KEY,
  StorageService,
  type StorageDriver,
} from '../src/services/StorageService';
import { completedCount, currentStreak } from '../src/domain/streak';
import type { AppState, CurriculumProblem, Reflection, SubmissionResult } from '../src/types';
import { localDate } from '../src/utils/date';

const problem = (id: string, order = 1): CurriculumProblem => ({
  id,
  order,
  title: id,
  slug: id,
  module: 'Arrays',
  difficulty: 'Easy',
  platform: 'leetcode',
  problemUrl: `https://leetcode.com/problems/${id}/`,
});
const first = problem('two-sum');
const second = problem('three-sum', 2);
const base = new Date(2026, 9, 8, 9);
const at = (seconds: number) => new Date(base.getTime() + seconds * 1000);
const submission = (
  id: string,
  verdict: SubmissionResult['verdict'],
  seconds: number,
): SubmissionResult => ({
  id,
  verdict,
  observedAt: at(seconds).toISOString(),
  problemSlug: first.slug,
});

class MemoryDriver implements StorageDriver {
  data: Record<string, unknown> = {};
  async get(key: string) {
    return { [key]: structuredClone(this.data[key]) };
  }
  async set(items: Record<string, unknown>) {
    Object.assign(this.data, structuredClone(items));
  }
}

function activeState(): AppState {
  const state = emptyState();
  prepareAttempt(state, first, base, 'a');
  startAttempt(state, 'a', base);
  return state;
}

describe('attempt lifecycle', () => {
  it('persists the full two-problem journey with timer reload, reflection, revisions, and a successful day', async () => {
    const driver = new MemoryDriver();
    let storage = new StorageService(driver);
    const today = localDate(base);
    await storage.transaction((state) => {
      state.settings.onboardingComplete = true;
      expect(state.settings.dailyGoal).toBe(2);
      const queue = DailyQueueService.generate(state, [first, second], base);
      state.queues[today] = queue;
      expect(queue.items.map((item) => item.problemId)).toEqual([first.id, second.id]);
      const attempt = prepareAttempt(state, first, base, 'one');
      expect(attempt.status).toBe('ready');
      expect(elapsedSeconds(attempt, at(60))).toBe(0);
      startAttempt(state, attempt.id, at(60));
    });

    // A newly created service reads the same extension-storage snapshot after a reload.
    storage = new StorageService(driver);
    expect(elapsedSeconds((await storage.read()).attempts.one!, at(120))).toBe(60);
    await storage.transaction((state) => {
      expect(
        recordSubmission(state, 'one', submission('wrong', 'wrong_answer', 180), at(180)),
      ).toBe(true);
      expect(state.attempts.one?.status).toBe('active');
      expect(state.attempts.one?.submissionCount).toBe(1);
    });
    await storage.transaction((state) => {
      const accepted = {
        ...submission('accepted-one', 'accepted', 240),
        code: 'print(1)',
        language: 'python3',
      };
      expect(recordSubmission(state, 'one', accepted, at(240))).toBe(true);
      expect(recordSubmission(state, 'one', accepted, at(300))).toBe(false);
      expect(state.attempts.one).toMatchObject({
        status: 'accepted',
        activeSeconds: 180,
        submissionCount: 2,
      });
      expect(state.attempts.one?.runningSince).toBeUndefined();
      expect(state.attempts.one?.confidence).toBeUndefined();
      completeAttempt(
        state,
        'one',
        { confidence: 'assisted', hintsUsed: 1, notes: 'Review the invariant' },
        at(300),
      );
      expect(state.progress[first.id]).toMatchObject({
        state: 'assisted',
        revisionIntervalDays: 7,
      });
      expect(completedCount(state.activities[today])).toBe(1);
      expect(DailyQueueService.generate(state, [first, second], at(300)).items[1]?.problemId).toBe(
        second.id,
      );
      prepareAttempt(state, second, at(360), 'two');
      startAttempt(state, 'two', at(360));
    });
    await storage.transaction((state) => {
      recordSubmission(
        state,
        'two',
        { ...submission('accepted-two', 'accepted', 600), problemSlug: second.slug },
        at(600),
      );
      completeAttempt(state, 'two', { confidence: 'independent' }, at(660));
    });

    // A browser/service worker restart retains the completed day and both histories.
    const saved = await new StorageService(driver).read();
    expect(saved.activities[today]).toEqual({
      date: today,
      goal: 2,
      attemptIds: ['one', 'two'],
      problemIds: [first.id, second.id],
    });
    expect(currentStreak(saved.activities, at(720))).toBe(1);
    expect(saved.progress[second.id]).toMatchObject({
      state: 'independent',
      revisionIntervalDays: 30,
    });
    expect(saved.attempts.one).toMatchObject({
      status: 'completed',
      activeSeconds: 180,
      confidence: 'assisted',
      hintsUsed: 1,
    });
    expect(saved.attempts.two).toMatchObject({ status: 'completed', activeSeconds: 240 });
    expect(saved.activeAttemptId).toBeUndefined();
    expect(saved.syncJobs).toEqual({});
    expect(driver.data[STATE_KEY]).toBeDefined();
  });

  it('counts only active time across pauses, resumes, and repeated start commands', () => {
    const state = activeState();
    startAttempt(state, 'a', at(30));
    pauseAttempt(state, 'a', at(60));
    pauseAttempt(state, 'a', at(90));
    expect(elapsedSeconds(state.attempts.a!, at(120))).toBe(60);
    startAttempt(state, 'a', at(180));
    expect(elapsedSeconds(state.attempts.a!, at(240))).toBe(120);
    recordSubmission(state, 'a', submission('ac', 'accepted', 300), at(300));
    expect(elapsedSeconds(state.attempts.a!, at(360))).toBe(180);
  });

  it('stops timing the previous problem when switching and resumes the existing history', () => {
    const state = activeState();
    prepareAttempt(state, second, at(90), 'b');
    expect(state.attempts.a).toMatchObject({ status: 'paused', activeSeconds: 90 });
    expect(state.attempts.b?.status).toBe('ready');
    startAttempt(state, 'b', at(120));
    expect(prepareAttempt(state, first, at(180), 'ignored').id).toBe('a');
    expect(state.attempts.b).toMatchObject({ status: 'paused', activeSeconds: 60 });
    expect(state.progress[first.id]?.attemptIds).toEqual(['a']);
    expect(Object.keys(state.attempts)).toEqual(['a', 'b']);
    startAttempt(state, 'a', at(200));
    expect(elapsedSeconds(state.attempts.a!, at(230))).toBe(120);
  });

  it('requires explicit valid reflection after Accepted and prevents bypassing it', () => {
    const state = activeState();
    expect(() => completeAttempt(state, 'a', { confidence: 'independent' }, at(30))).toThrow(
      /accepted/i,
    );
    recordSubmission(state, 'a', submission('ac', 'accepted', 60), at(60));
    expect(() => completeAttempt(state, 'a', {} as Reflection, at(90))).toThrow(/Choose/);
    expect(state.attempts.a?.status).toBe('accepted');
    expect(state.activities).toEqual({});
    expect(() => prepareAttempt(state, second, at(100), 'b')).toThrow(/reflection/i);
  });

  it.each(['detected', 'manual'] as const)(
    'focuses a %s solve of the previous problem and pauses the newer timer',
    (source) => {
      const state = activeState();
      prepareAttempt(state, second, at(60), 'b');
      startAttempt(state, 'b', at(90));
      const accepted = submission('late-ac', 'accepted', 120);
      if (source === 'detected') recordSubmission(state, 'a', accepted, at(120));
      else manualAccept(state, 'a', at(120));

      expect(state.activeAttemptId).toBe('a');
      expect(state.attempts.a).toMatchObject({
        status: 'accepted',
        activeSeconds: 60,
        completionSource: source,
      });
      expect(state.attempts.b).toMatchObject({ status: 'paused', activeSeconds: 30 });
      expect(state.attempts.b?.runningSince).toBeUndefined();
      expect(() => startAttempt(state, 'b', at(130))).toThrow(/reflection/i);
      expect(() => prepareAttempt(state, second, at(130))).toThrow(/reflection/i);

      completeAttempt(state, 'a', { confidence: 'assisted' }, at(150));
      startAttempt(state, 'b', at(150));
      expect(elapsedSeconds(state.attempts.b!, at(180))).toBe(60);
      expect(recordSubmission(state, 'a', accepted, at(180))).toBe(false);
      expect(state.activeAttemptId).toBe('b');
      expect(state.attempts.a?.confidence).toBe('assisted');
    },
  );

  it('blocks resuming another attempt when a pending reflection is absent from the active pointer', () => {
    const state = activeState();
    prepareAttempt(state, second, at(60), 'b');
    manualAccept(state, 'a', at(90));
    // A recovered older snapshot can have a missing or stale active pointer.
    delete state.activeAttemptId;
    expect(() => startAttempt(state, 'b', at(120))).toThrow(/reflection/i);
    expect(state.attempts.b?.status).toBe('ready');
    expect(state.attempts.b?.runningSince).toBeUndefined();
  });

  it('rejects decreasing hint counts and oversized reflection fields', () => {
    const state = activeState();
    state.attempts.a!.hintsUsed = 2;
    manualAccept(state, 'a', at(60));
    expect(() =>
      completeAttempt(state, 'a', { confidence: 'assisted', hintsUsed: 1 }, at(90)),
    ).toThrow(/Hint/);
    expect(() =>
      completeAttempt(state, 'a', { confidence: 'assisted', hintsUsed: 2.5 }, at(90)),
    ).toThrow(/Hint/);
    expect(() =>
      completeAttempt(state, 'a', { confidence: 'assisted', notes: 'x'.repeat(10_001) }, at(90)),
    ).toThrow(/invalid/);
    expect(state.attempts.a?.status).toBe('accepted');
  });

  it('ignores duplicate and unknown verdicts without losing a later valid Accepted', () => {
    const state = activeState();
    expect(recordSubmission(state, 'a', submission('pending', 'unknown', 30), at(30))).toBe(false);
    expect(recordSubmission(state, 'a', submission('wrong', 'wrong_answer', 60), at(60))).toBe(
      true,
    );
    expect(recordSubmission(state, 'a', submission('wrong', 'wrong_answer', 70), at(70))).toBe(
      false,
    );
    expect(recordSubmission(state, 'a', submission('pending', 'accepted', 90), at(90))).toBe(true);
    expect(state.attempts.a).toMatchObject({
      status: 'accepted',
      submissionCount: 2,
      activeSeconds: 90,
    });
  });

  it('serializes racing duplicate Accepted events and completions into one local result and sync job', async () => {
    const storage = new StorageService(new MemoryDriver());
    await storage.transaction((state) => {
      Object.assign(state, activeState());
      state.settings.github.enabled = true;
    });
    const accepted = { ...submission('ac', 'accepted', 60), code: 'print(1)', language: 'python3' };
    const recorded = await Promise.all(
      [0, 1, 2].map(() =>
        storage.transaction((state) => recordSubmission(state, 'a', accepted, at(60))),
      ),
    );
    expect(recorded).toEqual([true, false, false]);
    await Promise.all(
      [0, 1, 2].map(() =>
        storage.transaction((state) =>
          completeAttempt(state, 'a', { confidence: 'independent' }, at(90)),
        ),
      ),
    );
    const saved = await storage.read();
    expect(saved.attempts.a).toMatchObject({
      submissionCount: 1,
      activeSeconds: 60,
      status: 'completed',
    });
    expect(saved.activities[localDate(base)]?.attemptIds).toEqual(['a']);
    expect(saved.progress[first.id]?.attemptIds).toEqual(['a']);
    expect(Object.keys(saved.syncJobs)).toEqual(['a']);
    expect(saved.syncJobs.a?.status).toBe('pending');
  });

  it('keeps the original reflection and completion date on repeated completion calls', () => {
    const state = activeState();
    manualAccept(state, 'a', at(60));
    completeAttempt(state, 'a', { confidence: 'assisted', notes: 'Original' }, at(90));
    const snapshot = structuredClone(state);
    completeAttempt(
      state,
      'a',
      { confidence: 'independent', notes: 'Duplicate should not overwrite' },
      at(200_000),
    );
    expect(state).toEqual(snapshot);
  });

  it('preserves historical attempts and avoids counting same-day revisions twice', () => {
    const state = activeState();
    recordSubmission(state, 'a', submission('old-ac', 'accepted', 60), at(60));
    completeAttempt(state, 'a', { confidence: 'assisted' }, at(90));
    const original = structuredClone(state.attempts.a);
    expect(prepareAttempt(state, first, at(120), 'revision').kind).toBe('revision');
    startAttempt(state, 'revision', at(120));
    expect(
      recordSubmission(state, 'revision', submission('old-ac', 'accepted', 150), at(150)),
    ).toBe(false);
    expect(state.attempts.revision?.status).toBe('active');
    recordSubmission(state, 'revision', submission('new-ac', 'accepted', 180), at(180));
    completeAttempt(state, 'revision', { confidence: 'independent' }, at(200));
    expect(state.attempts.a).toEqual(original);
    expect(state.progress[first.id]?.attemptIds).toEqual(['a', 'revision']);
    expect(state.progress[first.id]).toMatchObject({
      successfulRevisions: 1,
      state: 'independent',
    });
    expect(state.activities[localDate(base)]?.attemptIds).toEqual(['a', 'revision']);
    expect(completedCount(state.activities[localDate(base)])).toBe(1);
  });

  it('preserves abandoned sessions when the user resets an attempt', () => {
    const state = activeState();
    abandonAttempt(state, 'a', at(60));
    expect(state.attempts.a).toMatchObject({ status: 'abandoned', activeSeconds: 60 });
    expect(state.progress[first.id]?.state).toBe('not_started');
    prepareAttempt(state, first, at(120), 'new');
    expect(state.progress[first.id]?.attemptIds).toEqual(['a', 'new']);
    expect(state.attempts.a?.status).toBe('abandoned');
  });

  it('keeps local completion usable without code or an enabled GitHub integration', () => {
    const state = activeState();
    state.settings.github.enabled = true;
    recordSubmission(state, 'a', submission('ac', 'accepted', 60), at(60));
    completeAttempt(state, 'a', { confidence: 'independent' }, at(90));
    expect(state.attempts.a?.status).toBe('completed');
    expect(state.syncJobs).toEqual({});
    expect(completedCount(state.activities[localDate(base)])).toBe(1);
  });

  it('attributes midnight-spanning attempts to the local completion date', () => {
    const beforeMidnight = new Date(2026, 9, 8, 23, 59);
    const afterMidnight = new Date(2026, 9, 9, 0, 1);
    const state = emptyState();
    prepareAttempt(state, first, beforeMidnight, 'a');
    startAttempt(state, 'a', beforeMidnight);
    manualAccept(state, 'a', afterMidnight);
    completeAttempt(state, 'a', { confidence: 'independent' }, afterMidnight);
    expect(state.activities['2026-10-08']).toBeUndefined();
    expect(state.activities['2026-10-09']?.problemIds).toEqual([first.id]);
    expect(state.attempts.a?.activeSeconds).toBe(120);
  });
});
