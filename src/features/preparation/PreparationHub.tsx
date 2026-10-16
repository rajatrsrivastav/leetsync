import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  BookOpen,
  Brain,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import type { DashboardProps } from '../../components/dashboard/types';
import { TopicMasteryPanel } from '../../components/dashboard/TopicMasteryPanel';
import { curriculum } from '../../domain/curriculum';
import { dashboardStats } from '../../domain/progress';
import { ProgressRepository } from '../../repositories/ProgressRepository';
import { localDate, parseLocalDate } from '../../utils/date';
import { defaultPreparation, studyElapsed } from './model';
import { lessonById } from './catalog';
import { SUBJECTS, type SubjectId } from './types';
import { trackedResources, resourceById, type TrackedResource } from './resources';
import { latestResourceTopics, preparationActivity } from './tracking';
import {
  dueReviews,
  emptyRoadmap,
  ensureRoadmapDay,
  roadmapHistory,
  roadmapOutcomeProblem,
  roadmapProgress,
  roadmapTrackSummary,
  upcomingRoadmap,
} from './roadmap/model';
import {
  ROADMAP_TRACK_ORDER,
  practiceNote,
  roadmapTopicById,
  roadmapTopics,
} from './roadmap/topics';
import {
  ROADMAP_TRACKS,
  type RoadmapAssignment,
  type RoadmapPracticeResult,
  type RoadmapResponse,
  type RoadmapState,
  type RoadmapTopic,
  type RoadmapTrack,
  type RoadmapUnderstanding,
} from './roadmap/types';
import './preparation.css';
import './tracking.css';
import './roadmap.css';

