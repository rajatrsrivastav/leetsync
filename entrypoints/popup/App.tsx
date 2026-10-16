import { useEffect } from 'react';
import { ArrowUpRight, Settings, RotateCcw } from 'lucide-react';
import { useAppState } from '../../src/hooks/useAppState';
import {
  Brand,
  Streak,
  ProgressBar,
  WeekGrid,
  NextCard,
  ErrorBanner,
} from '../../src/components/ui';
import { Onboarding } from '../../src/components/Onboarding';
import { openDashboard } from '../../src/services/client';
import { curriculum } from '../../src/domain/curriculum/Striver180CurriculumProvider';
import { dashboardStats } from '../../src/domain/progress';
import { ProgressRepository } from '../../src/repositories/ProgressRepository';
import { localDate } from '../../src/utils/date';
export function App() {
  const { state, error, busy, act } = useAppState();
  useEffect(() => {
    if (state) document.documentElement.dataset.theme = state.settings.theme;
  }, [state?.settings.theme]);
  if (!state)
    return (
      <div className="popup">
        <ErrorBanner message={error} />
        <p className="loading">Loading your journey…</p>
      </div>
    );
  if (!state.settings.onboardingComplete)
    return (
      <div style={{ width: 380 }}>
        <ErrorBanner message={error} />
        <Onboarding state={state} act={act} busy={busy} />
      </div>
    );
  const stats = dashboardStats(state, curriculum.getProblems()),
    due = new ProgressRepository(state).due().length;
  const todayGoal = state.activities[localDate()]?.goal ?? state.settings.dailyGoal;
  return (
    <div className="popup">
      <header className="popup-header">
        <Brand />
        <Streak state={state} />
      </header>
      <ErrorBanner message={error} />
      <button
        className="button primary"
        style={{ width: '100%', margin: '12px 0' }}
        onClick={() => void openDashboard('preparation')}
      >
        Campus preparation <ArrowUpRight size={14} />
      </button>
      <div className="today-heading">
        <span className="eyebrow">A LITTLE BETTER, EVERY DAY</span>
        <strong>
          {stats.todayCompleted}
          <span> / {todayGoal}</span>
        </strong>
      </div>
      <ProgressBar value={stats.todayCompleted} max={todayGoal} />
      <NextCard
        compact
        state={state}
        busy={busy}
        onStart={(p) => {
          if (
            p.platform !== 'leetcode' ||
            (state.activeAttemptId && state.attempts[state.activeAttemptId]?.status === 'accepted')
          )
            void openDashboard(`problem/${encodeURIComponent(p.id)}`);
          else void act({ type: 'prepare', problemId: p.id, open: true });
        }}
      />
      <div className="curriculum-mini">
        <div className="flex justify-between items-center">
          <span className="small quiet">Striver 180</span>
          <span className="small">
            {stats.completed} <span className="quiet">/ {stats.total}</span>
          </span>
        </div>
        <ProgressBar value={stats.completed} max={stats.total} />
      </div>
      <div className="revision-mini">
        <span className="flex items-center gap-2">
          <RotateCcw size={13} />
          Revision due <span className="tag">{due}</span>
        </span>
        <button className="text-button" onClick={() => void openDashboard('revisions')}>
          View revisions
          <ArrowUpRight size={12} />
        </button>
      </div>
      <span className="eyebrow">THIS WEEK</span>
      <WeekGrid state={state} />
      <footer className="popup-footer">
        <button className="text-button" onClick={() => void openDashboard()}>
          Your dashboard
          <ArrowUpRight size={12} />
        </button>
        <button
          className="icon-button"
          aria-label="Settings"
          onClick={() => void openDashboard('settings')}
        >
          <Settings size={14} />
        </button>
      </footer>
    </div>
  );
}
