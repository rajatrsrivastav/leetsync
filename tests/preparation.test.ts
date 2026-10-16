import { describe, expect, it } from 'vitest';
import {
  applyPreparationAction,
  defaultPreparation,
  generatePreparationPlan,
  preparationMetrics,
  studyElapsed,
  validatePreparation,
} from '../src/features/preparation/model';
import type {
  Lesson,
  PlanTask,
  PreparationAction,
  PreparationState,
  SubjectId,
} from '../src/features/preparation/types';
import { localDate } from '../src/utils/date';

const now = new Date(2026, 9, 15, 12);
const later = (seconds: number) => new Date(now.getTime() + seconds * 1000);
function lesson(id: string, subject: SubjectId = 'os', fields: Partial<Lesson> = {}): Lesson {
  return {
    id,
    subject,
    title: id,
    summary: '',
    minutes: 15,
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
    ...fields,
  };
}
const lessons: Lesson[] = [
  lesson('os-basics'),
  lesson('os-concurrency', 'os', { prerequisites: ['os-basics'] }),
  lesson('dbms-basics', 'dbms'),
  lesson('network-basics', 'networks'),
  lesson('sql-basics', 'sql', { roles: ['analyst'], minutes: 10 }),
  lesson('interview', 'interviews', { level: 'Interview' }),
  lesson('quiz', 'aptitude', {
    quiz: [
      { id: 'q1', prompt: 'One?', options: ['Yes', 'No'], answer: 0, explanation: 'Yes.' },
      { id: 'q2', prompt: 'Two?', options: ['Yes', 'No'], answer: 1, explanation: 'No.' },
    ],
  }),
];
const dsa: PlanTask[] = [1, 2].map((n) => ({
  id: `dsa:${n}`,
  problemId: `problem-${n}`,
  kind: 'dsa',
  title: `Coding ${n}`,
  subject: 'dsa',
  minutes: 20,
  reason: 'Existing Striver queue order',
}));
const act = (prep: PreparationState, action: PreparationAction, date = now) =>
  applyPreparationAction(prep, action, lessons, dsa, date);
function complete(prep: PreparationState, lessonId: string, sessionId: string, date = now) {
  act(prep, { type: 'prepStart', lessonId, sessionId }, date);
  act(
    prep,
    {
      type: 'prepComplete',
      sessionId,
      confidence: 'independent',
      reflection: 'Explained from recall.',
    },
    new Date(date.getTime() + 60_000),
  );
}

