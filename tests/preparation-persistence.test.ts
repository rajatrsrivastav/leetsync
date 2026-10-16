import { describe, expect, it } from 'vitest';
import {
  CHECKPOINT_KEY,
  QUARANTINE_KEY,
  STATE_KEY,
  StorageService,
  emptyState,
  migrateState,
} from '../src/services/StorageService';
import { createBackup, mergeBackup, parseBackup } from '../src/services/BackupService';
import { completeAttempt, manualAccept, prepareAttempt, startAttempt } from '../src/domain/attempt';
import {
  applyPreparationAction,
  defaultPreparation,
  validatePreparation,
} from '../src/features/preparation/model';
import type { Lesson, PreparationState } from '../src/features/preparation/types';
import type { AppState } from '../src/types';
import { localDate } from '../src/utils/date';

const now = new Date('2026-10-15T10:00:00Z');
const later = (seconds: number) => new Date(+now + seconds * 1000);
const lessons = ['os', 'dbms'].map((id): Lesson => ({
  id,
  subject: id as 'os' | 'dbms',
  title: id,
  summary: '',
  minutes: 10,
  level: 'Foundation',
  prerequisites: [],
  roles: ['software'],
  concept: '',
  explanation: [],
  example: '',
  questions: [],
  practice: '',
  checkpoints: [],
  resources: [],
}));
function complete(prep: PreparationState, lessonId: string, sessionId: string, time = now) {
  applyPreparationAction(prep, { type: 'prepStart', lessonId, sessionId }, lessons, [], time);
  applyPreparationAction(
    prep,
    {
      type: 'prepComplete',
      sessionId,
      confidence: 'independent',
      reflection: 'Retain this reflection',
    },
    lessons,
    [],
    new Date(+time + 60_000),
  );
}
function prepared(): AppState {
  return { ...emptyState(), preparation: defaultPreparation() };
}
function backup(state: AppState, time = later(900)) {
  return parseBackup(JSON.stringify(createBackup(state, time)));
}
function completeDsa(state: AppState, problemId: string, attemptId: string, time = now) {
  prepareAttempt(
    state,
    {
      id: problemId,
      order: 1,
      title: problemId,
      module: 'Arrays',
      platform: 'leetcode',
      problemUrl: `https://leetcode.com/problems/${problemId}/`,
    },
    time,
    attemptId,
  );
  startAttempt(state, attemptId, time);
  manualAccept(state, attemptId, new Date(+time + 60_000));
  completeAttempt(
    state,
    attemptId,
    {
      confidence: 'independent',
      code: 'Retain my submitted code',
      language: 'python3',
      codeConfirmed: true,
    },
    new Date(+time + 120_000),
  );
}
function driver() {
  const data: Record<string, unknown> = {};
  let writes = 0;
  return {
    data,
    get writes() {
      return writes;
    },
    get: async (key: string) => ({ [key]: structuredClone(data[key]) }),
    set: async (items: Record<string, unknown>) => {
      writes += 1;
      Object.assign(data, structuredClone(items));
    },
  };
}

