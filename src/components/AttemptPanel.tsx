import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CircleCheck,
  Clock3,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { AppState, Attempt, CurriculumProblem, Guidance } from '../types';
import type { Command } from '../services/commands';
import { elapsedSeconds } from '../domain/attempt';
import { curriculum } from '../domain/curriculum';
import { completedCount } from '../domain/streak';
import { isSolved } from '../services/DailyQueueService';
import { localDate } from '../utils/date';
import { Reflection } from './Reflection';
import './attempt.css';

export type AttemptPanelProps = {
  state: AppState;
  problem: CurriculumProblem;
  act: (command: Command) => Promise<AppState | undefined>;
  busy: boolean;
  compact?: boolean;
};

export function findProblemAttempt(state: AppState, problemId: string): Attempt | undefined {
  const active = state.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
  if (active?.problemId === problemId && !['completed', 'abandoned'].includes(active.status))
    return active;
  const attempts = Object.values(state.attempts)
    .filter((attempt) => attempt.problemId === problemId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return (
    attempts.find((attempt) =>
      ['ready', 'active', 'paused', 'accepted'].includes(attempt.status),
    ) ??
    (isSolved(state.progress[problemId])
      ? attempts.find((attempt) => attempt.status === 'completed')
      : undefined)
  );
}

export function displayTime(seconds: number): string {
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  return `${hours ? `${hours}:` : ''}${String(Math.floor((rounded % 3600) / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

/** Original learning prompts; these are not TakeUForward editorial content. */
function guidanceFor(problem: CurriculumProblem): Guidance {
  return {
    pattern: problem.pattern ?? problem.module,
    questions: [
      'What does a tiny example tell you?',
      'What information must you keep as the input grows?',
      'Which operation does a straightforward approach repeat?',
    ],
    strongHint:
      'Write down a straightforward approach first. Identify its repeated work, then consider which data structure or invariant could let you reuse that work. Check your idea against an edge case before coding.',
  };
}

export function AttemptPanel({ state, problem, act, busy, compact }: AttemptPanelProps) {
  const attempt = findProblemAttempt(state, problem.id);
  const [now, setNow] = useState(() => new Date());
  const [helpLevel, setHelpLevel] = useState(0);
  const [resetConfirm, setResetConfirm] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    setHelpLevel(0);
    setResetConfirm(false);
  }, [attempt?.id, problem.id]);
  const today = localDate(now);
  const completed = completedCount(state.activities[today]);
  const goal = state.activities[today]?.goal ?? state.settings.dailyGoal;
  const guidance = guidanceFor(problem);
  const waiting = !attempt || attempt.status === 'completed' || attempt.status === 'abandoned';

  async function ensureAttempt(): Promise<Attempt | undefined> {
    if (attempt && ['ready', 'active', 'paused', 'accepted'].includes(attempt.status))
      return attempt;
    const next = await act({ type: 'prepare', problemId: problem.id });
    return next ? findProblemAttempt(next, problem.id) : undefined;
  }
  async function start() {
    const next = await ensureAttempt();
    if (next) await act({ type: 'start', attemptId: next.id });
  }
  async function manualComplete() {
    const next = await ensureAttempt();
    if (next) await act({ type: 'manualAccept', attemptId: next.id });
  }
  async function reset() {
    if (!attempt) return;
    const changed = await act({ type: 'abandon', attemptId: attempt.id });
    if (changed) await act({ type: 'prepare', problemId: problem.id });
    setResetConfirm(false);
  }
  async function hint(level: number) {
    if (!attempt || busy) return;
    if (await act({ type: 'hint', attemptId: attempt.id })) setHelpLevel(level);
  }
  async function externalHelp(type: 'editorial' | 'solution') {
    if (!attempt || busy) return;
    const updated = await act({ type, attemptId: attempt.id });
    if (updated)
      window.open(
        problem.platform === 'leetcode'
          ? `${problem.problemUrl.replace(/\/$/, '')}/${type === 'editorial' ? 'editorial' : 'solutions'}/`
          : (problem.sourceUrl ?? problem.problemUrl),
        '_blank',
        'noopener,noreferrer',
      );
  }

  if (attempt?.status === 'accepted')
    return <Reflection state={state} problem={problem} attempt={attempt} act={act} busy={busy} />;

  const nextItem = state.queues[today]?.items.find(
    (item) =>
      !state.activities[today]?.problemIds.includes(item.problemId) &&
      item.problemId !== problem.id,
  );
  const nextProblem = nextItem
    ? curriculum.getProblem(nextItem.problemId)
    : curriculum.getNextProblem(state.progress);
  const sync = attempt ? state.syncJobs[attempt.id] : undefined;

  return (
    <section
      className={`dsacommit-surface attempt-panel${compact ? ' attempt-compact' : ''}`}
      data-theme={state.settings.theme}
    >
      <div className="attempt-eyebrow">
        <span>{problem.module}</span>
        <span>
          {problem.order} / {curriculum.data.problems.length}
        </span>
      </div>
      <h2 className="attempt-title">{problem.title}</h2>
      <div className="attempt-badges">
        <span
          className={`attempt-difficulty attempt-difficulty-${problem.difficulty?.toLowerCase()}`}
        >
          {problem.difficulty ?? 'Difficulty unlisted'}
        </span>
        {attempt?.kind === 'revision' && <span>Revision</span>}
      </div>
      {state.settings.showPattern && problem.pattern && (
        <p className="attempt-pattern">{problem.pattern}</p>
      )}

      {attempt?.status === 'completed' ? (
        <div className="attempt-completed" role="status">
          <CircleCheck aria-hidden="true" size={26} />
          <h3>Problem complete.</h3>
          <p>
            {displayTime(attempt.activeSeconds)} active ·{' '}
            {attempt.confidence === 'assisted'
              ? 'Needed help'
              : attempt.confidence === 'relearn'
                ? 'Relearn'
                : 'Independent'}
          </p>
          <p className="attempt-sync">
            {sync?.status === 'synced'
              ? 'GitHub · committed'
              : sync?.status === 'failed'
                ? 'GitHub sync needs a retry in your dashboard. Your progress is saved.'
                : sync?.status === 'syncing' || sync?.status === 'pending'
                  ? 'GitHub · sync queued'
                  : state.settings.github.enabled && !attempt.code
                    ? 'Progress saved. No source was attached for GitHub.'
                    : 'Saved on this device.'}
          </p>
          {sync?.commitUrl && (
            <a className="attempt-text-link" href={sync.commitUrl} target="_blank" rel="noreferrer">
              View commit ↗
            </a>
          )}
          {completed >= goal && (
            <div className="attempt-goal-done">Today’s target complete. Nicely done.</div>
          )}
          {nextProblem && (
            <div className="attempt-next">
              <span>NEXT UP</span>
              <strong>{nextProblem.title}</strong>
              <button
                className="attempt-primary"
                disabled={busy}
                onClick={() => void act({ type: 'prepare', problemId: nextProblem.id, open: true })}
              >
                {completed < goal ? 'Start Next Problem' : 'Keep practicing'}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
          <button className="attempt-secondary" disabled={busy} onClick={() => void start()}>
            Practice this problem again
          </button>
        </div>
      ) : (
        <>
          <div className={`attempt-timer${attempt?.status === 'active' ? ' is-running' : ''}`}>
            <div>
              <Clock3 size={15} aria-hidden="true" />
              <span>
                {attempt?.status === 'active'
                  ? 'ACTIVE TIME'
                  : attempt?.status === 'paused'
                    ? 'TIMER PAUSED'
                    : 'READY WHEN YOU ARE'}
              </span>
            </div>
            <output aria-label="Active solve time">
              {displayTime(attempt ? elapsedSeconds(attempt, now) : 0)}
            </output>
          </div>
          <button
            className="attempt-primary"
            disabled={busy}
            onClick={() =>
              void (attempt?.status === 'active'
                ? act({ type: 'pause', attemptId: attempt.id })
                : start())
            }
          >
            {attempt?.status === 'active' ? (
              <Pause size={16} aria-hidden="true" />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
            {attempt?.status === 'active'
              ? 'Pause'
              : attempt?.status === 'paused'
                ? 'Resume Attempt'
                : 'Start Attempt'}
          </button>
          {!attempt || attempt.status === 'ready' ? (
            <p className="attempt-fineprint">Your timer starts when you choose Start Attempt.</p>
          ) : null}
          {attempt && (
            <>
              <div className="attempt-counters">
                <span>{attempt.submissionCount} submissions</span>
                <span>{attempt.hintsUsed} hints</span>
              </div>
              <div className="attempt-tools">
                <button
                  className="attempt-secondary"
                  disabled={busy}
                  onClick={() => void hint(helpLevel)}
                >
                  <Lightbulb size={15} aria-hidden="true" />
                  Hint +1
                </button>
                <button
                  className="attempt-secondary"
                  disabled={busy}
                  onClick={() => void externalHelp('solution')}
                >
                  <BookOpen size={15} aria-hidden="true" />
                  View solution ↗
                </button>
              </div>
              <details className="attempt-help">
                <summary>Progressive guidance</summary>
                <p className="attempt-fineprint">
                  DSACommit guidance · each reveal records one hint.
                </p>
                <div className="attempt-help-levels">
                  {[1, 2, 3].map((level) => (
                    <button
                      key={level}
                      className="attempt-secondary"
                      disabled={busy || helpLevel >= level}
                      onClick={() => void hint(level)}
                    >
                      {level === 1 ? 'Pattern' : level === 2 ? 'Questions' : 'Strong hint'}
                    </button>
                  ))}
                </div>
                {helpLevel >= 1 && (
                  <p>
                    <strong>Think about: {guidance.pattern}</strong>
                  </p>
                )}
                {helpLevel >= 2 && (
                  <ul>
                    {guidance.questions?.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                )}
                {helpLevel >= 3 && <p>{guidance.strongHint}</p>}
              </details>
              <div className="attempt-flags">
                <button
                  className="attempt-link-button"
                  disabled={busy}
                  onClick={() => void externalHelp('editorial')}
                >
                  {attempt.editorialViewed ? '✓ Editorial recorded · open ↗' : 'View editorial ↗'}
                </button>
                {attempt.solutionViewed && <span>✓ Solution recorded</span>}
              </div>
            </>
          )}
          <details className="attempt-manual">
            <summary>Completion not detected?</summary>
            <p className="attempt-fineprint">
              Use this after you’ve completed a real solve. You’ll still choose your confidence and
              save a reflection.
            </p>
            <button
              className="attempt-secondary"
              disabled={busy}
              onClick={() => void manualComplete()}
            >
              Record completed solve manually
            </button>
          </details>
          {attempt && !waiting && (
            <div className="attempt-reset">
              {resetConfirm ? (
                <>
                  <p>This ends the current session and keeps it in your history.</p>
                  <div className="attempt-tools">
                    <button
                      className="attempt-secondary"
                      disabled={busy}
                      onClick={() => void reset()}
                    >
                      Reset session
                    </button>
                    <button className="attempt-link-button" onClick={() => setResetConfirm(false)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="attempt-link-button"
                  disabled={busy}
                  onClick={() => setResetConfirm(true)}
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  Reset session
                </button>
              )}
            </div>
          )}
        </>
      )}
      <div className="attempt-today">
        <div>
          <span>TODAY</span>
          <strong>
            {completed} <span>/ {goal}</span>
          </strong>
        </div>
        <progress
          max={goal}
          value={Math.min(goal, completed)}
          aria-label={`${completed} of ${goal} daily problems complete`}
        />
      </div>
    </section>
  );
}
