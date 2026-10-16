import { describe, expect, it } from 'vitest';
import { DailyQueueService } from '../src/services/DailyQueueService';
import type { AppState, Attempt, CurriculumProblem, ProblemProgress } from '../src/types';
import { localDate } from '../src/utils/date';

const now = new Date(2026, 9, 8, 15);
const problems: CurriculumProblem[] = ['a', 'b', 'c', 'd'].map((id, index) => ({
  id,
  order: index + 1,
  title: id,
  module: 'Arrays',
  platform: 'leetcode',
  problemUrl: `https://leetcode.com/problems/${id}/`,
}));
function fresh(): AppState {
  return {
    schemaVersion: 2,
    settings: {
      onboardingComplete: true,
      dailyGoal: 2,
      primaryLanguage: 'python',
      curriculumId: 'test',
      timerBehavior: 'manual',
      showPattern: true,
      revisionScheduling: true,
      debug: false,
      theme: 'dark',
      github: {
        enabled: false,
        repository: '',
        branch: 'main',
        autoCommit: false,
        includeMetadata: true,
        updateReadme: false,
      },
    },
    attempts: {},
    progress: {},
    activities: {},
    queues: {},
    syncJobs: {},
  };
}
function solved(
  problemId: string,
  confidence: 'independent' | 'assisted' | 'relearn',
  due = '2026-10-07',
): ProblemProgress {
  return {
    problemId,
    state: confidence,
    attemptIds: [],
    successfulRevisions: 0,
    lastConfidence: confidence,
    firstSolvedAt: '2026-09-01T12:00:00.000Z',
    revisionDueAt: due,
  };
}
function attempt(status: Attempt['status'], problemId = 'b'): Attempt {
  return {
    id: 'resume',
    curriculumId: 'test',
    problemId,
    kind: 'new',
    startedAt: now.toISOString(),
    status,
    activeSeconds: 42,
    submissionCount: 1,
    submissionIds: [],
    hintsUsed: 0,
    editorialViewed: false,
    solutionViewed: false,
  };
}

describe('DailyQueueService', () => {
  it('selects the first two unsolved problems in source order without mutating source data', () => {
    const state = fresh();
    const scrambled = [problems[3]!, problems[1]!, problems[0]!, problems[2]!];
    expect(
      DailyQueueService.generate(state, scrambled, now).items.map((item) => item.problemId),
    ).toEqual(['a', 'b']);
    expect(scrambled.map((problem) => problem.id)).toEqual(['d', 'b', 'a', 'c']);
    expect(state.queues).toEqual({});
  });

  it('prioritizes an important due revision, and reserves a slot for new progress', () => {
    const state = fresh();
    state.progress.a = solved('a', 'independent', '2026-08-01');
    state.progress.c = solved('c', 'relearn');
    state.progress.d = solved('d', 'assisted');
    expect(
      DailyQueueService.generate(state, problems, now).items.map(({ problemId, kind }) => [
        problemId,
        kind,
      ]),
    ).toEqual([
      ['c', 'revision'],
      ['b', 'new'],
    ]);
  });

  it('keeps completed slots stable instead of replacing them with more unsolved work', () => {
    const state = fresh();
    const queue = DailyQueueService.generate(state, problems, now);
    state.queues[localDate(now)] = queue;
    state.progress.a = solved('a', 'assisted');
    expect(DailyQueueService.generate(state, problems, now)).toEqual(queue);
    state.progress.b = solved('b', 'independent');
    expect(DailyQueueService.generate(state, problems, now)).toEqual(queue);
  });

  it('starts a fresh queue on the next local calendar day', () => {
    const state = fresh();
    state.queues['2026-10-07'] = {
      date: '2026-10-07',
      items: [{ problemId: 'a', kind: 'new', reason: 'old' }],
    };
    state.progress.a = solved('a', 'independent', '2026-11-01');
    expect(
      DailyQueueService.generate(state, problems, now).items.map((item) => item.problemId),
    ).toEqual(['b', 'c']);
  });

  it.each(['ready', 'active', 'paused', 'accepted'] as const)(
    'resumes an unfinished %s attempt',
    (status) => {
      const state = fresh();
      state.attempts.resume = attempt(status, 'c');
      state.activeAttemptId = 'resume';
      const queue = DailyQueueService.generate(state, problems, now);
      expect(queue.items.map((item) => item.problemId)).toEqual(['c', 'a']);
      if (status === 'accepted') expect(queue.items[0]!.reason).toContain('reflection');
    },
  );

  it('counts a resumed revision against the revision cap', () => {
    const state = fresh();
    state.attempts.resume = { ...attempt('paused', 'c'), kind: 'revision' };
    state.progress.c = solved('c', 'assisted');
    state.progress.d = solved('d', 'relearn');
    expect(
      DailyQueueService.generate(state, problems, now).items.map(({ problemId, kind }) => [
        problemId,
        kind,
      ]),
    ).toEqual([
      ['c', 'revision'],
      ['a', 'new'],
    ]);
  });

  it('does not confuse an in-progress revision with a new unsolved problem', () => {
    const state = fresh();
    state.progress.a = { ...solved('a', 'independent', '2026-12-01'), state: 'in_progress' };
    expect(
      DailyQueueService.generate(state, problems, now).items.map((item) => item.problemId),
    ).toEqual(['b', 'c']);
  });

  it('honors disabled revisions and avoids scheduling future revisions', () => {
    const state = fresh();
    state.progress.a = solved('a', 'relearn');
    state.settings.revisionScheduling = false;
    expect(
      DailyQueueService.generate(state, problems, now).items.map((item) => item.problemId),
    ).toEqual(['b', 'c']);
    state.settings.revisionScheduling = true;
    state.progress.a.revisionDueAt = '2026-10-09';
    expect(
      DailyQueueService.generate(state, problems, now).items.map((item) => item.problemId),
    ).toEqual(['b', 'c']);
  });

  it('chooses new curriculum work with a one-problem goal', () => {
    const state = fresh();
    state.settings.dailyGoal = 1;
    state.progress.a = solved('a', 'relearn');
    expect(
      DailyQueueService.generate(state, problems, now).items.map((item) => item.problemId),
    ).toEqual(['b']);
  });

  it('keeps one revision when the curriculum is complete and returns empty when nothing is due', () => {
    const state = fresh();
    problems.forEach((problem) => {
      state.progress[problem.id] = solved(problem.id, 'independent');
    });
    expect(DailyQueueService.generate(state, problems, now).items).toHaveLength(1);
    Object.values(state.progress).forEach((progress) => {
      progress.revisionDueAt = '2026-11-01';
    });
    expect(DailyQueueService.generate(state, problems, now).items).toHaveLength(0);
  });
});
