import { describe, expect, it } from 'vitest';
import { masteryBreakdown, masteryScore } from '../src/domain/progress';
import type { Attempt, ProblemProgress } from '../src/types';

const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
  id: 'a',
  curriculumId: 'test',
  problemId: 'two-sum',
  kind: 'new',
  startedAt: '2026-10-08T12:00:00Z',
  completedAt: '2026-10-08T12:15:00Z',
  status: 'completed',
  activeSeconds: 900,
  confidence: 'independent',
  submissionCount: 1,
  submissionIds: ['one'],
  hintsUsed: 0,
  editorialViewed: false,
  solutionViewed: false,
  ...overrides,
});
const progress = (successfulRevisions: number): ProblemProgress => ({
  problemId: 'two-sum',
  state: 'independent',
  attemptIds: ['a'],
  successfulRevisions,
});

describe('explainable mastery score', () => {
  it('distinguishes independent, assisted, and relearn with equal completion', () => {
    expect(masteryScore(attempt())).toBe(80);
    expect(masteryScore(attempt({ confidence: 'assisted' }))).toBe(50);
    expect(masteryScore(attempt({ confidence: 'relearn' }))).toBe(20);
  });
  it('requires completed reflection instead of inferring mastery from Accepted', () => {
    expect(masteryScore(attempt({ status: 'accepted' }))).toBe(0);
    expect(masteryScore(attempt({ confidence: undefined }))).toBe(0);
    expect(masteryScore()).toBe(0);
  });
  it('explains penalties for hints, viewed content, time, and failed submissions', () => {
    const result = masteryBreakdown(
      attempt({
        hintsUsed: 2,
        editorialViewed: true,
        solutionViewed: true,
        submissionCount: 3,
        activeSeconds: 2400,
      }),
      undefined,
      'Easy',
    );
    expect(result).toEqual({
      score: 40,
      confidencePoints: 80,
      hintPenalty: 8,
      editorialPenalty: 8,
      solutionPenalty: 15,
      timePenalty: 5,
      failedSubmissionPenalty: 4,
      revisionBonus: 0,
    });
  });
  it('rewards independent retention without rewarding speed or failed repetitions', () => {
    expect(masteryScore(attempt(), progress(2))).toBe(90);
    expect(masteryScore(attempt({ activeSeconds: 1 }), progress(2), 'Easy')).toBe(90);
    expect(masteryScore(attempt({ confidence: 'assisted' }), progress(2))).toBe(50);
  });
  it('bounds scores at zero and one hundred even with extreme inputs', () => {
    expect(
      masteryScore(
        attempt({
          confidence: 'relearn',
          hintsUsed: 1000,
          editorialViewed: true,
          solutionViewed: true,
          submissionCount: 99,
          activeSeconds: 999999,
        }),
        progress(100),
        'Easy',
      ),
    ).toBe(0);
    expect(masteryScore(attempt(), progress(100))).toBe(100);
  });
});