type Tab = 'today' | 'upcoming' | 'progress' | 'library';
const TABS: [Tab, string][] = [
  ['today', 'Today'],
  ['upcoming', 'Upcoming'],
  ['progress', 'Progress'],
  ['library', 'Resource Library'],
];
const UNDERSTANDING: [RoadmapUnderstanding, string, string][] = [
  ['independent', 'Independent', 'I can explain it and answer follow-ups without the source.'],
  ['some-support', 'With some support', 'I understood it but needed the source to finish.'],
  ['needs-work', 'Needs work', 'I could not explain it yet.'],
];
const PRACTICE: [RoadmapPracticeResult, string][] = [
  ['completed', 'Completed'],
  ['partial', 'Partially done'],
  ['not-attempted', 'Not attempted'],
];
const formatDay = (key: string) =>
  parseLocalDate(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function PreparationHub({ state, act, busy }: DashboardProps) {
  const [tab, setTab] = useState<Tab>('today');
  const prep = state.preparation ?? defaultPreparation();
  const today = localDate();
  const roadmap: RoadmapState = prep.roadmap ?? emptyRoadmap();
  // Display today's task immediately; persistence happens through the worker once per day.
  const preview = structuredClone(roadmap);
  const assignment = ensureRoadmapDay(preview);
  const persisted = useRef('');
  useEffect(() => {
    if (!roadmap.days[today] && persisted.current !== today && assignment) {
      persisted.current = today;
      void act({ type: 'prepRoadmapToday' });
    }
  }, [roadmap.days[today], today, assignment, act]);
  const stats = dashboardStats(state, curriculum.getProblems());
  const goal = state.activities[today]?.goal ?? state.settings.dailyGoal;
  const upcoming = upcomingRoadmap(roadmap, new Date(), 10);
  const nextTopic = upcoming[0] ? roadmapTopicById(upcoming[0].topicId) : undefined;
  const openLink = (url: string, label: string, primary = false) => (
    <a
      className={`button ${primary ? 'primary' : ''}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
      <ExternalLink size={13} />
    </a>
  );
  return (
    <div className="preparation tracking roadmap">
      <header className="prep-header">
        <div>
          <span className="eyebrow">TODAY’S PREPARATION</span>
          <h1>
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </h1>
          <p>Two Striver problems plus one focused topic. Learn at the source, then practice.</p>
        </div>
        <span className="prep-local">{stats.streak} day DSA streak</span>
      </header>
      <nav className="prep-tabs" aria-label="Preparation sections">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'today' && (
        <TodayTab
          state={state}
          act={act}
          busy={busy}
          roadmap={roadmap}
          assignment={assignment}
          nextTopic={nextTopic}
          goal={goal}
          todayCompleted={stats.todayCompleted}
          openLink={openLink}
        />
      )}
      {tab === 'upcoming' && (
        <UpcomingTab roadmap={roadmap} upcoming={upcoming} openLink={openLink} />
      )}
      {tab === 'progress' && <ProgressTab state={state} act={act} busy={busy} roadmap={roadmap} />}
      {tab === 'library' && (
        <LibraryTab state={state} act={act} busy={busy} roadmap={roadmap} openLink={openLink} />
      )}
    </div>
  );
}

type LinkRenderer = (url: string, label: string, primary?: boolean) => ReactNode;

function TodayTab({
  state,
  act,
  busy,
  roadmap,
  assignment,
  nextTopic,
  goal,
  todayCompleted,
  openLink,
}: DashboardProps & {
  roadmap: RoadmapState;
  assignment: RoadmapAssignment | undefined;
  nextTopic: RoadmapTopic | undefined;
  goal: number;
  todayCompleted: number;
  openLink: LinkRenderer;
}) {
  const today = localDate();
  const prep = state.preparation;
  const active = prep?.activeSessionId ? prep.sessions[prep.activeSessionId] : undefined;
  const pendingDsa = (state.queues[today]?.items ?? []).filter(
    (item) => !state.activities[today]?.problemIds.includes(item.problemId),
  );
  const topic = assignment ? roadmapTopicById(assignment.topicId) : undefined;
  const response = assignment ? roadmap.responses[assignment.id] : undefined;
  const done = !!response && response.status !== 'draft';
  return (
    <>
      <section className="panel roadmap-dsa" aria-label="Today's DSA">
        <div className="roadmap-row-head">
          <div>
            <span className="eyebrow">DSA</span>
            <h2>
              {todayCompleted} / {goal} —{' '}
              {todayCompleted >= goal ? 'Striver goal complete' : 'Continue Striver'}
            </h2>
          </div>
          <a href="#overview" className="text-button">
            DSA overview →
          </a>
        </div>
        {pendingDsa.map((item, index) => {
          const problem = curriculum.getProblem(item.problemId);
          return (
            <div className="tracking-row" key={item.problemId}>
              <span>
                <strong>
                  {todayCompleted + index + 1}. {problem?.title ?? item.problemId}
                </strong>
                <small>
                  {item.kind === 'revision' ? 'Revision' : (problem?.module ?? 'Curriculum')} ·{' '}
                  {item.reason}
                </small>
              </span>
              <a className="button" href={`#problem/${encodeURIComponent(item.problemId)}`}>
                Open problem
                <ArrowUpRight size={13} />
              </a>
            </div>
          );
        })}
        {!pendingDsa.length && (
          <p className="small">
            {todayCompleted >= goal
              ? 'Today’s Striver problems are recorded. Revisions and the next problem are on the DSA overview.'
              : 'No queued problems yet. Open the DSA overview to generate today’s queue.'}
          </p>
        )}
      </section>
      {assignment && topic ? (
        <section className="panel roadmap-task" aria-label="Extra task">
          <div className="roadmap-row-head">
            <div>
              <span className="eyebrow">
                EXTRA TASK · {ROADMAP_TRACKS[topic.track]} · {topic.level} · ~{topic.minutes} min
                {assignment.kind === 'review' && (
                  <span className="tag">
                    <RotateCcw size={11} /> REVIEW
                  </span>
                )}
                {assignment.assignedOn < today && (
                  <span className="tag">
                    RESUMED FROM {formatDay(assignment.assignedOn).toUpperCase()}
                  </span>
                )}
              </span>
              <h2>{topic.title}</h2>
            </div>
            <BookmarkButton roadmap={roadmap} topicId={topic.id} act={act} busy={busy} />
          </div>
          <ol className="roadmap-steps">
            <li>
              <span className="roadmap-step-icon">
                <BookOpen size={16} />
              </span>
              <div>
                <h3>
                  Study ({topic.minutes - 10}–{topic.minutes} minutes)
                </h3>
                <p>
                  {topic.learn.source} › {topic.learn.label}
                </p>
                {openLink(topic.learn.url, 'Open exact section')}
              </div>
            </li>
            <li>
              <span className="roadmap-step-icon">
                <Brain size={16} />
              </span>
              <div>
                <h3>Practice · {topic.practice.kind}</h3>
                <p className="roadmap-prompt">{topic.practice.prompt}</p>
                <p>
                  {topic.practice.source} › {topic.practice.label}
                </p>
                {openLink(topic.practice.url, 'Open practice')}
                <small>{practiceNote(topic.practice.kind)}</small>
              </div>
            </li>
            <li>
              <span className="roadmap-step-icon">
                <CheckCircle2 size={16} />
              </span>
              <div>
                <h3>Complete</h3>
                {done ? (
                  <RecordedOutcome response={response} />
                ) : (
                  <CompletionForm
                    key={assignment.id}
                    assignment={assignment}
                    draft={response}
                    act={act}
                    busy={busy}
                  />
                )}
              </div>
            </li>
          </ol>
        </section>
      ) : (
        <section className="panel">
          <h2>Roadmap complete</h2>
          <p>
            Every topic is recorded and no review is due today. Reviews return as they fall due.
          </p>
        </section>
      )}
      <p className="roadmap-next">
        {nextTopic ? (
          <>
            <strong>Next:</strong> {nextTopic.title} · {ROADMAP_TRACKS[nextTopic.track]}
            {upcomingKind(roadmap, nextTopic.id) === 'review' ? ' · review' : ''}
          </>
        ) : (
          <>
            <strong>Next:</strong> nothing scheduled after today
          </>
        )}
      </p>
      {active && (
        <div className="prep-notice">
          <p>
            Previous study timer: {lessonById(active.lessonId)?.title ?? active.lessonId} ·{' '}
            {Math.floor(studyElapsed(active) / 60)} min
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() => void act({ type: 'prepPause', sessionId: active.id })}
          >
            Pause previous timer
          </button>
        </div>
      )}
    </>
  );
}

