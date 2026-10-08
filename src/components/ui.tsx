import type { ReactNode } from 'react';
import { ArrowUpRight, ArrowRight, Code2, Flame, Check, RotateCcw } from 'lucide-react';
import type { AppState, CurriculumProblem } from '../types';
import { currentStreak, weekDays } from '../domain/streak';
import { localDate } from '../utils/date';
import { curriculum } from '../domain/curriculum/Striver180CurriculumProvider';
import { isSolved } from '../services/DailyQueueService';
export const formatTime = (seconds: number) => {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
};
export const formatMinutes = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))}m`;
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Code2 size={20} />
      </span>
      <span>
        DSA<span className="text-accent">Commit</span>
        <small>SHOW UP. SOLVE. REPEAT.</small>
      </span>
    </div>
  );
}
export function Streak({ state }: { state: AppState }) {
  return (
    <span className="streak">
      <Flame size={16} />
      {currentStreak(state.activities)} <span>day streak</span>
    </span>
  );
}
export function ProgressBar({ value, max }: { value: number; max: number }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span style={{ width: `${Math.min(100, max ? (value / max) * 100 : 0)}%` }} />
    </div>
  );
}
export function WeekGrid({ state }: { state: AppState }) {
  const today = localDate();
  return (
    <div className="week-grid">
      {weekDays().map((day, i) => {
        const n = state.activities[day]?.problemIds.length ?? 0;
        const goal = state.activities[day]?.goal ?? state.settings.dailyGoal;
        return (
          <div key={day} className={day === today ? 'is-today' : ''}>
            <span>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
            <div className="week-dots" title={`${day}: ${n}/${goal}`}>
              {Array.from({ length: Math.min(goal, 4) }, (_, j) => (
                <i key={j} className={j < n ? 'filled' : ''} />
              ))}
            </div>
            <small>{day === today ? 'TODAY' : ' '}</small>
          </div>
        );
      })}
    </div>
  );
}
export function nextProblem(state: AppState): CurriculumProblem | undefined {
  const active = state.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
  if (active && !['completed', 'abandoned'].includes(active.status))
    return curriculum.getProblem(active.problemId);
  const item = state.queues[localDate()]?.items.find(
    (q) => !state.activities[localDate()]?.problemIds.includes(q.problemId),
  );
  return item
    ? curriculum.getProblem(item.problemId)
    : (curriculum.getNextProblem(state.progress) ?? undefined);
}
export function NextCard({
  state,
  onStart,
  busy,
  compact = false,
}: {
  state: AppState;
  onStart: (p: CurriculumProblem) => void;
  busy: boolean;
  compact?: boolean;
}) {
  const p = nextProblem(state),
    count = state.activities[localDate()]?.problemIds.length ?? 0,
    goal = state.activities[localDate()]?.goal ?? state.settings.dailyGoal;
  const active = state.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
  const revision = p && isSolved(state.progress[p.id]);
  return (
    <section className={`next-card ${compact ? 'compact' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="eyebrow">
          <i className="live-dot" />
          {count >= goal
            ? 'YOUR NEXT STEP'
            : `TODAY’S PROBLEM ${Math.min(count + 1, goal)} OF ${goal}`}
        </span>
        {p && (
          <span className="tag">
            {revision ? (
              <>
                <RotateCcw size={12} />
                Revision
              </>
            ) : (
              'NEXT UP'
            )}
          </span>
        )}
      </div>
      <h2>{p?.title ?? 'The sheet is complete.'}</h2>
      {p ? (
        <>
          <div className="problem-meta">
            {p.difficulty && (
              <span className={`difficulty ${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
            )}
            <span>{p.module}</span>
            {p.platform !== 'leetcode' && <span>Manual tracking</span>}
          </div>
          {state.settings.showPattern && p.pattern && <p className="pattern">{p.pattern}</p>}
          <div className="why-now">
            <span className="eyebrow">WHY THIS PROBLEM?</span>
            <p>
              {revision
                ? 'A little spaced practice goes a long way.'
                : `Keep moving through ${p.module}.`}
              <br />
              <span>
                Problem {p.order} / {curriculum.getProblems().length} · Striver 180
              </span>
            </p>
          </div>
          <button
            className="button primary start-button"
            disabled={busy}
            onClick={() => onStart(p)}
          >
            {active?.problemId === p.id
              ? active.status === 'accepted'
                ? 'Finish Reflection'
                : active.status === 'ready'
                  ? 'Open Problem'
                  : 'Resume Problem'
              : 'Start Problem'}
            <ArrowRight size={18} />
          </button>
          <p className="small quiet text-center">
            {count >= goal
              ? 'Daily goal reached. Extra practice is optional.'
              : 'Your timer starts when you’re ready.'}
          </p>
        </>
      ) : (
        <>
          <p>Your revisions are the next step. Keep your knowledge fresh.</p>
          <span className="text-accent">
            <Check size={16} /> All {curriculum.getProblems().length} problems completed
          </span>
        </>
      )}
    </section>
  );
}
export function Empty({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="empty-state">
      {icon}
      <p>{children}</p>
    </div>
  );
}
export function ErrorBanner({ message }: { message: string }) {
  return message ? (
    <div className="error-banner" role="alert">
      {message}
    </div>
  ) : null;
}
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
}