describe('Preparation migration and durable backup', () => {
  it('preserves existing schema 2 DSA history, settings, queue, timers, and GitHub outbox', () => {
    const state = emptyState();
    state.settings.github = { ...state.settings.github, enabled: true, repository: 'me/practice' };
    const problem = {
      id: 'p',
      order: 1,
      title: 'P',
      module: 'Arrays',
      platform: 'leetcode' as const,
      problemUrl: 'https://leetcode.com/problems/p/',
    };
    prepareAttempt(state, problem, now, 'solved');
    startAttempt(state, 'solved', now);
    manualAccept(state, 'solved', later(60));
    completeAttempt(
      state,
      'solved',
      {
        confidence: 'assisted',
        code: 'submitted source',
        language: 'python3',
        codeConfirmed: true,
        notes: 'Keep my note',
        learning: { invariant: 'Preserve previously visited values' },
      },
      later(120),
    );
    prepareAttempt(state, { ...problem, id: 'next' }, later(180), 'running');
    startAttempt(state, 'running', later(180));
    state.queues['2026-10-15'] = {
      date: '2026-10-15',
      items: [{ problemId: 'next', kind: 'new', reason: 'Next in Striver' }],
    };
    const before = structuredClone(state);
    expect(migrateState(JSON.parse(JSON.stringify(state)))).toEqual(before);
    const upgraded = migrateState(JSON.parse(JSON.stringify(state)));
    upgraded.preparation = defaultPreparation();
    complete(upgraded.preparation, 'os', 'study');
    const { preparation, ...dsa } = migrateState(upgraded);
    expect(dsa).toEqual(before);
    expect(preparation?.sessions.study?.status).toBe('completed');
    expect(state).toEqual(before);
  });

  it('round trips study history and plans, imports idempotently, and resets only fresh AI consent', () => {
    const source = prepared();
    const prep = source.preparation!;
    prep.profile = { ...prep.profile, minutesPerDay: 90, role: 'backend', aiContextOptIn: true };
    complete(prep, 'os', 'first');
    applyPreparationAction(prep, { type: 'prepPlan' }, lessons, [], later(120));
    const input = backup(source);
    expect(input.state.preparation).toEqual(prep);
    const imported = mergeBackup(emptyState(), input, later(1000));
    expect(imported.preparation).toEqual({
      ...prep,
      profile: { ...prep.profile, aiContextOptIn: false },
    });
    expect(mergeBackup(imported, input, later(2000))).toEqual(imported);
    expect(source.preparation?.profile.aiContextOptIn).toBe(true);
  });

  it('pauses imported active timers at export time and leaves an existing local timer running', () => {
    const source = prepared();
    applyPreparationAction(
      source.preparation!,
      { type: 'prepStart', lessonId: 'os', sessionId: 'imported' },
      lessons,
      [],
      now,
    );
    const local = prepared();
    applyPreparationAction(
      local.preparation!,
      { type: 'prepStart', lessonId: 'dbms', sessionId: 'local' },
      lessons,
      [],
      later(120),
    );
    const original = structuredClone(local.preparation!.sessions.local);
    const merged = mergeBackup(local, backup(source, later(60)), later(300));
    expect(merged.preparation!.sessions.imported).toMatchObject({ status: 'paused', seconds: 60 });
    expect(merged.preparation!.sessions.imported?.runningSince).toBeUndefined();
    expect(merged.preparation!.activeSessionId).toBe('local');
    expect(merged.preparation!.sessions.local).toEqual(original);
    expect(validatePreparation(merged.preparation)).toEqual(merged.preparation);
    expect(
      mergeBackup(emptyState(), backup(source, later(600)), later(30)).preparation!.sessions
        .imported?.seconds,
    ).toBe(30);
  });

  it('restores goals after a fresh dashboard initialized default preparation, without importing AI consent', () => {
    const source = prepared();
    source.preparation!.profile = {
      ...source.preparation!.profile,
      goal: 'Backend placement in November',
      role: 'backend',
      minutesPerDay: 90,
      targetDate: '2026-11-15',
      aiContextOptIn: true,
    };
    const target = prepared();
    target.preparation = validatePreparation(target.preparation);
    applyPreparationAction(target.preparation, { type: 'prepPlan' }, lessons, [], now);
    const merged = mergeBackup(target, backup(source));
    expect(merged.preparation!.profile).toEqual({
      ...source.preparation!.profile,
      aiContextOptIn: false,
    });
    expect(merged.preparation!.plans).toEqual(target.preparation.plans);
    expect(mergeBackup(merged, backup(source))).toEqual(merged);
    target.preparation.profile.goal = 'My deliberate local goal';
    expect(mergeBackup(target, backup(source)).preparation!.profile).toEqual(
      target.preparation.profile,
    );
  });

  it('uses newer review details only when the corresponding completed session was imported', () => {
    const local = prepared();
    complete(local.preparation!, 'os', 'local-completed');
    const incoming = prepared();
    complete(incoming.preparation!, 'os', 'new-completed', later(3600));
    const merged = mergeBackup(local, backup(incoming, later(4000)), later(5000));
    expect(merged.preparation!.progress.os).toEqual({
      ...incoming.preparation!.progress.os,
      sessionIds: ['local-completed', 'new-completed'],
    });
    expect(merged.preparation!.sessions['local-completed']).toEqual(
      local.preparation!.sessions['local-completed'],
    );
    expect(mergeBackup(merged, backup(incoming, later(4000)), later(6000))).toEqual(merged);
  });

  it('retains local progress when a newer completion ID collides, even if older history is imported', () => {
    const local = prepared();
    complete(local.preparation!, 'os', 'collision', later(3600));
    const incoming = prepared();
    complete(incoming.preparation!, 'os', 'older-new');
    complete(incoming.preparation!, 'os', 'collision', later(7200));
    const before = structuredClone(local);
    const merged = mergeBackup(local, backup(incoming, later(8000)), later(9000));
    expect(merged.preparation!.sessions.collision).toEqual(before.preparation!.sessions.collision);
    expect(merged.preparation!.progress.os).toEqual({
      ...before.preparation!.progress.os,
      sessionIds: ['collision', 'older-new'],
    });
    expect(local).toEqual(before);
  });

  it('does not attach colliding sessions from another lesson or invent unsupported progress', () => {
    const local = prepared();
    complete(local.preparation!, 'dbms', 'collision');
    const incoming = prepared();
    complete(incoming.preparation!, 'os', 'collision', later(3600));
    const merged = mergeBackup(local, backup(incoming, later(4000)), later(5000));
    expect(merged.preparation!.sessions.collision).toEqual(local.preparation!.sessions.collision);
    expect(merged.preparation!.progress.os).toEqual({
      lessonId: 'os',
      sessionIds: [],
      intervalDays: 0,
      independentReviews: 0,
    });
    expect(merged.preparation!.progress.dbms).toEqual(local.preparation!.progress.dbms);
    expect(validatePreparation(merged.preparation)).toEqual(merged.preparation);
    expect(mergeBackup(merged, backup(incoming, later(4000)), later(6000))).toEqual(merged);
  });

  it('preserves local preparation preferences and the current daily plan while merging history', () => {
    const local = prepared();
    local.preparation!.profile.minutesPerDay = 30;
    local.preparation!.profile.aiContextOptIn = true;
    applyPreparationAction(local.preparation!, { type: 'prepPlan' }, lessons, [], now);
    const incoming = prepared();
    incoming.preparation!.profile.minutesPerDay = 120;
    complete(incoming.preparation!, 'os', 'incoming');
    applyPreparationAction(incoming.preparation!, { type: 'prepPlan' }, lessons, [], later(120));
    const merged = mergeBackup(local, backup(incoming));
    expect(merged.preparation!.profile).toEqual(local.preparation!.profile);
    expect(merged.preparation!.plans).toEqual(local.preparation!.plans);
    expect(merged.preparation!.sessions.incoming).toBeDefined();
  });

  it('refuses future nested preparation schemas even with a valid checkpoint and explicit restore', async () => {
    const d = driver();
    const future = { ...emptyState(), preparation: { version: 2, futureHistory: ['retain'] } };
    d.data[STATE_KEY] = structuredClone(future);
    d.data[CHECKPOINT_KEY] = prepared();
    const storage = new StorageService(d);
    await expect(storage.read()).rejects.toThrow('Unsupported');
    await expect(
      storage.transaction((state) => {
        state.settings.dailyGoal = 3;
      }, true),
    ).rejects.toThrow('Unsupported');
    expect(d.data[STATE_KEY]).toEqual(future);
    expect(d.data[QUARANTINE_KEY]).toBeUndefined();
    expect(d.writes).toBe(0);
  });

  it('persists preparation and DSA together across worker instances without resetting either', async () => {
    const d = driver();
    const storage = new StorageService(d);
    await storage.transaction((state) => {
      state.settings.dailyGoal = 3;
      state.preparation = defaultPreparation();
      complete(state.preparation, 'os', 'saved');
    });
    const saved = await storage.read();
    expect(await new StorageService(d).read()).toEqual(saved);
    await new StorageService(d).transaction((state) => {
      applyPreparationAction(state.preparation!, { type: 'prepPlan' }, lessons, [], later(120));
    });
    const reloaded = await new StorageService(d).read();
    expect(reloaded.preparation!.sessions).toEqual(saved.preparation!.sessions);
    expect(reloaded.settings.dailyGoal).toBe(3);
  });
});

