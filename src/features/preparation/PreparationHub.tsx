import { useState } from 'react';
import { Bookmark, ExternalLink } from 'lucide-react';
import type { DashboardProps } from '../../components/dashboard/types';
import { TopicMasteryPanel } from '../../components/dashboard/TopicMasteryPanel';
import { curriculum } from '../../domain/curriculum';
import { dashboardStats } from '../../domain/progress';
import { ProgressRepository } from '../../repositories/ProgressRepository';
import { isDueOnOrBefore, localDate } from '../../utils/date';
import { defaultPreparation, studyElapsed } from './model';
import { lessonById } from './catalog';
import { SUBJECTS, type SubjectId } from './types';
import {
  trackedResources,
  resourceById,
  resourceForSubject,
  type TrackedResource,
} from './resources';
import { latestResourceTopics, preparationActivity, previousTopics } from './tracking';
import './preparation.css';
import './tracking.css';

export function PreparationHub({ state, act, busy }: DashboardProps) {
  const [tab, setTab] = useState<'progress' | 'resources'>('progress');
  const [period, setPeriod] = useState(7);
  const [group, setGroup] = useState('All');
  const prep = state.preparation ?? defaultPreparation();
  const entries = Object.values(prep.resourceTracking?.entries ?? {}).sort(
    (a, b) => Date.parse(b.studiedAt) - Date.parse(a.studiedAt),
  );
  const topics = latestResourceTopics(entries);
  const previous = previousTopics(state);
  const stats = dashboardStats(state, curriculum.getProblems());
  const due = new ProgressRepository(state).due().length;
  const oldDue = previous.filter((t) => t.dueAt && isDueOnOrBefore(t.dueAt, new Date()));
  const attempts = Object.values(state.attempts).filter((a) => a.status === 'completed');
  const timed = attempts.filter((a) => a.activeSeconds > 0);
  const average = timed.length
    ? Math.round(timed.reduce((sum, a) => sum + a.activeSeconds, 0) / timed.length / 60)
    : null;
  const activity = preparationActivity(state, period);
  const todayActivity = preparationActivity(state, 1)[0]!;
  const goal = state.activities[localDate()]?.goal ?? state.settings.dailyGoal;
  const recent = trackedResources
    .filter((r) => prep.resourceTracking?.resources[r.id]?.lastVisitedAt)
    .sort(
      (a, b) =>
        Date.parse(prep.resourceTracking!.resources[b.id]!.lastVisitedAt!) -
        Date.parse(prep.resourceTracking!.resources[a.id]!.lastVisitedAt!),
    )
    .slice(0, 4);
  const oldLast = Object.values(prep.sessions).sort(
    (a, b) => Date.parse(b.completedAt ?? b.startedAt) - Date.parse(a.completedAt ?? a.startedAt),
  )[0];
  const lastEntry = entries[0];
  const useEntry =
    lastEntry &&
    (!oldLast ||
      Date.parse(lastEntry.studiedAt) >= Date.parse(oldLast.completedAt ?? oldLast.startedAt));
  const lastTitle = useEntry
    ? lastEntry.topic
    : oldLast
      ? (lessonById(oldLast.lessonId)?.title ?? oldLast.lessonId)
      : undefined;
  const resume = useEntry
    ? resourceById(lastEntry.resourceId)
    : oldLast
      ? resourceForSubject(lessonById(oldLast.lessonId)?.subject ?? 'dsa')
      : undefined;
  const active = prep.activeSessionId ? prep.sessions[prep.activeSessionId] : undefined;
  const openResource = (resource: TrackedResource, label = 'Open Resource') => (
    <a
      className="button"
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => void act({ type: 'prepResourceVisit', resourceId: resource.id })}
      onAuxClick={(e) => {
        if (e.button === 1) void act({ type: 'prepResourceVisit', resourceId: resource.id });
      }}
    >
      {label}
      <ExternalLink size={13} />
    </a>
  );
  return (
    <div className="preparation tracking">
      <header className="prep-header">
        <div>
          <span className="eyebrow">YOUR PREPARATION</span>
          <h1>Preparation progress</h1>
          <p>Your progress, pending work, and next place to continue.</p>
        </div>
        <span className="prep-local">{stats.streak} day DSA streak</span>
      </header>
      <nav className="prep-tabs" aria-label="Preparation sections">
        <button className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>
          Progress
        </button>
        <button className={tab === 'resources' ? 'active' : ''} onClick={() => setTab('resources')}>
          Resources
        </button>
      </nav>
      {tab === 'progress' ? (
        <>
          <div className="prep-metrics">
            <Metric label="DSA solved" value={`${stats.completed} / ${stats.total}`} />
            <Metric label="Today's DSA goal" value={`${stats.todayCompleted} / ${goal}`} />
            <Metric
              label="Average solving time"
              value={average === null ? '—' : `${average} min`}
              note="Completed timed attempts"
            />
            <Metric label="DSA revisions due" value={String(due)} />
          </div>
          <div className="tracking-summary panel">
            <span>
              <strong>{attempts.filter((a) => a.confidence === 'independent').length}</strong>{' '}
              independent solves
            </span>
            <span>
              <strong>{attempts.filter((a) => a.confidence === 'assisted').length}</strong> assisted
              solves
            </span>
            <span>
              <strong>{attempts.filter((a) => a.confidence === 'relearn').length}</strong> relearn
              attempts
            </span>
            <a href="#revisions" className="text-button">
              Review backlog →
            </a>
          </div>
          <div className="tracking-columns">
            <section className="panel prep-prose">
              <span className="eyebrow">CONTINUE PREPARING</span>
              <h2>{lastTitle ?? 'Choose where to start'}</h2>
              <p>
                {lastTitle
                  ? 'Last studied topic · recorded locally'
                  : 'Open a resource, then record the topic you studied.'}
              </p>
              {resume ? (
                openResource(resume, 'Resume Learning')
              ) : (
                <button className="button" onClick={() => setTab('resources')}>
                  Browse resources
                </button>
              )}
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
              <h3>Today's study time</h3>
              <p>
                {todayActivity.minutes} / {prep.profile.minutesPerDay} minutes · recorded study
                sessions
              </p>
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
              <a href="#settings" className="text-button">
                DSA goal settings →
              </a>
            </section>
            <section className="panel prep-prose">
              <h2>Pending preparation</h2>
              {(state.queues[localDate()]?.items ?? [])
                .filter(
                  (item) => !state.activities[localDate()]?.problemIds.includes(item.problemId),
                )
                .map((item) => (
                  <div className="tracking-row" key={item.problemId}>
                    <span>
                      {curriculum.getProblem(item.problemId)?.title ?? item.problemId}
                      <small>Today's DSA queue · {item.kind}</small>
                    </span>
                    <a className="button" href={`#problem/${encodeURIComponent(item.problemId)}`}>
                      Open problem
                    </a>
                  </div>
                ))}
              <p>
                {topics.filter((t) => !t.completed).length} external topics in progress ·{' '}
                {oldDue.length} previous study reviews due
              </p>
              {topics
                .filter((t) => !t.completed)
                .slice(0, 4)
                .map((t) => (
                  <div className="tracking-row" key={t.id}>
                    <span>
                      {t.topic}
                      <small>{SUBJECTS[t.subject]}</small>
                    </span>
                    {resourceById(t.resourceId) &&
                      openResource(resourceById(t.resourceId)!, 'Resume Learning')}
                  </div>
                ))}
              {oldDue.slice(0, 3).map((t) => (
                <div className="tracking-row" key={t.id}>
                  <span>
                    {t.title}
                    <small>Previous study review due</small>
                  </span>
                  {t.subject &&
                    resourceForSubject(t.subject) &&
                    openResource(resourceForSubject(t.subject)!, 'Resume Learning')}
                </div>
              ))}
              <h3>Recently visited resources</h3>
              {recent.map((r) => (
                <div className="tracking-row" key={r.id}>
                  <span>
                    {r.title}
                    <small>
                      {new Date(
                        prep.resourceTracking!.resources[r.id]!.lastVisitedAt!,
                      ).toLocaleDateString()}
                    </small>
                  </span>
                  {openResource(r, 'Resume Learning')}
                </div>
              ))}
              {!recent.length && <p>No resource visits recorded yet.</p>}
            </section>
          </div>
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
              {activity.reduce((n, d) => n + d.studies, 0)} study records ·{' '}
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
            <p className="small">
              Activity includes recorded study and DSA solves. Opening links does not count toward
              study activity or the DSA streak.
            </p>
          </section>
          <div className="tracking-columns">
            <TopicMasteryPanel
              topics={stats.topics}
              onViewCurriculum={() => {
                location.hash = 'curriculum';
              }}
            />
            <section className="panel prep-prose">
              <h2>Subject progress</h2>
              <p className="small">
                Manually tracked topics and preserved previous study topics. External resources have
                no fixed completion percentage.
              </p>
              {(
                [
                  ['DSA concepts', ['dsa']],
                  ['Core CS', ['os', 'dbms', 'networks', 'oop', 'sql']],
                  ['System Design', ['system']],
                  ['Aptitude', ['aptitude']],
                  ['Interviews', ['interviews']],
                  ['Company preparation', ['company']],
                ] as [string, SubjectId[]][]
              ).map(([title, subjects]) => {
                const id = title;
                const completed = topics.filter(
                  (t) => subjects.includes(t.subject) && t.completed,
                ).length;
                const pending = topics.filter(
                  (t) => subjects.includes(t.subject) && !t.completed,
                ).length;
                const legacy = previous.filter(
                  (t) => t.subject && subjects.includes(t.subject) && t.completed,
                ).length;
                return (
                  <div className="tracking-row" key={id}>
                    <strong>{title}</strong>
                    <span>
                      {completed} complete · {pending} in progress
                      {legacy > 0 && <small>{legacy} previous study topics</small>}
                    </span>
                  </div>
                );
              })}
            </section>
          </div>
          <section className="panel prep-prose">
            <h2>Study history</h2>
            {entries.slice(0, 10).map((e) => (
              <div className="tracking-row" key={e.id}>
                <span>
                  {e.topic}
                  <small>
                    {resourceById(e.resourceId)?.title ?? e.resourceId} ·{' '}
                    {new Date(e.studiedAt).toLocaleDateString()}
                  </small>
                </span>
                <span>
                  {e.completed ? 'Completed' : 'In progress'} · {e.minutes} min
                </span>
              </div>
            ))}
            {!entries.length && (
              <p>No external study records yet. Use Mark Progress on a resource.</p>
            )}
            <details>
              <summary>
                Previous study history ({Object.keys(prep.sessions).length} sessions)
              </summary>
              <p className="small">
                Previous lesson results, answers, reflections, timers, and revision dates are
                preserved in local storage and backups.
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
      ) : (
        <>
          <div className="prep-panel-heading">
            <div>
              <h2>Resources</h2>
              <p>Study at the source. Record progress here when you finish a session.</p>
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
                  open={openResource}
                />
              ))}
          </div>
          <p className="small">
            Links checked October 17, 2026. Visits and bookmarks stay local; no external browsing
            history is read.
          </p>
        </>
      )}
    </div>
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
}: DashboardProps & {
  resource: TrackedResource;
  open: (resource: TrackedResource, label?: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const saved = state.preparation?.resourceTracking?.resources[resource.id];
  const entries = Object.values(state.preparation?.resourceTracking?.entries ?? {})
    .filter((e) => e.resourceId === resource.id)
    .sort((a, b) => Date.parse(b.studiedAt) - Date.parse(a.studiedAt));
  const latest = entries[0];
  const completed = latestResourceTopics(entries).filter((e) => e.completed).length;
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
      </small>
      <p className="small">
        {latest ? `Last studied: ${latest.topic}` : 'No study recorded'}
        {saved?.lastVisitedAt
          ? ` · Visited ${new Date(saved.lastVisitedAt).toLocaleDateString()}`
          : ''}
      </p>
      <div className="tracking-actions">
        {open(resource)}
        <button
          className="button"
          onClick={() => {
            setEditing(!editing);
            setNotice('');
          }}
        >
          Mark Progress
        </button>
        {open(resource, 'Resume Learning')}
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