describe('Preparation persistence and transitions', () => {
  it('fills only absent fields and keeps opt-in AI context disabled by default', () => {
    expect(validatePreparation(undefined)).toEqual(defaultPreparation());
    expect(validatePreparation({ profile: { minutesPerDay: 90 } }).profile).toMatchObject({
      minutesPerDay: 90,
      aiContextOptIn: false,
    });
    expect(() => validatePreparation(null)).toThrow();
    expect(() => validatePreparation({ version: 2 })).toThrow('Unsupported');
    expect(() => validatePreparation({ sessions: null })).toThrow();
  });
  it('retains a running timer through serialization and a worker/browser restart', () => {
    const prep = defaultPreparation();
    act(prep, { type: 'prepStart', lessonId: 'os-basics', sessionId: 'saved' });
    const restored = validatePreparation(JSON.parse(JSON.stringify(prep)));
    expect(studyElapsed(restored.sessions.saved!, later(120))).toBe(120);
    act(restored, { type: 'prepPause', sessionId: 'saved' }, later(125));
    expect(restored.sessions.saved).toMatchObject({ status: 'paused', seconds: 125 });
    expect(studyElapsed(restored.sessions.saved!, later(300))).toBe(125);
    act(restored, { type: 'prepResume', sessionId: 'saved' }, later(300));
    expect(studyElapsed(restored.sessions.saved!, later(320))).toBe(145);
    expect(validatePreparation(JSON.parse(JSON.stringify(restored))).sessions.saved).toEqual(
      restored.sessions.saved,
    );
  });
  it('pauses the previous subject and resumes an unfinished session instead of duplicating it', () => {
    const prep = defaultPreparation();
    act(prep, { type: 'prepStart', lessonId: 'os-basics', sessionId: 'one' });
    act(prep, { type: 'prepStart', lessonId: 'dbms-basics', sessionId: 'two' }, later(60));
    expect(prep.sessions.one).toMatchObject({ status: 'paused', seconds: 60 });
    act(prep, { type: 'prepStart', lessonId: 'os-basics', sessionId: 'duplicate' }, later(120));
    expect(prep.activeSessionId).toBe('one');
    expect(prep.sessions.duplicate).toBeUndefined();
    expect(prep.sessions.two?.seconds).toBe(60);
    expect(validatePreparation(prep).activeSessionId).toBe('one');
  });
  it('enforces prerequisites and validates hostile or malformed command values', () => {
    const prep = defaultPreparation();
    expect(() =>
      act(prep, { type: 'prepStart', lessonId: 'os-concurrency', sessionId: 'locked' }),
    ).toThrow('prerequisite');
    expect(() =>
      act(prep, { type: 'prepStart', lessonId: 'missing', sessionId: 'unknown' }),
    ).toThrow('unavailable');
    expect(() =>
      act(prep, { type: 'prepStart', lessonId: 'os-basics', sessionId: '__proto__' }),
    ).toThrow('Invalid');
    expect(() =>
      act(prep, { type: 'prepProfile', profile: { ...prep.profile, minutesPerDay: 9 } }),
    ).toThrow();
    expect(() =>
      act(prep, { type: 'prepProfile', profile: { ...prep.profile, subjects: [] } }),
    ).toThrow();
    expect(() =>
      act(prep, { type: 'prepProfile', profile: { ...prep.profile, targetDate: '2026-02-30' } }),
    ).toThrow();
    expect(() =>
      act(prep, {
        type: 'prepProfile',
        profile: { ...prep.profile, aiContextOptIn: 'yes' as unknown as boolean },
      }),
    ).toThrow();
    complete(prep, 'os-basics', 'foundation');
    expect(() =>
      act(
        prep,
        { type: 'prepStart', lessonId: 'os-concurrency', sessionId: 'unlocked' },
        later(100),
      ),
    ).not.toThrow();
  });
  it('makes repeated start/completion requests idempotent and rejects ID collisions', () => {
    const prep = defaultPreparation();
    complete(prep, 'os-basics', 'one');
    const snapshot = structuredClone(prep);
    act(
      prep,
      { type: 'prepComplete', sessionId: 'one', confidence: 'relearn', reflection: 'duplicate' },
      later(100),
    );
    act(prep, { type: 'prepStart', lessonId: 'os-basics', sessionId: 'one' }, later(200));
    expect(prep).toEqual(snapshot);
    expect(() =>
      act(prep, { type: 'prepStart', lessonId: 'dbms-basics', sessionId: 'one' }),
    ).toThrow('already used');
    expect(() => act(prep, { type: 'prepResume', sessionId: 'one' })).toThrow('completed');
  });
  it('rejects corrupt records without mutating or replacing the source', () => {
    const prep = defaultPreparation();
    complete(prep, 'os-basics', 'one');
    const invalid = structuredClone(prep);
    invalid.sessions.one!.seconds = -1;
    expect(() => validatePreparation(invalid)).toThrow('study seconds');
    expect(invalid.sessions.one!.seconds).toBe(-1);
    const invalidReference = structuredClone(prep);
    invalidReference.progress['os-basics']!.sessionIds.push('lost');
    expect(() => validatePreparation(invalidReference)).toThrow('references');
    const invalidTimer = structuredClone(prep);
    invalidTimer.sessions.one!.runningSince = now.toISOString();
    expect(() => validatePreparation(invalidTimer)).toThrow('Timer');
  });
});