function upcomingKind(roadmap: RoadmapState, topicId: string) {
  return roadmapProgress(roadmap).some((p) => p.topicId === topicId) ? 'review' : 'new';
}

function BookmarkButton({
  roadmap,
  topicId,
  act,
  busy,
}: Pick<DashboardProps, 'act' | 'busy'> & { roadmap: RoadmapState; topicId: string }) {
  const saved = !!roadmap.bookmarks?.[topicId];
  const title = roadmapTopicById(topicId)?.title ?? topicId;
  return (
    <button
      className="text-button"
      aria-label={`Bookmark ${title}`}
      aria-pressed={saved}
      disabled={busy}
      onClick={() => void act({ type: 'prepRoadmapBookmark', topicId, bookmarked: !saved })}
    >
      <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}

function RecordedOutcome({ response }: { response: RoadmapResponse }) {
  return (
    <div className="roadmap-outcome" role="status">
      <strong>{response.status === 'completed' ? 'Completed' : 'Marked for revision'}</strong>
      <span>
        {UNDERSTANDING.find(([id]) => id === response.understanding)?.[1] ?? 'Not rated'} · practice{' '}
        {PRACTICE.find(([id]) => id === response.practiceResult)?.[1].toLowerCase()} ·{' '}
        {response.minutes} min
      </span>
      {response.notes && <p>{response.notes}</p>}
      <small>
        Recorded {new Date(response.recordedAt).toLocaleString()}.{' '}
        {response.status === 'revision'
          ? 'It returns tomorrow as a review.'
          : 'A spaced review will be scheduled.'}
      </small>
    </div>
  );
}

function CompletionForm({
  assignment,
  draft,
  act,
  busy,
}: Pick<DashboardProps, 'act' | 'busy'> & {
  assignment: RoadmapAssignment;
  draft: RoadmapResponse | undefined;
}) {
  const [understanding, setUnderstanding] = useState<RoadmapUnderstanding>(
    draft?.understanding ?? 'not-rated',
  );
  const [practice, setPractice] = useState<RoadmapPracticeResult>(
    draft?.practiceResult ?? 'not-attempted',
  );
  const [minutes, setMinutes] = useState(String(draft?.minutes ?? ''));
  const [notes, setNotes] = useState(draft?.notes ?? '');
  const [notice, setNotice] = useState('');
  const base = { understanding, practiceResult: practice };
  const completeProblem = roadmapOutcomeProblem({ ...base, status: 'completed' });
  const revisionProblem = roadmapOutcomeProblem({ ...base, status: 'revision' });
  const submit = async (status: RoadmapResponse['status']) => {
    const result = await act({
      type: 'prepRoadmapRecord',
      response: {
        assignmentId: assignment.id,
        topicId: assignment.topicId,
        status,
        understanding,
        practiceResult: practice,
        minutes: Math.min(1440, Math.max(0, Math.round(Number(minutes) || 0))),
        notes: notes.trim(),
      },
    });
    if (result) setNotice(status === 'draft' ? 'Draft saved locally.' : 'Recorded locally.');
  };
  return (
    <form className="roadmap-form" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>Understanding</legend>
        {UNDERSTANDING.map(([id, label, hint]) => (
          <label key={id} className="prep-optin">
            <input
              type="radio"
              name="understanding"
              value={id}
              checked={understanding === id}
              onChange={() => setUnderstanding(id)}
            />
            <span>
              {label}
              <small>{hint}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Practice result</legend>
        {PRACTICE.map(([id, label]) => (
          <label key={id} className="prep-optin">
            <input
              type="radio"
              name="practice"
              value={id}
              checked={practice === id}
              onChange={() => setPractice(id)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <div className="roadmap-form-row">
        <label>
          Time spent (minutes)
          <input
            type="number"
            min="0"
            max="1440"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="25"
          />
        </label>
        <label>
          Notes (what you learned, what to revisit)
          <textarea
            value={notes}
            maxLength={5000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>
      {notice && <p role="status">{notice}</p>}
      <div className="tracking-actions">
        <button
          className="button primary"
          disabled={busy || !!completeProblem}
          title={completeProblem}
          onClick={() => void submit('completed')}
        >
          Mark completed
        </button>
        <button
          className="button"
          disabled={busy || !!revisionProblem}
          title={revisionProblem}
          onClick={() => void submit('revision')}
        >
          Need revision
        </button>
        <button className="button ghost" disabled={busy} onClick={() => void submit('draft')}>
          Save draft
        </button>
      </div>
      <small>
        {completeProblem ??
          'Completed schedules a spaced review; revision brings the topic back tomorrow. Outcomes are final; drafts can be changed.'}
      </small>
    </form>
  );
}

function UpcomingTab({
  roadmap,
  upcoming,
  openLink,
}: {
  roadmap: RoadmapState;
  upcoming: ReturnType<typeof upcomingRoadmap>;
  openLink: LinkRenderer;
}) {
  const due = dueReviews(roadmap, localDate());
  return (
    <>
      <section className="panel">
        <div className="roadmap-row-head">
          <div>
            <h2>Next ten extra tasks</h2>
            <p className="small">
              Projected from the roadmap order and your recorded outcomes. A revision or a due
              review changes the sequence.
            </p>
          </div>
        </div>
        {upcoming.map((item) => {
          const topic = roadmapTopicById(item.topicId);
          if (!topic) return null;
          return (
            <div className="tracking-row roadmap-upcoming" key={`${item.date}:${item.topicId}`}>
              <span className="roadmap-date">{formatDay(item.date)}</span>
              <span>
                <strong>{topic.title}</strong>
                <small>
                  {ROADMAP_TRACKS[topic.track]} · {topic.level} · {topic.practice.kind}
                  {item.kind === 'review' ? ' · review' : ''}
                </small>
              </span>
              {openLink(topic.learn.url, 'Preview')}
            </div>
          );
        })}
        {!upcoming.length && <p>No further tasks are scheduled.</p>}
      </section>
      <section className="panel">
        <h2>Reviews due</h2>
        {due.map((p) => {
          const topic = roadmapTopicById(p.topicId);
          return (
            <div className="tracking-row" key={p.topicId}>
              <span>
                <strong>{topic?.title ?? p.topicId}</strong>
                <small>
                  {p.status === 'revision' ? 'Marked for revision' : 'Spaced review'} · due{' '}
                  {formatDay(p.dueOn)}
                </small>
              </span>
              {topic && openLink(topic.learn.url, 'Study')}
            </div>
          );
        })}
        {!due.length && (
          <p className="small">Nothing is due. Reviews appear here as they fall due.</p>
        )}
      </section>
    </>
  );
}

function ProgressTab({ state, act, busy, roadmap }: DashboardProps & { roadmap: RoadmapState }) {
  const [period, setPeriod] = useState(7);
  const prep = state.preparation ?? defaultPreparation();
  const stats = dashboardStats(state, curriculum.getProblems());
  const due = new ProgressRepository(state).due().length;
  const goal = state.activities[localDate()]?.goal ?? state.settings.dailyGoal;
  const summary = roadmapTrackSummary(roadmap);
  const completedTopics = Object.values(summary).reduce((n, t) => n + t.completed, 0);
  const history = roadmapHistory(roadmap);
  const activity = preparationActivity(state, period);
  const month = preparationActivity(state, 30);
  const entries = Object.values(prep.resourceTracking?.entries ?? {}).sort(
    (a, b) => Date.parse(b.studiedAt) - Date.parse(a.studiedAt),
  );
  const todayActivity = activity[activity.length - 1]!;
  return (
    <>
      <div className="prep-metrics">
        <Metric label="DSA solved" value={`${stats.completed} / ${stats.total}`} />
        <Metric
          label="Today’s DSA goal"
          value={`${stats.todayCompleted} / ${goal}`}
          note={`${due} revisions due`}
        />
        <Metric
          label="Extra topics completed"
          value={`${completedTopics} / ${roadmapTopics.length}`}
          note={`${Object.values(summary).reduce((n, t) => n + t.revision, 0)} marked for revision`}
        />
        <Metric
          label="Study minutes, last 30 days"
          value={String(month.reduce((n, d) => n + d.minutes, 0))}
          note={`${todayActivity.minutes} / ${prep.profile.minutesPerDay} min today`}
        />
      </div>
      <section className="panel">
        <h2>Topic progress by track</h2>
        <div className="roadmap-tracks">
          {ROADMAP_TRACK_ORDER.map((track) => {
            const row = summary[track];
            const next = row.next ? roadmapTopicById(row.next) : undefined;
            return (
              <div className="roadmap-track" key={track}>
                <div className="roadmap-row-head">
                  <strong>{ROADMAP_TRACKS[track]}</strong>
                  <span className="small quiet">
                    {row.completed} / {row.total}
                    {row.revision ? ` · ${row.revision} revising` : ''}
                    {row.due ? ` · ${row.due} due` : ''}
                  </span>
                </div>
                <div className="prep-meter">
                  <i style={{ width: `${row.total ? (row.completed / row.total) * 100 : 0}%` }} />
                </div>
                <small>{next ? `Next: ${next.title}` : 'All topics recorded'}</small>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel prep-prose">
        <div className="prep-panel-heading">
          <h2>Preparation activity</h2>
          <div className="tracking-period">
            <button className={period === 7 ? 'active' : ''} onClick={() => setPeriod(7)}>
              Last 7 days
            </button>
            <button className={period === 30 ? 'active' : ''} onClick={() => setPeriod(30)}>
              Last 30 days
            </button>
          </div>
        </div>
        <p>
          {activity.reduce((n, d) => n + d.solves, 0)} DSA solves ·{' '}
          {activity.reduce((n, d) => n + d.tasks, 0)} extra tasks recorded ·{' '}
          {activity.reduce((n, d) => n + d.minutes, 0)} study minutes
        </p>
        <div className="tracking-activity" aria-label="Daily preparation activity">
          {activity.map((d) => (
            <div
              key={d.date}
              className={d.solves + d.studies ? 'has-activity' : ''}
              title={`${d.date}: ${d.solves} DSA solves, ${d.studies} study records, ${d.minutes} minutes`}
            >
              <strong>{d.solves + d.studies}</strong>
              <small>{d.date.slice(5)}</small>
            </div>
          ))}
        </div>
        <form
          className="tracking-goal"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void act({
              type: 'prepProfile',
              profile: { ...prep.profile, minutesPerDay: Number(data.get('minutes')) },
            });
          }}
        >
          <label>
            Daily study goal (minutes)
            <input
              key={prep.profile.minutesPerDay}
              name="minutes"
              type="number"
              min="10"
              max="480"
              required
              defaultValue={prep.profile.minutesPerDay}
            />
          </label>
          <button className="button" disabled={busy}>
            Save goal
          </button>
        </form>
        <p className="small">
          Activity counts recorded outcomes, study entries, and DSA solves. Opening links records
          nothing.
        </p>
      </section>
      <div className="tracking-columns">
        <section className="panel prep-prose">
          <h2>Extra task history</h2>
          {history.slice(0, 12).map((r) => {
            const topic = roadmapTopicById(r.topicId);
            return (
              <div className="tracking-row" key={r.assignmentId}>
                <span>
                  {topic?.title ?? r.topicId}
                  <small>
                    {topic ? ROADMAP_TRACKS[topic.track] : 'Retired topic'} ·{' '}
                    {new Date(r.recordedAt).toLocaleDateString()}
                    {r.notes ? ` · ${r.notes}` : ''}
                  </small>
                </span>
                <span>
                  {r.status === 'completed' ? 'Completed' : 'Revision'} · {r.minutes} min
                </span>
              </div>
            );
          })}
          {!history.length && <p>No extra tasks recorded yet. Start with today’s task.</p>}
        </section>
        <TopicMasteryPanel
          topics={stats.topics}
          onViewCurriculum={() => {
            location.hash = 'curriculum';
          }}
        />
      </div>
      <section className="panel prep-prose">
        <h2>Resource study entries</h2>
        {entries.slice(0, 8).map((e) => (
          <div className="tracking-row" key={e.id}>
            <span>
              {e.topic}
              <small>
                {resourceById(e.resourceId)?.title ?? e.resourceId} · {SUBJECTS[e.subject]} ·{' '}
                {new Date(e.studiedAt).toLocaleDateString()}
              </small>
            </span>
            <span>
              {e.completed ? 'Completed' : 'In progress'} · {e.minutes} min
            </span>
          </div>
        ))}
        {!entries.length && (
          <p className="small">
            No manual study entries. Use Mark progress in the Resource Library for study outside the
            roadmap.
          </p>
        )}
        <details>
          <summary>Previous study history ({Object.keys(prep.sessions).length} sessions)</summary>
          <p className="small">
            Previous lesson results, answers, reflections, timers, and revision dates are preserved
            in local storage and backups.
          </p>
          {Object.values(prep.sessions)
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
            .map((s) => (
              <div className="tracking-row" key={s.id}>
                <span>
                  {lessonById(s.lessonId)?.title ?? s.lessonId}
                  <small>
                    {new Date(s.completedAt ?? s.startedAt).toLocaleDateString()} · {s.status}
                    {s.confidence ? ` · ${s.confidence}` : ''}
                    {s.reflection ? ` · ${s.reflection}` : ''}
                  </small>
                </span>
                <span>
                  {Math.floor(studyElapsed(s) / 60)} min
                  {s.total ? ` · ${s.score}/${s.total} recorded score` : ''}
                </span>
              </div>
            ))}
        </details>
      </section>
    </>
  );
}

function LibraryTab({
  state,
  act,
  busy,
  roadmap,
  openLink,
}: DashboardProps & { roadmap: RoadmapState; openLink: LinkRenderer }) {
  const [group, setGroup] = useState('All');
  const [track, setTrack] = useState<RoadmapTrack | 'bookmarked'>('os');
  const prep = state.preparation ?? defaultPreparation();
  const progress = new Map(roadmapProgress(roadmap).map((p) => [p.topicId, p]));
  const topics =
    track === 'bookmarked'
      ? roadmapTopics.filter((t) => roadmap.bookmarks?.[t.id])
      : roadmapTopics.filter((t) => t.track === track);
  return (
    <>
      <section className="panel">
        <div className="prep-panel-heading">
          <div>
            <h2>Topic roadmap</h2>
            <p className="small">
              Every topic with its study section and practice link. Record outcomes from Today;
              browsing here changes nothing.
            </p>
          </div>
        </div>
        <div className="prep-filters">
          {ROADMAP_TRACK_ORDER.map((t) => (
            <button key={t} className={track === t ? 'active' : ''} onClick={() => setTrack(t)}>
              {ROADMAP_TRACKS[t]}
            </button>
          ))}
          <button
            className={track === 'bookmarked' ? 'active' : ''}
            onClick={() => setTrack('bookmarked')}
          >
            Bookmarked
          </button>
        </div>
        {topics.map((topic) => {
          const p = progress.get(topic.id);
          return (
            <div className="roadmap-topic" key={topic.id}>
              <span className="roadmap-stage">{topic.stage}</span>
              <div>
                <strong>{topic.title}</strong>
                <small>
                  {ROADMAP_TRACKS[topic.track]} · {topic.level} · ~{topic.minutes} min ·{' '}
                  {p
                    ? p.status === 'completed'
                      ? `completed · review ${formatDay(p.dueOn)}`
                      : `revision due ${formatDay(p.dueOn)}`
                    : 'not started'}
                </small>
                <div className="roadmap-topic-links">
                  <a href={topic.learn.url} target="_blank" rel="noopener noreferrer">
                    <BookOpen size={12} /> {topic.learn.source} › {topic.learn.label}
                  </a>
                  <a href={topic.practice.url} target="_blank" rel="noopener noreferrer">
                    <Brain size={12} /> {topic.practice.kind}: {topic.practice.label}
                  </a>
                </div>
              </div>
              <BookmarkButton roadmap={roadmap} topicId={topic.id} act={act} busy={busy} />
            </div>
          );
        })}
        {!topics.length && <p className="small">No bookmarked topics yet.</p>}
      </section>
      <div className="prep-panel-heading">
        <div>
          <h2>Sources</h2>
          <p className="small">
            Study at the source. Record study outside the roadmap with Mark progress.
          </p>
        </div>
      </div>
      <div className="prep-filters">
        {['All', ...new Set(trackedResources.map((r) => r.group)), 'Bookmarked'].map((g) => (
          <button key={g} className={group === g ? 'active' : ''} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>
      <div className="tracking-resources">
        {trackedResources
          .filter(
            (r) =>
              group === 'All' ||
              r.group === group ||
              (group === 'Bookmarked' && prep.resourceTracking?.resources[r.id]?.bookmarked),
          )
          .map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              state={state}
              act={act}
              busy={busy}
              open={openLink}
            />
          ))}
      </div>
      <p className="small">
        Links checked October 17, 2026. Visits and bookmarks stay local; no browsing history is
        read.
      </p>
    </>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <section className="panel">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </section>
  );
}

function ResourceCard({
  resource,
  state,
  act,
  busy,
  open,
}: DashboardProps & { resource: TrackedResource; open: LinkRenderer }) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const saved = state.preparation?.resourceTracking?.resources[resource.id];
  const entries = Object.values(state.preparation?.resourceTracking?.entries ?? {})
    .filter((e) => e.resourceId === resource.id)
    .sort((a, b) => Date.parse(b.studiedAt) - Date.parse(a.studiedAt));
  const latest = entries[0];
  const completed = latestResourceTopics(entries).filter((e) => e.completed).length;
  const visit = () => void act({ type: 'prepResourceVisit', resourceId: resource.id });
  return (
    <article className="panel tracking-resource" aria-label={resource.title}>
      <div className="prep-panel-heading">
        <span className="eyebrow">{resource.group}</span>
        <button
          className="text-button"
          aria-label={`Bookmark ${resource.title}`}
          aria-pressed={saved?.bookmarked ?? false}
          disabled={busy}
          onClick={() =>
            void act({
              type: 'prepResourceBookmark',
              resourceId: resource.id,
              bookmarked: !saved?.bookmarked,
            })
          }
        >
          <Bookmark size={17} fill={saved?.bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>
      <h3>{resource.title}</h3>
      <p>{resource.description}</p>
      <small>
        {new URL(resource.url).hostname} · {completed} topics completed
        {latest ? ` · last: ${latest.topic}` : ''}
        {saved?.lastVisitedAt
          ? ` · visited ${new Date(saved.lastVisitedAt).toLocaleDateString()}`
          : ''}
      </small>
      <div className="tracking-actions">
        <span onClickCapture={visit} onAuxClickCapture={(e) => e.button === 1 && visit()}>
          {open(resource.url, 'Open Resource')}
        </span>
        <button
          className="button"
          onClick={() => {
            setEditing(!editing);
            setNotice('');
          }}
        >
          Mark Progress
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {editing && (
        <form
          className="tracking-progress-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const result = await act({
              type: 'prepResourceProgress',
              entry: {
                id: crypto.randomUUID(),
                resourceId: resource.id,
                topic: String(form.get('topic')).trim(),
                subject: String(form.get('subject')) as SubjectId,
                completed: form.get('completed') === 'on',
                minutes: Number(form.get('minutes') || 0),
                studiedAt: new Date().toISOString(),
              },
            });
            if (result) {
              setEditing(false);
              setNotice('Progress saved locally.');
            }
          }}
        >
          <label>
            Topic studied
            <input
              name="topic"
              required
              maxLength={200}
              defaultValue={latest?.topic ?? ''}
              placeholder="e.g. Process scheduling"
            />
          </label>
          <label>
            Subject
            <select name="subject" defaultValue={latest?.subject ?? resource.subjects[0]}>
              {resource.subjects.map((s) => (
                <option key={s} value={s}>
                  {SUBJECTS[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Study minutes (optional)
            <input type="number" name="minutes" min="0" max="1440" placeholder="0" />
          </label>
          <label className="prep-optin">
            <input type="checkbox" name="completed" defaultChecked={false} />I completed this topic
          </label>
          <p className="small">
            Unchecked means in progress. This never marks a DSA problem solved.
          </p>
          <div className="tracking-actions">
            <button className="button primary" disabled={busy}>
              Save progress
            </button>
            <button className="button" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
