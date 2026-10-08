import { ArrowRight, RotateCcw } from 'lucide-react';
import type { AppState, CurriculumProblem } from '../../types';
import { curriculum } from '../../domain/curriculum/Striver180CurriculumProvider';
import { ProgressRepository } from '../../repositories/ProgressRepository';
import { AttemptRepository } from '../../repositories/AttemptRepository';
import { Empty } from '../ui';

export function RevisionList({
  state,
  onStart,
  limit = Infinity,
}: {
  state: AppState;
  onStart: (p: CurriculumProblem) => void;
  limit?: number;
}) {
  const due = new ProgressRepository(state).due();
  if (!due.length)
    return (
      <Empty icon={<RotateCcw size={24} />}>
        Nothing due. Finish a problem and we’ll schedule the right time to revisit it.
      </Empty>
    );
  return (
    <>
      {due.slice(0, limit).map((p) => {
        const problem = curriculum.getProblem(p.problemId);
        if (!problem) return null;
        const a = new AttemptRepository(state)
          .forProblem(p.problemId)
          .find((a) => a.status === 'completed');
        return (
          <div className="revision-row" key={p.problemId}>
            <span className={`status-dot ${p.lastConfidence}`} />
            <div>
              <h4>{problem.title}</h4>
              <p>
                {problem.module} ·{' '}
                {a?.solutionViewed ? 'Solution viewed' : `${a?.hintsUsed ?? 0} hints`} · Due{' '}
                {new Date(p.revisionDueAt!).toLocaleDateString()}
              </p>
            </div>
            <button className="button ghost" onClick={() => onStart(problem)}>
              Retry
              <ArrowRight size={12} />
            </button>
          </div>
        );
      })}
    </>
  );
}