describe('DSA backup collision safety', () => {
  it('keeps local completion evidence when a newer same-problem ID collides, even if older attempts import', () => {
    const local = emptyState();
    local.settings.dailyGoal = 3;
    completeDsa(local, 'two-sum', 'collision', later(3600));
    const incoming = emptyState();
    incoming.settings.github.enabled = true;
    completeDsa(incoming, 'two-sum', 'older', now);
    completeDsa(incoming, 'two-sum', 'collision', later(7200));
    incoming.syncJobs.collision!.status = 'synced';
    incoming.syncJobs.collision!.commitUrl = 'https://github.com/example/repo/commit/123';
    const before = structuredClone(local);
    const input = backup(incoming, later(8000));
    const merged = mergeBackup(local, input, later(9000));
    expect(merged.attempts.collision).toEqual(before.attempts.collision);
    expect(merged.progress['two-sum']).toEqual({
      ...before.progress['two-sum'],
      attemptIds: ['collision', 'older'],
    });
    expect(merged.activities[localDate(now)]).toEqual({
      ...before.activities[localDate(now)],
      attemptIds: ['collision', 'older'],
    });
    expect(merged.syncJobs.collision).toBeUndefined();
    expect(merged.syncJobs.older).toMatchObject({ status: 'failed', attempts: 5 });
    expect(mergeBackup(merged, input, later(10000))).toEqual(merged);
    expect(local).toEqual(before);
  });

  it('rejects activity and progress claims from a collision with another problem without erasing legacy local activity', () => {
    const local = emptyState();
    completeDsa(local, 'local-problem', 'collision');
    local.activities['2026-10-01'] = {
      date: '2026-10-01',
      goal: 3,
      attemptIds: ['archived-attempt'],
      problemIds: ['archived-problem'],
    };
    const incoming = emptyState();
    incoming.settings.github.enabled = true;
    completeDsa(incoming, 'different-problem', 'collision', later(86400));
    incoming.syncJobs.collision!.status = 'synced';
    const merged = mergeBackup(local, backup(incoming, later(87000)), later(88000));
    expect(merged.attempts).toEqual(local.attempts);
    expect(merged.activities).toEqual(local.activities);
    expect(merged.progress['local-problem']).toEqual(local.progress['local-problem']);
    expect(merged.progress['different-problem']).toEqual({
      problemId: 'different-problem',
      state: 'not_started',
      attemptIds: [],
      successfulRevisions: 0,
    });
    expect(merged.syncJobs).toEqual({});
  });

  it('imports genuine new completions while filtering unrelated progress references and unsupported activity problems', () => {
    const source = emptyState();
    completeDsa(source, 'one', 'new-one');
    completeDsa(source, 'two', 'new-two', later(300));
    source.progress.one!.attemptIds.push('new-two');
    const date = localDate(now);
    source.activities[date]!.problemIds.push('invented-problem');
    source.activities[date]!.attemptIds.push('missing-attempt');
    const imported = mergeBackup(emptyState(), backup(source), later(1000));
    expect(imported.progress.one!.attemptIds).toEqual(['new-one']);
    expect(imported.progress.one!.lastSolvedAt).toBe(source.attempts['new-one']!.completedAt);
    expect(imported.activities[date]).toMatchObject({
      attemptIds: ['new-one', 'new-two'],
      problemIds: ['one', 'two'],
    });
    expect(mergeBackup(imported, backup(source), later(2000))).toEqual(imported);
  });

  it('ignores activity whose claimed problem differs from its newly imported completed attempt', () => {
    const source = emptyState();
    completeDsa(source, 'actual-problem', 'new-attempt');
    source.activities[localDate(now)]!.problemIds = ['different-problem'];
    const imported = mergeBackup(emptyState(), backup(source));
    expect(imported.attempts['new-attempt']?.status).toBe('completed');
    expect(imported.activities).toEqual({});
  });

  it('preserves valid legacy progress without lastSolvedAt on a collision-free fresh import', () => {
    const source = emptyState();
    completeDsa(source, 'legacy-problem', 'legacy-attempt');
    delete source.progress['legacy-problem']!.lastSolvedAt;
    const imported = mergeBackup(emptyState(), backup(source));
    expect(imported.progress['legacy-problem']).toEqual(source.progress['legacy-problem']);
    expect(imported.activities).toEqual(source.activities);
    expect(mergeBackup(imported, backup(source))).toEqual(imported);
  });
});
