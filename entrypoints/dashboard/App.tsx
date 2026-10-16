import { PreparationHub } from '../../src/features/preparation/PreparationHub';
import { PracticeInsights } from '../../src/components/dashboard/PracticeInsights';
import { BackupPanel } from '../../src/components/BackupPanel';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Flame,
  LayoutDashboard,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useAppState } from '../../src/hooks/useAppState';
import {
  Brand,
  Streak,
  ProgressBar,
  WeekGrid,
  NextCard,
  ErrorBanner,
  formatMinutes,
} from '../../src/components/ui';
import { Onboarding } from '../../src/components/Onboarding';
import { ActivityCalendar } from '../../src/components/dashboard/ActivityCalendar';
import { Curriculum } from '../../src/components/dashboard/Curriculum';
import { ProblemDialog } from '../../src/components/dashboard/ProblemDialog';
import { RevisionList } from '../../src/components/dashboard/RevisionList';
import { SettingsPage } from '../../src/components/dashboard/SettingsPage';
import { TopicMasteryPanel } from '../../src/components/dashboard/TopicMasteryPanel';
import { PageHeading, Stat } from '../../src/components/dashboard/shared';
import { curriculum } from '../../src/domain/curriculum/Striver180CurriculumProvider';
import { dashboardStats } from '../../src/domain/progress';
import { ProgressRepository } from '../../src/repositories/ProgressRepository';
import { localDate } from '../../src/utils/date';
import type { CurriculumProblem } from '../../src/types';

