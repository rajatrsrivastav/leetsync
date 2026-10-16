import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, ExternalLink, Pause, Play } from 'lucide-react';
import type { DashboardProps } from '../../components/dashboard/types';
import type { Lesson } from './types';
import { SUBJECTS } from './types';
import { studyElapsed } from './model';
import { preparationLessons } from './catalog';

export function LessonWorkspace({
  lesson,
  state,
  act,
  busy,
  onBack,
  onOpen,
}: { lesson: Lesson; onBack: () => void; onOpen: (id: string) => void } & DashboardProps) {
  const prep = state.preparation!;
  const session = Object.values(prep.sessions)
    .filter((s) => s.lessonId === lesson.id)
    .sort(
      (a, b) =>
        Number(b.id === prep.activeSessionId) - Number(a.id === prep.activeSessionId) ||
        Number(a.status === 'completed') - Number(b.status === 'completed') ||
        b.startedAt.localeCompare(a.startedAt),
    )[0];
  const [now, setNow] = useState(new Date());
  const [stage, setStage] = useState<'learn' | 'practice' | 'reflect'>('learn');
  const [confidence, setConfidence] = useState<'independent' | 'assisted' | 'relearn' | ''>('');
  const [reflection, setReflection] = useState('');
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setStage('learn');
    setConfidence('');
    setReflection('');
  }, [lesson.id, session?.id]);
  const unmet = lesson.prerequisites.filter((id) => !prep.progress[id]?.lastCompletedAt);
  const completed = session?.status === 'completed';
  const seconds = session ? studyElapsed(session, now) : 0;
  const answers = session?.answers ?? {};
  const quizComplete =
    !lesson.quiz?.length || lesson.quiz.every((q) => answers[q.id] !== undefined);
  return (
    <div className="prep-workspace">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={15} /> All learning paths
      </button>
      <header className="prep-lesson-header">
        <div>
          <span className="eyebrow">
            {SUBJECTS[lesson.subject]} · {lesson.level}
          </span>
          <h1>{lesson.title}</h1>
          <p>{lesson.summary}</p>
        </div>
        <span className="tag">
          <Clock size={13} /> {lesson.minutes} min
        </span>
      </header>
      {unmet.length > 0 && (
        <section className="prep-notice">
          <strong>Build the foundations first</strong>
          <p>Read ahead if you like. Finish these prerequisites before recording practice:</p>
          {unmet.map((id) => (
            <button className="text-button" key={id} onClick={() => onOpen(id)}>
              {preparationLessons.find((l) => l.id === id)?.title ?? id} →
            </button>
          ))}
        </section>
      )}
      <div className="prep-work-grid">
        <div>
          <nav className="prep-tabs" aria-label="Lesson stages">
            {(['learn', 'practice', 'reflect'] as const).map((tab, i) => (
              <button
                aria-current={stage === tab ? 'step' : undefined}
                className={stage === tab ? 'active' : ''}
                key={tab}
                onClick={() => setStage(tab)}
              >
                {i + 1}.{' '}
                {tab === 'learn'
                  ? 'Understand'
                  : tab === 'practice'
                    ? 'Apply & recall'
                    : 'Reflect & revise'}
              </button>
            ))}
          </nav>
          {stage === 'learn' && (
            <section className="panel prep-prose">
              <span className="eyebrow">THE CONCEPT</span>
              <h2>{lesson.concept}</h2>
              {lesson.explanation.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <h3>A worked example</h3>
              <pre className="prep-example">{lesson.example}</pre>
              <button className="button primary" onClick={() => setStage('practice')}>
                Try it yourself →
              </button>
            </section>
          )}
          {stage === 'practice' && (
            <section className="panel prep-prose">
              <span className="eyebrow">RETRIEVE BEFORE YOU RE-READ</span>
              <h2>Put the idea to work.</h2>
              <p>{lesson.practice}</p>
              <h3>Interview prompts</h3>
              <ol>
                {lesson.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
              {!!lesson.quiz?.length && (
                <div className="prep-quiz">
                  <h3>Timed practice · {lesson.quiz.length} questions</h3>
                  <p>
                    Start or resume a session to save answers. Answer feedback unlocks after
                    completion; no answer is preselected.
                  </p>
                  {lesson.quiz.map((q, i) => (
                    <fieldset key={q.id}>
                      <legend>
                        {i + 1}. {q.prompt}
                      </legend>
                      {q.options.map((option, index) => (
                        <label
                          key={index}
                          className={`prep-option ${answers[q.id] === index ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`${lesson.id}-${q.id}`}
                            checked={answers[q.id] === index}
                            disabled={busy || session?.status !== 'active'}
                            onChange={() =>
                              session &&
                              void act({
                                type: 'prepAnswer',
                                sessionId: session.id,
                                questionId: q.id,
                                answer: index,
                              })
                            }
                          />
                          {option}
                        </label>
                      ))}
                      {completed && (
                        <p className="prep-answer">
                          <strong>
                            {answers[q.id] === q.answer ? 'Correct.' : 'Review this one.'}
                          </strong>{' '}
                          {q.explanation}
                        </p>
                      )}
                    </fieldset>
                  ))}
                </div>
              )}
              <button className="button primary" onClick={() => setStage('reflect')}>
                Reflect on this practice →
              </button>
            </section>
          )}
          {stage === 'reflect' && (
            <section className="panel prep-prose">
              <span className="eyebrow">MAKE THE LEARNING STICK</span>
              <h2>{completed ? 'Session saved. Keep building.' : 'What can you now explain?'}</h2>
              <ul>
                {lesson.checkpoints.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              {completed ? (
                <>
                  <p>
                    <CheckCircle2 size={16} /> {session.confidence} · {Math.floor(seconds / 60)}{' '}
                    minutes
                    {session.total
                      ? ` · ${session.score}/${session.total} quiz answers correct`
                      : ''}
                  </p>
                  {session.reflection && <blockquote>{session.reflection}</blockquote>}
                  <p>
                    Next recall:{' '}
                    {prep.progress[lesson.id]?.dueAt
                      ? new Date(prep.progress[lesson.id]!.dueAt!).toLocaleDateString()
                      : 'not scheduled'}
                    . This is practice evidence, not an interview-readiness guarantee.
                  </p>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (session && confidence)
                      void act({
                        type: 'prepComplete',
                        sessionId: session.id,
                        confidence,
                        reflection,
                      });
                  }}
                >
                  <fieldset className="prep-confidence">
                    <legend>How well could you recall without help?</legend>
                    {(['independent', 'assisted', 'relearn'] as const).map((value) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="prep-confidence"
                          required
                          checked={confidence === value}
                          onChange={() => setConfidence(value)}
                        />
                        {value === 'independent'
                          ? 'Explained independently'
                          : value === 'assisted'
                            ? 'Needed support'
                            : 'Need another pass'}
                      </label>
                    ))}
                  </fieldset>
                  <label className="prep-field">
                    What did you learn, miss, or want to revisit?
                    <textarea
                      rows={4}
                      maxLength={5000}
                      value={reflection}
                      onChange={(e) => setReflection(e.target.value)}
                      placeholder="Explain the key idea in your own words…"
                    />
                  </label>
                  <p className="small">
                    Quiz evidence can lower independent confidence. New learning and revision use
                    the same recall checks.
                  </p>
                  <button
                    className="button primary"
                    type="submit"
                    disabled={busy || !session || !confidence || !quizComplete}
                  >
                    Save learning session
                  </button>
                  {!quizComplete && (
                    <p role="status">Answer every practice question before completing.</p>
                  )}
                  {!session && <p>Start a session first to record your practice.</p>}
                </form>
              )}
            </section>
          )}
        </div>
        <aside className="prep-lesson-aside">
          <section className="panel prep-session">
            <span className="eyebrow">FOCUSED STUDY</span>
            <strong className="prep-timer" role="timer" aria-label="Study time">
              {String(Math.floor(seconds / 60)).padStart(2, '0')}:
              {String(Math.floor(seconds % 60)).padStart(2, '0')}
            </strong>
            <p>
              {session?.status === 'active'
                ? 'Timer running · pause before stepping away.'
                : session?.status === 'paused'
                  ? 'Paused. Your answers and time are saved.'
                  : completed
                    ? 'Your session is recorded locally.'
                    : 'Start when you are ready. Reading alone does not mark this complete.'}
            </p>
            {!session || completed ? (
              <button
                className="button primary"
                disabled={busy || unmet.length > 0}
                onClick={() =>
                  void act({
                    type: 'prepStart',
                    lessonId: lesson.id,
                    sessionId: crypto.randomUUID(),
                  })
                }
              >
                <Play size={14} />
                {completed ? 'Practice again' : 'Start study session'}
              </button>
            ) : (
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void act({
                    type: session.status === 'active' ? 'prepPause' : 'prepResume',
                    sessionId: session.id,
                  })
                }
              >
                {session.status === 'active' ? <Pause size={14} /> : <Play size={14} />}{' '}
                {session.status === 'active' ? 'Pause session' : 'Resume session'}
              </button>
            )}
            <small>
              Active time continues across browser restarts until paused. DSA timers remain
              separate.
            </small>
          </section>
          <section className="panel prep-resources">
            <BookOpen size={18} />
            <h3>Go to the source</h3>
            {lesson.resources.map((r) => (
              <div key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  {r.title}
                  <ExternalLink size={12} />
                </a>
                <small>
                  {r.publisher} · {r.verification === 'verified' ? 'Checked' : 'Access limited'}{' '}
                  {r.verifiedAt}
                </small>
                {r.note && <small>{r.note}</small>}
              </div>
            ))}
            <p className="small">
              Links open externally. Availability can change; resources are supplementary to the
              bundled lesson.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
