import type { AppState } from '../../types';
import type { PlanTask, PreparationState } from './types';
import { curriculum } from '../../domain/curriculum';
import { localDate } from '../../utils/date';
export function preparationDsaTasks(state: AppState, now = new Date()): PlanTask[] {
  return (state.queues[localDate(now)]?.items ?? []).flatMap((item) => {
    const problem = curriculum.getProblem(item.problemId);
    if (!problem || state.activities[localDate(now)]?.problemIds.includes(problem.id)) return [];
    return [
      {
        id: `dsa:${problem.id}`,
        kind: 'dsa',
        problemId: problem.id,
        title: problem.title,
        subject: 'dsa',
        minutes: 25,
        reason: item.reason,
      },
    ] as PlanTask[];
  });
}
export function preparationTaskDone(task: PlanTask, state: AppState, date = localDate()): boolean {
  if (task.kind === 'dsa')
    return !!task.problemId && !!state.activities[date]?.problemIds.includes(task.problemId);
  return Object.values(state.preparation?.sessions ?? {}).some(
    (s) =>
      s.lessonId === task.lessonId &&
      s.status === 'completed' &&
      s.completedAt &&
      localDate(new Date(s.completedAt)) === date,
  );
}
export function studyContext(prep: PreparationState): string {
  if (!prep.profile.aiContextOptIn) throw new Error('Enable study-context export first.');
  return [
    'Act as a Socratic campus placement coach. Ask one question at a time. Do not reveal algorithms, MCQ answers, or complete solutions during active practice. State uncertainty and use official sources. This is self-reported study history, not proof of interview readiness.',
    `Target role: ${prep.profile.role}. Available minutes per day: ${prep.profile.minutesPerDay}.`,
    `Subjects: ${prep.profile.subjects.join(', ')}. Self-reported weak subjects: ${prep.profile.weakSubjects.join(', ') || 'not specified'}.`,
    `Target date: ${prep.profile.targetDate ?? 'not set'}.`,
    `Completed topics: ${
      Object.values(prep.progress)
        .filter((p) => p.lastCompletedAt)
        .map((p) => `${p.lessonId} (${p.confidence ?? 'unrated'})`)
        .join('; ') || 'none yet'
    }.`,
    'Start by asking what I can recall without help. Use a small example, then ask for a counterexample and an invariant. Suggest a revision based on evidence, not a fabricated score.',
  ].join('\n\n');
}