function useHash() {
  const [hash, setHash] = useState(location.hash.slice(1) || 'preparation');
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1) || 'preparation');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}
function openSection(section: string) {
  location.hash = section;
}
export function App() {
  const { state, error, busy, act } = useAppState(),
    hash = useHash();
  const [selected, setSelected] = useState<CurriculumProblem>();
  useEffect(() => {
    if (state) document.documentElement.dataset.theme = state.settings.theme;
  }, [state?.settings.theme]);
  useEffect(() => {
    if (hash.startsWith('problem/')) {
      try {
        setSelected(curriculum.getProblem(decodeURIComponent(hash.slice(8))));
      } catch {
        setSelected(undefined);
      }
    }
  }, [hash]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(undefined);
        if (location.hash.startsWith('#problem/')) openSection('preparation');
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  if (!state)
    return (
      <div className="main-content">
        <ErrorBanner message={error} />
        <div className="loading">Loading your journey…</div>
        {error && <BackupPanel act={act} busy={busy} />}
      </div>
    );
  if (!state.settings.onboardingComplete)
    return (
      <div>
        <ErrorBanner message={error} />
        <Onboarding state={state} act={act} busy={busy} />
        <BackupPanel state={state} act={act} busy={busy} />
      </div>
    );
  const section = hash.startsWith('problem/') ? 'curriculum' : hash,
    due = new ProgressRepository(state).due(),
    stats = dashboardStats(state, curriculum.getProblems());
  const todayGoal = state.activities[localDate()]?.goal ?? state.settings.dailyGoal;
  const start = (p: CurriculumProblem) => {
    const pending = Object.values(state.attempts).find(
      (a) => a.problemId === p.id && a.status === 'accepted',
    );
    if (p.platform !== 'leetcode' || pending) {
      setSelected(p);
      if (!pending) void act({ type: 'prepare', problemId: p.id });
    } else void act({ type: 'prepare', problemId: p.id, open: true });
  };
  return (
    <div className="app-shell">
      {state.recoveryNotice && <p role="alert">{state.recoveryNotice}</p>}
      <aside className="sidebar">
        <Brand />
        <span className="eyebrow" style={{ margin: '0 14px 14px', fontSize: 8 }}>
          YOUR WORKSPACE
        </span>
        <nav>
          {[
            ['preparation', 'Campus preparation', Target],
            ['overview', 'DSA overview', LayoutDashboard],
            ['curriculum', 'Curriculum', BookOpen],
            ['revisions', 'Revisions', RotateCcw],
            ['settings', 'Settings', SettingsIcon],
          ].map(([id, label, Icon]) => {
            const I = Icon as typeof LayoutDashboard;
            return (
              <button
                key={String(id)}
                className={`nav-item ${section === id ? 'active' : ''}`}
                onClick={() => openSection(String(id))}
              >
                <I size={16} />
                {String(label)}
                {id === 'revisions' && due.length > 0 && (
                  <span className="nav-count">{due.length}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="panel" style={{ padding: 15, marginBottom: 20 }}>
            <span className="eyebrow" style={{ fontSize: 8 }}>
              YOUR DSA COMMITMENT
            </span>
            <p style={{ fontSize: 13, color: 'var(--text)', margin: '8px 0' }}>
              A little progress.
              <br />
              Every single day.
            </p>
            <div className="flex justify-between small quiet" style={{ margin: '14px 0 8px' }}>
              <span>DSA today</span>
              <span>
                {stats.todayCompleted} / {todayGoal}
              </span>
            </div>
            <ProgressBar value={stats.todayCompleted} max={todayGoal} />
          </div>
          <span className="local-badge">
            <ShieldCheck size={13} />
            Your progress stays yours.
          </span>
          <p>Stored locally · DSACommit v0.1.0</p>
        </div>
      </aside>
      <main className="main-content">
        <div className="topbar">
          <span className="crumb">
            Workspace
            <ChevronRight size={12} />
            <span style={{ color: 'var(--text)' }}>
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </span>
          </span>
          <div className="flex items-center gap-5">
            <span>
              {new Date().toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <Streak state={state} />
          </div>
        </div>
        <ErrorBanner message={error} />
        {section === 'preparation' ? (
          <PreparationHub state={state} act={act} busy={busy} />
        ) : section === 'overview' ? (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">YOUR INTERVIEW JOURNEY</span>
                <h1>Consistency compounds.</h1>
                <p>One focused session at a time. You know what comes next.</p>
              </div>
              <span className="status-pill">{todayGoal} / DAY</span>
            </div>
            <div className="stat-grid">
              <Stat
                label="Current streak"
                value={stats.streak}
                unit="days"
                note={stats.streak ? 'Keep the momentum going.' : 'Your first streak starts today.'}
                icon={<Flame size={14} />}
              />
              <Stat
                label="Today’s progress"
                value={stats.todayCompleted}
                unit={`/ ${todayGoal}`}
                note={
                  stats.todayCompleted >= todayGoal
                    ? 'Daily commitment complete.'
                    : 'Meaningful solves, not just submissions.'
                }
                icon={<Target size={14} />}
              />
              <Stat
                label="This week"
                value={stats.thisWeekCompleted}
                unit={`/ ${stats.thisWeekGoal}`}
                note="Every session moves you forward."
                icon={<TrendingUp size={14} />}
              />
              <Stat
                label="Curriculum progress"
                value={stats.completed}
                unit={`/ ${stats.total}`}
                note="Striver’s SDE Pattern Sheet"
                icon={<BookOpen size={14} />}
              />
            </div>
            <div className="dashboard-grid">
              <div className="column">
                <NextCard state={state} busy={busy} onStart={start} />
                <section className="panel">
                  <div className="panel-header">
                    <h3>Your consistency, at a glance</h3>
                    <span className="small quiet">Last 26 weeks</span>
                  </div>
                  <ActivityCalendar state={state} />
                </section>
                <PracticeInsights state={state} problems={curriculum.getProblems()} />
                <TopicMasteryPanel
                  topics={stats.topics}
                  onViewCurriculum={() => openSection('curriculum')}
                />
              </div>
              <div className="column">
                <section className="panel">
                  <div className="panel-header">
                    <h3>The plan for today</h3>
                    <span className="tag">{todayGoal} PROBLEMS</span>
                  </div>
                  <p className="small">A clear next step. One less decision.</p>
                  <div className="queue-list">
                    {state.queues[localDate()]?.items.map((q, i) => {
                      const p = curriculum.getProblem(q.problemId)!;
                      const done = state.activities[localDate()]?.problemIds.includes(p.id);
                      return (
                        <div className={`queue-row ${done ? 'done' : ''}`} key={p.id}>
                          <span className="queue-number">
                            {done ? <Check size={13} /> : String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="queue-title">
                            {p.title}
                            <small>{q.kind === 'revision' ? 'Revision' : p.module}</small>
                          </span>
                          <button
                            className="icon-button"
                            aria-label={`Open ${p.title}`}
                            onClick={() => start(p)}
                          >
                            <ArrowUpRight size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-header">
                    <h3>This week</h3>
                    <span className="small quiet">{stats.thisWeekCompleted} solves</span>
                  </div>
                  <WeekGrid state={state} />
                </section>
                <section className="panel">
                  <div className="panel-header">
                    <h3>Ready for a revisit</h3>
                    <span className="tag">{due.length} DUE</span>
                  </div>
                  <RevisionList state={state} onStart={start} limit={3} />
                </section>
                <section className="panel">
                  <div className="panel-header">
                    <h3>Solve quality</h3>
                    <Code2 size={15} className="quiet" />
                  </div>
                  <div className="flex items-end gap-2">
                    <strong style={{ fontSize: 36, fontWeight: 500, lineHeight: 1 }}>
                      {stats.independentRate}%
                    </strong>
                    <span className="small quiet">independent solves</span>
                  </div>
                  <div className="solve-times">
                    {(['Easy', 'Medium', 'Hard'] as const).map((d) => (
                      <div key={d}>
                        {d}
                        <strong>
                          {stats.averageSolveTime[d] === null
                            ? '—'
                            : formatMinutes(stats.averageSolveTime[d]!)}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <p className="small">
                    Average active time. Only verified difficulty data is included; unknown
                    difficulty stays unclassified.
                  </p>
                </section>
              </div>
            </div>
          </>
        ) : section === 'curriculum' ? (
          <Curriculum state={state} onSelect={setSelected} />
        ) : section === 'revisions' ? (
          <>
            <PageHeading
              eyebrow="REMEMBER WHAT YOU LEARN"
              title="Make it stick."
              description="Spaced practice, chosen from your own solve history."
            />
            <section className="panel">
              <RevisionList state={state} onStart={start} />
            </section>
          </>
        ) : (
          <SettingsPage state={state} act={act} busy={busy} />
        )}
      </main>
      {selected && (
        <ProblemDialog
          state={state}
          act={act}
          busy={busy}
          problem={selected}
          onClose={() => {
            setSelected(undefined);
            if (hash.startsWith('problem/')) openSection('preparation');
          }}
        />
      )}
    </div>
  );
}
