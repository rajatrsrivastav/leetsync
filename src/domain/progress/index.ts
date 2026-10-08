import type {
  AppState,
  Attempt,
  CurriculumProblem,
  Difficulty,
  ProblemProgress,
} from '../../types';
import { isSolved } from '../../services/DailyQueueService';
import { completedCount, currentStreak, weekDays, weeklyCompleted } from '../streak';
import { localDate } from '../../utils/date';

const confidencePoints = { independent: 80, assisted: 50, relearn: 20 };
const referenceMinutes: Record<Difficulty, number> = { Easy: 20, Medium: 40, Hard: 60 };

export type MasteryBreakdown = {
  score: number;
  confidencePoints: number;
  hintPenalty: number;
  editorialPenalty: number;
  solutionPenalty: number;
  timePenalty: number;
  failedSubmissionPenalty: number;
  revisionBonus: number;
};

/**
 * Evidence score, not a diagnosis of ability. Confidence contributes 20/50/80;
 * hints cost 4 (max 20), editorial 8, solution 15, extra submissions 2 (max 10).
 * Slow solves cost at most 10; fast solves get no bonus. Independent revisions
 * add 5 each (max 20). Only completed, explicitly reflected attempts qualify.
 */
export function masteryBreakdown(
  attempt?: Attempt,
  progress?: ProblemProgress,
  difficulty?: Difficulty,
): MasteryBreakdown {
  const empty: MasteryBreakdown = {
    score: 0,
    confidencePoints: 0,
    hintPenalty: 0,
    editorialPenalty: 0,
    solutionPenalty: 0,
    timePenalty: 0,
    failedSubmissionPenalty: 0,
    revisionBonus: 0,
  };
  if (!attempt || attempt.status !== 'completed' || !attempt.confidence) return empty;
  const timeRatio = difficulty
    ? Math.max(0, attempt.activeSeconds) / (referenceMinutes[difficulty] * 60)
    : 0;
  const result: MasteryBreakdown = {
    score: 0,
    confidencePoints: confidencePoints[attempt.confidence],
    hintPenalty: Math.min(20, Math.max(0, attempt.hintsUsed) * 4),
    editorialPenalty: attempt.editorialViewed ? 8 : 0,
    solutionPenalty: attempt.solutionViewed ? 15 : 0,
    timePenalty: Math.round(Math.min(10, Math.max(0, timeRatio - 1) * 5)),
    failedSubmissionPenalty: Math.min(10, Math.max(0, attempt.submissionCount - 1) * 2),
    revisionBonus:
      attempt.confidence === 'independent'
        ? Math.min(20, Math.max(0, progress?.successfulRevisions ?? 0) * 5)
        : 0,
  };
  result.score = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        result.confidencePoints +
          result.revisionBonus -
          result.hintPenalty -
          result.editorialPenalty -
          result.solutionPenalty -
          result.timePenalty -
          result.failedSubmissionPenalty,
      ),
    ),
  );
  return result;
}

export function masteryScore(
  attempt?: Attempt,
  progress?: ProblemProgress,
  difficulty?: Difficulty,
): number {
  return masteryBreakdown(attempt, progress, difficulty).score;
}

export function latestCompletedAttempt(state: AppState, problemId: string): Attempt | undefined {
  return Object.values(state.attempts)
    .filter((attempt) => attempt.problemId === problemId && attempt.status === 'completed')
    .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt))[0];
}

export type TopicMastery = {
  topic: string;
  total: number;
  completed: number;
  independent: number;
  coverage: number;
  mastery: number;
};

/** Scores are averaged across the topic; unattempted problems contribute zero evidence. */
export function topicMastery(state: AppState, problems: CurriculumProblem[]): TopicMastery[] {
  const topics = new Map<
    string,
    { total: number; completed: number; independent: number; score: number }
  >();
  for (const problem of problems) {
    const topic = topics.get(problem.module) ?? {
      total: 0,
      completed: 0,
      independent: 0,
      score: 0,
    };
    const progress = state.progress[problem.id];
    topic.total += 1;
    topic.completed += Number(isSolved(progress));
    topic.independent += Number((progress?.lastConfidence ?? progress?.state) === 'independent');
    if (isSolved(progress))
      topic.score += masteryScore(
        latestCompletedAttempt(state, problem.id),
        progress,
        problem.difficulty,
      );
    topics.set(problem.module, topic);
  }
  return [...topics].map(([topic, value]) => ({
    topic,
    total: value.total,
    completed: value.completed,
    independent: value.independent,
    coverage: Math.round((value.completed / value.total) * 100),
    mastery: Math.round(value.score / value.total),
  }));
}

export function dashboardStats(state: AppState, problems: CurriculumProblem[], now = new Date()) {
  const ids = new Set(problems.map((problem) => problem.id));
  const attempts = Object.values(state.attempts).filter(
    (attempt) => ids.has(attempt.problemId) && attempt.status === 'completed',
  );
  const averageSolveTime: Record<Difficulty, number | null> = {
    Easy: null,
    Medium: null,
    Hard: null,
  };
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  for (const difficulty of ['Easy', 'Medium', 'Hard'] as const) {
    // A manually marked problem without a timed attempt should not make averages look faster.
    const timed = attempts.filter(
      (attempt) =>
        byId.get(attempt.problemId)?.difficulty === difficulty && attempt.activeSeconds > 0,
    );
    averageSolveTime[difficulty] = timed.length
      ? Math.round(timed.reduce((sum, attempt) => sum + attempt.activeSeconds, 0) / timed.length)
      : null;
  }
  return {
    completed: problems.filter((problem) => isSolved(state.progress[problem.id])).length,
    total: problems.length,
    independentRate: attempts.length
      ? Math.round(
          (attempts.filter((attempt) => attempt.confidence === 'independent').length /
            attempts.length) *
            100,
        )
      : 0,
    averageSolveTime,
    topics: topicMastery(state, problems),
    streak: currentStreak(state.activities, now),
    todayCompleted: completedCount(state.activities[localDate(now)]),
    thisWeekCompleted: weeklyCompleted(state.activities, now),
    thisWeekGoal: weekDays(now).reduce(
      (sum, date) => sum + (state.activities[date]?.goal ?? state.settings.dailyGoal),
      0,
    ),
  };
}
