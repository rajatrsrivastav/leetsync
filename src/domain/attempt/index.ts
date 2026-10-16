import { codeFingerprint } from '../../services/ComplexityService';
import type {
  AppState,
  Attempt,
  CurriculumProblem,
  Reflection,
  SubmissionResult,
} from '../../types';
import { localDate } from '../../utils/date';
import { RevisionScheduler } from '../../services/RevisionScheduler';

export function elapsedSeconds(attempt: Attempt, now = new Date()): number {
  return Math.max(
    0,
    attempt.activeSeconds +
      (attempt.status === 'active' && attempt.runningSince
        ? Math.max(0, (now.getTime() - new Date(attempt.runningSince).getTime()) / 1000)
        : 0),
  );
}
function stop(attempt: Attempt, now: Date) {
  attempt.activeSeconds = elapsedSeconds(attempt, now);
  delete attempt.runningSince;
}
export function prepareAttempt(
  state: AppState,
  problem: CurriculumProblem,
  now = new Date(),
  id: string = crypto.randomUUID(),
): Attempt {
  const pending = Object.values(state.attempts).find((a) => a.status === 'accepted');
  if (pending && pending.problemId !== problem.id)
    throw new Error('Finish your accepted attempt’s reflection first.');
  const existing = Object.values(state.attempts).find(
    (a) =>
      a.problemId === problem.id && ['ready', 'active', 'paused', 'accepted'].includes(a.status),
  );
  const previous = state.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
  if (previous?.status === 'active' && previous.id !== existing?.id) {
    stop(previous, now);
    previous.status = 'paused';
  }
  if (existing) {
    state.activeAttemptId = existing.id;
    return existing;
  }
  const progress = state.progress[problem.id] ?? {
    problemId: problem.id,
    state: 'not_started',
    attemptIds: [],
    successfulRevisions: 0,
  };
  const attempt: Attempt = {
    id,
    curriculumId: state.settings.curriculumId,
    problemId: problem.id,
    kind: progress.firstSolvedAt ? 'revision' : 'new',
    startedAt: now.toISOString(),
    status: 'ready',
    activeSeconds: 0,
    submissionCount: 0,
    submissionIds: [],
    hintsUsed: 0,
    editorialViewed: false,
    solutionViewed: false,
    language: state.settings.primaryLanguage,
  };
  state.attempts[id] = attempt;
  progress.attemptIds.push(id);
  if (!progress.firstSolvedAt) progress.state = 'in_progress';
  state.progress[problem.id] = progress;
  state.activeAttemptId = id;
  return attempt;
}
export function startAttempt(state: AppState, id: string, now = new Date()) {
  const attempt = requireAttempt(state, id);
  if (!['ready', 'paused'].includes(attempt.status)) return;
  const previous = state.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
  if (Object.values(state.attempts).some((a) => a.status === 'accepted' && a.id !== id))
    throw new Error('Complete your pending reflection first.');
  if (previous?.status === 'active' && previous.id !== id) {
    stop(previous, now);
    previous.status = 'paused';
  }
  attempt.status = 'active';
  attempt.runningSince = now.toISOString();
  state.activeAttemptId = id;
}
export function pauseAttempt(state: AppState, id: string, now = new Date()) {
  const a = requireAttempt(state, id);
  if (a.status === 'active') {
    stop(a, now);
    a.status = 'paused';
  }
}
export function requireAttempt(state: AppState, id: string): Attempt {
  const attempt = state.attempts[id];
  if (!attempt) throw new Error('Attempt not found. Refresh and try again.');
  return attempt;
}
function focusReflection(state: AppState, attempt: Attempt, now: Date) {
  const other = state.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
  if (other && other.id !== attempt.id && other.status === 'active') {
    stop(other, now);
    other.status = 'paused';
  }
  state.activeAttemptId = attempt.id;
}
export function recordSubmission(
  state: AppState,
  id: string,
  result: SubmissionResult,
  now = new Date(),
): boolean {
  const a = requireAttempt(state, id);
  if (
    !['active', 'paused'].includes(a.status) ||
    a.submissionIds.includes(result.id) ||
    result.verdict === 'unknown'
  )
    return false;
  // A single LeetCode submission cannot complete two sessions, even after a reset or reload.
  if (
    Object.values(state.attempts).some(
      (other) => other.id !== id && other.submissionIds.includes(result.id),
    )
  )
    return false;
  a.submissionIds.push(result.id);
  a.submissionCount += 1;
  if (result.verdict === 'accepted') {
    stop(a, now);
    a.status = 'accepted';
    a.acceptedAt = now.toISOString();
    a.completionSource = 'detected';
    focusReflection(state, a, now);
    if (result.code && result.language) {
      a.code = result.code;
      a.codeProvenance = result.codeProvenance ?? 'legacy-unverified';
      if (result.codeProvenance === 'server-verified')
        a.verifiedSubmissionId = result.id.replace('leetcode:submission:', '');
      a.language = result.language;
    }
  }
  return true;
}
export function manualAccept(state: AppState, id: string, now = new Date()) {
  const a = requireAttempt(state, id);
  if (!['ready', 'active', 'paused'].includes(a.status)) return;
  stop(a, now);
  a.status = 'accepted';
  a.acceptedAt = now.toISOString();
  a.completionSource = 'manual';
  focusReflection(state, a, now);
}
export function completeAttempt(
  state: AppState,
  id: string,
  reflection: Reflection,
  now = new Date(),
): Attempt {
  const a = requireAttempt(state, id);
  if (a.status === 'completed') return a;
  if (a.status !== 'accepted')
    throw new Error('Record an accepted or manual solve before completing.');
  if (!['independent', 'assisted', 'relearn'].includes(reflection.confidence))
    throw new Error('Choose how this solve felt.');
  if (
    reflection.hintsUsed !== undefined &&
    (!Number.isInteger(reflection.hintsUsed) ||
      reflection.hintsUsed < a.hintsUsed ||
      reflection.hintsUsed > 999)
  )
    throw new Error('Hint count cannot decrease.');
  const originalCode = a.code,
    originalLanguage = a.language;
  for (const key of ['timeComplexity', 'spaceComplexity', 'notes', 'code', 'language'] as const) {
    const value = reflection[key];
    if (
      value !== undefined &&
      (typeof value !== 'string' || value.length > (key === 'code' ? 200_000 : 10_000))
    )
      throw new Error('Reflection is too large or invalid.');
    if (value !== undefined) a[key] = value;
  }
  if (reflection.codeConfirmed && a.code?.trim()) a.codeProvenance = 'user-confirmed';
  else if (a.code !== originalCode || a.language !== originalLanguage)
    a.codeProvenance = 'legacy-unverified';
  if (reflection.complexityAnalysis) {
    const analysis = reflection.complexityAnalysis;
    if (
      analysis.method !== 'local-heuristic' ||
      analysis.codeFingerprint !== codeFingerprint(a.code ?? '', a.language ?? '') ||
      JSON.stringify(analysis).length > 10000
    )
      throw new Error('Analyze the current source again before saving.');
    a.complexityAnalysis = analysis;
  }
  if (reflection.learning) {
    if (JSON.stringify(reflection.learning).length > 10000)
      throw new Error('Reflection is too large.');
    a.learning = reflection.learning;
  }
  a.confidence =
    reflection.confidence === 'independent' &&
    ((reflection.hintsUsed ?? a.hintsUsed) > 0 || a.editorialViewed || a.solutionViewed)
      ? 'assisted'
      : reflection.confidence;
  a.hintsUsed = reflection.hintsUsed ?? a.hintsUsed;
  a.status = 'completed';
  a.completedAt = now.toISOString();
  const p = state.progress[a.problemId]!;
  const schedule = state.settings.revisionScheduling
    ? new RevisionScheduler().schedule(a.confidence, p, now)
    : undefined;
  p.state = a.confidence;
  p.lastConfidence = a.confidence;
  p.firstSolvedAt ??= a.completedAt;
  p.lastSolvedAt = a.completedAt;
  if (a.activeSeconds > 0)
    p.bestTimeSeconds = Math.min(p.bestTimeSeconds ?? Infinity, a.activeSeconds);
  if (schedule) Object.assign(p, schedule);
  else delete p.revisionDueAt;
  const date = localDate(now);
  const activity = state.activities[date] ?? {
    date,
    goal: state.settings.dailyGoal,
    attemptIds: [],
    problemIds: [],
  };
  if (!activity.attemptIds.includes(id)) activity.attemptIds.push(id);
  if (!activity.problemIds.includes(a.problemId)) activity.problemIds.push(a.problemId);
  state.activities[date] = activity;
  if (state.activeAttemptId === id) delete state.activeAttemptId;
  if (
    state.settings.github.enabled &&
    state.settings.github.autoCommit &&
    a.code?.trim() &&
    ['server-verified', 'user-confirmed'].includes(a.codeProvenance ?? '') &&
    a.language
  ) {
    state.syncJobs[id] ??= {
      id,
      attemptId: id,
      status: 'pending',
      attempts: 0,
      updatedAt: now.toISOString(),
    };
  }
  return a;
}
export function abandonAttempt(state: AppState, id: string, now = new Date()) {
  const a = requireAttempt(state, id);
  if (['completed', 'abandoned'].includes(a.status)) return;
  stop(a, now);
  a.status = 'abandoned';
  if (state.activeAttemptId === id) delete state.activeAttemptId;
  const p = state.progress[a.problemId];
  if (p && !p.firstSolvedAt) p.state = 'not_started';
}
