import type { Confidence, ProblemProgress } from '../types';
import { addLocalDays } from '../utils/date';

export type RevisionSchedule = Required<
  Pick<ProblemProgress, 'revisionDueAt' | 'revisionIntervalDays' | 'successfulRevisions'>
>;

/** Pure scheduling policy. Dates advance by local calendar day across DST. */
export class RevisionScheduler {
  static schedule(
    confidence: Confidence,
    previousProgress?: ProblemProgress,
    now = new Date(),
  ): RevisionSchedule {
    const wasSolved = Boolean(
      previousProgress?.firstSolvedAt ||
      previousProgress?.lastSolvedAt ||
      (previousProgress && ['independent', 'assisted', 'relearn'].includes(previousProgress.state)),
    );
    const successfulRevisions =
      Math.max(0, previousProgress?.successfulRevisions ?? 0) +
      (wasSolved && confidence === 'independent' ? 1 : 0);
    let revisionIntervalDays =
      confidence === 'independent' ? 30 : confidence === 'assisted' ? 7 : 1;
    if (confidence === 'independent' && wasSolved) {
      revisionIntervalDays = Math.min(
        365,
        Math.max(30, previousProgress?.revisionIntervalDays ?? 30) * 2,
      );
    }
    return {
      revisionDueAt: addLocalDays(now, revisionIntervalDays).toISOString(),
      revisionIntervalDays,
      successfulRevisions,
    };
  }

  schedule(
    confidence: Confidence,
    previousProgress?: ProblemProgress,
    now = new Date(),
  ): RevisionSchedule {
    return RevisionScheduler.schedule(confidence, previousProgress, now);
  }
}
