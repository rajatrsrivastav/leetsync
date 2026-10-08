import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { AppState, Attempt, Confidence, CurriculumProblem } from '../types';
import type { Command } from '../services/commands';
import './attempt.css';

export type ReflectionProps = {
  state: AppState;
  problem: CurriculumProblem;
  attempt?: Attempt;
  act: (command: Command) => Promise<AppState | undefined>;
  busy: boolean;
};

const confidenceOptions: { value: Confidence; label: string; description: string }[] = [
  { value: 'independent', label: 'Independent', description: 'I can explain and repeat this.' },
  { value: 'assisted', label: 'Needed help', description: 'I understand it with some support.' },
  { value: 'relearn', label: 'Relearn', description: 'I want another pass soon.' },
];

export function Reflection({
  state,
  problem,
  attempt: explicitAttempt,
  act,
  busy,
}: ReflectionProps) {
  const attempt =
    explicitAttempt ??
    Object.values(state.attempts).find(
      (item) => item.problemId === problem.id && item.status === 'accepted',
    );
  if (!attempt) return null;
  return (
    <ReflectionForm
      key={attempt.id}
      state={state}
      problem={problem}
      attempt={attempt}
      act={act}
      busy={busy}
    />
  );
}

function ReflectionForm({
  state,
  problem,
  attempt,
  act,
  busy,
}: ReflectionProps & { attempt: Attempt }) {
  const id = useId();
  const [confidence, setConfidence] = useState<Confidence | ''>('');
  const [hints, setHints] = useState(attempt.hintsUsed);
  const [timeComplexity, setTimeComplexity] = useState(attempt.timeComplexity ?? '');
  const [spaceComplexity, setSpaceComplexity] = useState(attempt.spaceComplexity ?? '');
  const [notes, setNotes] = useState(attempt.notes ?? '');
  const [code, setCode] = useState(attempt.code ?? '');
  const [language, setLanguage] = useState(
    attempt.language && attempt.language !== 'unknown'
      ? attempt.language
      : state.settings.primaryLanguage,
  );
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    setHints((previous) => Math.max(previous, attempt.hintsUsed));
  }, [attempt.hintsUsed]);

  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confidence || busy || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    try {
      await act({
        type: 'complete',
        attemptId: attempt.id,
        reflection: {
          confidence,
          hintsUsed: hints,
          timeComplexity: timeComplexity.trim(),
          spaceComplexity: spaceComplexity.trim(),
          notes: notes.trim(),
          ...(code.trim() ? { code, language: language.trim() } : {}),
        },
      });
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <section
      className="dsacommit-surface reflection-panel"
      data-theme={state.settings.theme}
      aria-labelledby={`${id}-heading`}
    >
      <div className="reflection-kicker">
        {attempt.completionSource === 'manual' ? 'MANUAL SOLVE RECORDED' : 'ACCEPTED'}
      </div>
      <h2 ref={heading} tabIndex={-1} id={`${id}-heading`}>
        A little reflection.
        <br />A stronger next attempt.
      </h2>
      <p className="reflection-muted">{problem.title}</p>
      <dl className="reflection-stats">
        <div>
          <dt>Active time</dt>
          <dd>
            {Math.floor(attempt.activeSeconds / 60)}m {Math.floor(attempt.activeSeconds % 60)}s
          </dd>
        </div>
        <div>
          <dt>Submissions</dt>
          <dd>{attempt.submissionCount}</dd>
        </div>
        <div>
          <dt>Editorial</dt>
          <dd>{attempt.editorialViewed ? 'Viewed' : 'No'}</dd>
        </div>
        <div>
          <dt>Solution</dt>
          <dd>{attempt.solutionViewed ? 'Viewed' : 'No'}</dd>
        </div>
      </dl>
      <form onSubmit={complete} className="reflection-form">
        <fieldset className="reflection-confidence">
          <legend>
            How did this feel? <span>Required</span>
          </legend>
          {confidenceOptions.map((option) => (
            <label
              key={option.value}
              className={`reflection-choice reflection-choice-${option.value}${confidence === option.value ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name={`${id}-confidence`}
                value={option.value}
                required
                checked={confidence === option.value}
                onChange={() => setConfidence(option.value)}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="reflection-field">
          Hints used <span className="reflection-muted">Include help outside DSACommit.</span>
          <input
            type="number"
            min={attempt.hintsUsed}
            max={999}
            required
            value={hints}
            onChange={(event) => setHints(Number(event.target.value))}
          />
        </label>
        <div className="reflection-columns">
          <label className="reflection-field">
            Time complexity
            <input
              value={timeComplexity}
              maxLength={300}
              onChange={(event) => setTimeComplexity(event.target.value)}
              placeholder="e.g. O(n)"
            />
          </label>
          <label className="reflection-field">
            Space complexity
            <input
              value={spaceComplexity}
              maxLength={300}
              onChange={(event) => setSpaceComplexity(event.target.value)}
              placeholder="e.g. O(1)"
            />
          </label>
        </div>
        <label className="reflection-field">
          Notes <span className="reflection-muted">Optional</span>
          <textarea
            value={notes}
            maxLength={10000}
            rows={3}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="The insight you want to remember…"
          />
        </label>
        <details className="reflection-code" open={!attempt.code}>
          <summary>
            {attempt.code ? 'Review captured source' : 'Add your accepted code (optional)'}
          </summary>
          {!attempt.code && (
            <p className="reflection-muted">
              Full source was not available reliably. Paste your accepted code to save it and enable
              GitHub sync. Your progress will save either way.
            </p>
          )}
          <label className="reflection-field">
            Language
            <input
              value={language}
              maxLength={80}
              required={Boolean(code.trim())}
              list={`${id}-languages`}
              onChange={(event) => setLanguage(event.target.value)}
            />
          </label>
          <datalist id={`${id}-languages`}>
            {[
              'Python3',
              'Python',
              'JavaScript',
              'TypeScript',
              'Java',
              'C++',
              'C',
              'C#',
              'Go',
              'Rust',
              'Kotlin',
              'Swift',
              'Ruby',
              'MySQL',
              'Bash',
            ].map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <label className="reflection-field">
            Accepted source
            <textarea
              className="reflection-source"
              value={code}
              maxLength={200000}
              rows={7}
              spellCheck={false}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Paste the complete accepted solution…"
            />
          </label>
        </details>
        <button type="submit" className="attempt-primary" disabled={busy || saving || !confidence}>
          {saving ? 'Saving your progress…' : 'Complete Problem'}
        </button>
        {state.settings.revisionScheduling && confidence && (
          <p className="reflection-footnote">
            Next review in about{' '}
            {confidence === 'independent' ? 30 : confidence === 'assisted' ? 7 : 1}{' '}
            {confidence === 'relearn' ? 'day' : 'days'}
            {attempt.kind === 'revision' ? ', with more spacing after successful revisions' : ''}.
          </p>
        )}
      </form>
    </section>
  );
}
