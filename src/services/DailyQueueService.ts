import type {
  AppState,
  Attempt,
  CurriculumProblem,
  DailyQueue,
  ProblemProgress,
  QueueItem,
} from '../types';
import { dateKeyFromTimestamp, isDueOnOrBefore, localDate } from '../utils/date';

export function isSolved(progress?: ProblemProgress): boolean {
  return Boolean(
    progress &&
    (progress.firstSolvedAt ||
      progress.lastSolvedAt ||
      ['independent', 'assisted', 'relearn'].includes(progress.state)),
  );
}

const unfinished = new Set<Attempt['status']>(['ready', 'active', 'paused', 'accepted']);
const revisionPriority = {
  relearn: 0,
  assisted: 1,
  independent: 2,
  in_progress: 2,
  not_started: 3,
};

export class DailyQueueService {
  /** Persist the returned queue: its slots stay fixed as the day's work is completed. */
  static generate(state: AppState, problems: CurriculumProblem[], now = new Date()): DailyQueue {
    const date = localDate(now);
    const goal = Math.max(
      1,
      Math.floor(state.activities[date]?.goal ?? state.settings.dailyGoal) || 2,
    );
    const ordered = [...problems].sort((a, b) => a.order - b.order);
    const validIds = new Set(ordered.map((problem) => problem.id));
    const items: QueueItem[] = [];
    const selected = new Set<string>();
    const add = (item: QueueItem) => {
      if (!selected.has(item.problemId) && validIds.has(item.problemId)) {
        items.push({ ...item });
        selected.add(item.problemId);
      }
    };

    // Do not recalculate completed slots out of the queue, including after midnight reloads.
    const existing = state.queues[date];
    if (existing?.date === date) existing.items.forEach(add);
    if (items.length >= goal) return { date, items };

    const attempts = Object.values(state.attempts)
      .filter((attempt) => unfinished.has(attempt.status) && validIds.has(attempt.problemId))
      .sort(
        (a, b) =>
          Number(b.id === state.activeAttemptId) - Number(a.id === state.activeAttemptId) ||
          b.startedAt.localeCompare(a.startedAt),
      );
    const resumable = attempts.find((attempt) => !selected.has(attempt.problemId));
    if (resumable) {
      add({
        problemId: resumable.problemId,
        kind: resumable.kind,
        reason:
          resumable.status === 'accepted'
            ? 'Finish your post-solve reflection'
            : 'Continue your unfinished attempt',
      });
    }

    const unsolved = ordered.filter(
      (problem) => !isSolved(state.progress[problem.id]) && !selected.has(problem.id),
    );
    const hasNewSlot = items.some((item) => item.kind === 'new');
    const reserveNew = !hasNewSlot && unsolved.length > 0 ? 1 : 0;
    const revisions = state.settings.revisionScheduling
      ? ordered
          .filter(
            (problem) =>
              isSolved(state.progress[problem.id]) &&
              !selected.has(problem.id) &&
              isDueOnOrBefore(state.progress[problem.id]?.revisionDueAt, now),
          )
          .sort((a, b) => {
            const left = state.progress[a.id]!;
            const right = state.progress[b.id]!;
            return (
              revisionPriority[left.lastConfidence ?? left.state] -
                revisionPriority[right.lastConfidence ?? right.state] ||
              (dateKeyFromTimestamp(left.revisionDueAt!) ?? '').localeCompare(
                dateKeyFromTimestamp(right.revisionDueAt!) ?? '',
              ) ||
              a.order - b.order
            );
          })
      : [];
    if (
      !items.some((item) => item.kind === 'revision') &&
      revisions[0] &&
      items.length < goal - reserveNew
    ) {
      const problem = revisions[0];
      const progress = state.progress[problem.id]!;
      const confidence = progress.lastConfidence ?? progress.state;
      add({
        problemId: problem.id,
        kind: 'revision',
        reason:
          confidence === 'relearn'
            ? 'Relearn this problem while it is fresh'
            : 'A spaced revision is due',
      });
    }
    for (const problem of unsolved) {
      if (items.length >= goal) break;
      add({
        problemId: problem.id,
        kind: 'new',
        reason: `Next in ${problem.module} · curriculum problem ${problem.order}`,
      });
    }
    return { date, items };
  }

  generate(state: AppState, problems: CurriculumProblem[], now = new Date()): DailyQueue {
    return DailyQueueService.generate(state, problems, now);
  }
}