describe('Budgeted adaptive preparation plans', () => {
  it('keeps the DSA queue intact, balances selected subjects, and stays within the time budget', () => {
    const prep = defaultPreparation();
    prep.profile.subjects = ['dsa', 'os', 'dbms'];
    const queueBefore = structuredClone(dsa);
    const plan = generatePreparationPlan(prep, lessons, dsa, now);
    expect(plan.tasks.map((t) => t.subject)).toEqual(['dsa', 'os', 'dbms']);
    expect(plan.tasks[0]?.problemId).toBe('problem-1');
    expect(plan.tasks.reduce((total, task) => total + task.minutes, 0)).toBeLessThanOrEqual(60);
    expect(dsa).toEqual(queueBefore);
    expect(plan.tasks.some((task) => task.lessonId === 'os-concurrency')).toBe(false);
  });
  it('preserves supplied DSA ordering even if no other subjects are selected', () => {
    const prep = defaultPreparation();
    prep.profile.subjects = ['dsa'];
    expect(generatePreparationPlan(prep, lessons, dsa, now).tasks.map((t) => t.id)).toEqual([
      'dsa:1',
      'dsa:2',
    ]);
    prep.profile.minutesPerDay = 30;
    expect(generatePreparationPlan(prep, lessons, dsa, now).tasks.map((t) => t.id)).toEqual([
      'dsa:1',
    ]);
  });
  it('keeps an existing daily plan stable until explicitly refreshed', () => {
    const prep = defaultPreparation();
    act(prep, { type: 'prepPlan' });
    const saved = structuredClone(prep.plans[localDate(now)]);
    act(prep, {
      type: 'prepProfile',
      profile: { ...prep.profile, subjects: ['sql'], minutesPerDay: 10 },
    });
    act(prep, { type: 'prepPlan' });
    expect(prep.plans[localDate(now)]).toEqual(saved);
    act(prep, { type: 'prepPlan', refresh: true });
    expect(prep.plans[localDate(now)]?.tasks.map((t) => t.subject)).toEqual(['sql']);
    expect(prep.plans[localDate(now)]?.budget).toBe(10);
  });
  it('prioritizes explicit weakness, role, and near-term interview practice with visible reasons', () => {
    const prep = defaultPreparation();
    prep.profile.subjects = ['os', 'sql'];
    prep.profile.role = 'analyst';
    prep.profile.minutesPerDay = 15;
    expect(generatePreparationPlan(prep, lessons, [], now).tasks[0]?.lessonId).toBe('sql-basics');
    prep.profile.weakSubjects = ['os'];
    expect(generatePreparationPlan(prep, lessons, [], now).tasks[0]?.reason).toContain(
      'extra practice',
    );
    prep.profile.subjects = ['os', 'interviews'];
    prep.profile.weakSubjects = [];
    prep.profile.targetDate = localDate(later(5 * 86400));
    expect(generatePreparationPlan(prep, lessons, [], now).tasks[0]?.lessonId).toBe('interview');
    expect(generatePreparationPlan(prep, lessons, [], now).tasks[0]?.reason).toContain('timeline');
  });
  it('prioritizes due reviews, excludes fresh completed lessons, and preserves unlocked prerequisites', () => {
    const prep = defaultPreparation();
    prep.profile.subjects = ['os', 'dbms'];
    prep.profile.minutesPerDay = 15;
    complete(prep, 'os-basics', 'one');
    const fresh = generatePreparationPlan(prep, lessons, [], later(120));
    expect(fresh.tasks[0]?.lessonId).toBe('os-concurrency');
    const due = generatePreparationPlan(prep, lessons, [], later(31 * 86400));
    expect(due.tasks[0]).toMatchObject({ kind: 'review', lessonId: 'os-basics' });
    expect(due.tasks[0]?.reason).toContain('Spaced review');
  });
  it('never forces a task longer than the budget or assumes a scheduled prerequisite is completed', () => {
    const prep = defaultPreparation();
    prep.profile.minutesPerDay = 10;
    prep.profile.subjects = ['os'];
    expect(generatePreparationPlan(prep, lessons, dsa, now).tasks).toEqual([]);
    prep.profile.minutesPerDay = 60;
    expect(generatePreparationPlan(prep, lessons, [], now).tasks.map((t) => t.lessonId)).toEqual([
      'os-basics',
    ]);
  });
});

