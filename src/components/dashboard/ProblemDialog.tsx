import { SourceRecovery } from '../SourceRecovery';
import { useEffect } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { CurriculumProblem } from '../../types';
import { AttemptRepository } from '../../repositories/AttemptRepository';
import { AttemptPanel } from '../AttemptPanel';
import { ExternalLink, formatMinutes } from '../ui';
import type { DashboardProps } from './types';
import { progressLabels } from './shared';

export function ProblemDialog({
  state,
  act,
  busy,
  problem,
  onClose,
}: DashboardProps & { problem: CurriculumProblem; onClose: () => void }) {
  const history = new AttemptRepository(state).forProblem(problem.id);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const modal = document.querySelector('.modal');
      const items = modal?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input,textarea,select,summary',
      );
      if (!items?.length) return;
      const first = items[0]!,
        last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    const prev = document.activeElement as HTMLElement | null;
    document.querySelector<HTMLElement>('.modal .icon-button')?.focus();
    return () => {
      document.removeEventListener('keydown', handler);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="problem-title" className="modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              {problem.module} · PROBLEM {problem.order}
            </span>
            <h2 id="problem-title">{problem.title}</h2>
          </div>
          <button className="icon-button" aria-label="Close problem" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <ExternalLink href={problem.problemUrl}>Open problem</ExternalLink>
        <div style={{ marginTop: 15 }}>
          <AttemptPanel state={state} problem={problem} act={act} busy={busy} />
        </div>
        <div className="row-actions">
          {state.progress[problem.id]?.firstSolvedAt && (
            <button
              className="button ghost"
              disabled={busy}
              onClick={() => void act({ type: 'schedule', problemId: problem.id })}
            >
              <RotateCcw size={13} />
              Revise today
            </button>
          )}
          <button
            className="button danger ghost"
            disabled={busy || !state.progress[problem.id]}
            onClick={() => {
              if (
                confirm(
                  'Reset this problem’s curriculum status? Attempt history and past daily activity will be preserved.',
                )
              )
                void act({ type: 'resetProgress', problemId: problem.id });
            }}
          >
            Reset progress
          </button>
        </div>
        <div className="attempt-history">
          <h3>Previous attempts</h3>
          {history.length ? (
            history.map((a) => (
              <div className="history-row" key={a.id}>
                <div className="flex justify-between">
                  <span>{new Date(a.startedAt).toLocaleString()}</span>
                  <span className="tag">{a.kind}</span>
                </div>
                <p>
                  {a.status} {a.confidence && `· ${progressLabels[a.confidence]}`} ·{' '}
                  {formatMinutes(a.activeSeconds)} · {a.submissionCount} submissions · {a.hintsUsed}{' '}
                  hints
                </p>
                {a.notes && <p>{a.notes}</p>}
                {(a.timeComplexity || a.spaceComplexity) && (
                  <p>
                    User-reported complexity: time {a.timeComplexity || 'unknown'} · space{' '}
                    {a.spaceComplexity || 'unknown'}
                  </p>
                )}
                {a.complexityAnalysis && (
                  <p>
                    {a.complexityAnalysis.reviewed
                      ? 'Local observations reviewed by user'
                      : 'Local observations unreviewed'}{' '}
                    · not a proof
                  </p>
                )}
                <SourceRecovery attempt={a} state={state} act={act} busy={busy} />
                {a.code && (
                  <details>
                    <summary className="small quiet">Saved code · {a.language}</summary>
                    <pre>{a.code}</pre>
                  </details>
                )}
                {a.status === 'completed' && a.code && state.settings.github.enabled && (
                  <button
                    className="text-button small"
                    disabled={busy || state.syncJobs[a.id]?.status === 'synced'}
                    onClick={() => void act({ type: 'retrySync', attemptId: a.id })}
                  >
                    {state.syncJobs[a.id]?.status === 'synced'
                      ? 'Committed to GitHub'
                      : `Sync to GitHub${state.syncJobs[a.id]?.status === 'failed' ? ' · retry' : ''}`}
                  </button>
                )}
                {state.syncJobs[a.id]?.lastError && <p>{state.syncJobs[a.id]?.lastError}</p>}
              </div>
            ))
          ) : (
            <p className="small" style={{ marginTop: 12 }}>
              A fresh start. Your attempts will appear here.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