describe('Quiz evidence and honest revision analytics', () => {
  it('rejects quiz answers while paused and records only resumed timer time', () => {
    const prep = defaultPreparation();
    act(prep, { type: 'prepStart', lessonId: 'quiz', sessionId: 'timed-quiz' });
    act(prep, { type: 'prepPause', sessionId: 'timed-quiz' }, later(30));
    const paused = structuredClone(prep);
    expect(() =>
      act(
        prep,
        {
          type: 'prepAnswer',
          sessionId: 'timed-quiz',
          questionId: 'q1',
          answer: 0,
        },
        later(300),
      ),
    ).toThrow('Resume the study timer');
    expect(prep).toEqual(paused);
    act(prep, { type: 'prepResume', sessionId: 'timed-quiz' }, later(300));
    act(
      prep,
      { type: 'prepAnswer', sessionId: 'timed-quiz', questionId: 'q1', answer: 0 },
      later(310),
    );
    act(
      prep,
      { type: 'prepAnswer', sessionId: 'timed-quiz', questionId: 'q2', answer: 1 },
      later(315),
    );
    act(
      prep,
      {
        type: 'prepComplete',
        sessionId: 'timed-quiz',
        confidence: 'independent',
        reflection: '',
      },
      later(320),
    );
    expect(prep.sessions['timed-quiz']).toMatchObject({ seconds: 50, score: 2, total: 2 });
  });
  it('requires every answer, computes scores itself, and locks completed answers', () => {
    const prep = defaultPreparation();
    act(prep, { type: 'prepStart', lessonId: 'quiz', sessionId: 'quiz-one' });
    expect(() =>
      act(prep, {
        type: 'prepComplete',
        sessionId: 'quiz-one',
        confidence: 'independent',
        reflection: '',
      }),
    ).toThrow('every quiz');
    expect(() =>
      act(prep, { type: 'prepAnswer', sessionId: 'quiz-one', questionId: 'q1', answer: 2 }),
    ).toThrow();
    act(prep, { type: 'prepAnswer', sessionId: 'quiz-one', questionId: 'q1', answer: 0 });
    act(prep, { type: 'prepAnswer', sessionId: 'quiz-one', questionId: 'q2', answer: 0 });
    act(
      prep,
      { type: 'prepComplete', sessionId: 'quiz-one', confidence: 'independent', reflection: '' },
      later(300),
    );
    expect(prep.sessions['quiz-one']).toMatchObject({
      score: 1,
      total: 2,
      confidence: 'assisted',
      seconds: 300,
    });
    expect(prep.progress.quiz).toMatchObject({ confidence: 'assisted', intervalDays: 7 });
    expect(() =>
      act(prep, { type: 'prepAnswer', sessionId: 'quiz-one', questionId: 'q2', answer: 1 }),
    ).toThrow('locked');
    expect(validatePreparation(prep).sessions['quiz-one']?.score).toBe(1);
  });
  it('uses next-day relearning for weak recall and does not fabricate independent skill', () => {
    const prep = defaultPreparation();
    act(prep, { type: 'prepStart', lessonId: 'quiz', sessionId: 'q' });
    act(prep, { type: 'prepAnswer', sessionId: 'q', questionId: 'q1', answer: 1 });
    act(prep, { type: 'prepAnswer', sessionId: 'q', questionId: 'q2', answer: 0 });
    act(
      prep,
      { type: 'prepComplete', sessionId: 'q', confidence: 'independent', reflection: '' },
      later(60),
    );
    expect(prep.progress.quiz?.intervalDays).toBe(1);
    expect(preparationMetrics(prep, lessons, later(2 * 86400))).toMatchObject({
      completedLessons: 1,
      independentLessons: 0,
      dueReviews: 1,
      studyMinutes: 1,
    });
  });
  it('expands spacing only on a due independent review, with no double-completion inflation', () => {
    const prep = defaultPreparation();
    complete(prep, 'os-basics', 'one');
    complete(prep, 'os-basics', 'early', later(3600));
    expect(prep.progress['os-basics']).toMatchObject({ intervalDays: 30, independentReviews: 0 });
    complete(prep, 'os-basics', 'due', later(31 * 86400));
    expect(prep.progress['os-basics']).toMatchObject({ intervalDays: 60, independentReviews: 1 });
    act(
      prep,
      { type: 'prepComplete', sessionId: 'due', confidence: 'independent', reflection: '' },
      later(32 * 86400),
    );
    expect(prep.progress['os-basics']?.independentReviews).toBe(1);
    const metrics = preparationMetrics(prep, lessons, later(32 * 86400));
    expect(metrics.completedLessons).toBe(1);
    expect(metrics.subjects.find((s) => s.id === 'os')).toMatchObject({
      completed: 1,
      total: 2,
      coveragePercent: 50,
    });
  });
});
