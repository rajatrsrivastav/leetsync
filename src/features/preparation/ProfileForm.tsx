import { useState } from 'react';
import type { DashboardProps } from '../../components/dashboard/types';
import { SUBJECTS, type SubjectId, type PreparationProfile } from './types';
import { studyContext } from './integration';
export function ProfileForm({ state, act, busy }: DashboardProps) {
  const prep = state.preparation!;
  const [draft, setDraft] = useState<PreparationProfile>(structuredClone(prep.profile));
  const [notice, setNotice] = useState('');
  const [context, setContext] = useState('');
  const update = <K extends keyof PreparationProfile>(key: K, value: PreparationProfile[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const toggle = (key: 'subjects' | 'weakSubjects', id: SubjectId) =>
    update(key, draft[key].includes(id) ? draft[key].filter((s) => s !== id) : [...draft[key], id]);
  return (
    <div className="prep-profile-grid">
      <section className="panel prep-prose">
        <span className="eyebrow">YOUR PREPARATION PROFILE</span>
        <h2>Make the plan fit your day.</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await act({ type: 'prepProfile', profile: draft });
            if (result) {
              setNotice(
                'Profile saved. Use Rebuild today’s plan when you want the new priorities applied.',
              );
              setContext('');
            }
          }}
        >
          <div className="prep-form-grid">
            <label className="prep-field">
              Available minutes per day
              <input
                type="number"
                min={10}
                max={480}
                required
                value={draft.minutesPerDay}
                onChange={(e) => update('minutesPerDay', Number(e.target.value))}
              />
            </label>
            <label className="prep-field">
              Target placement date <span className="small">Optional</span>
              <input
                type="date"
                value={draft.targetDate ?? ''}
                onChange={(e) => update('targetDate', e.target.value || undefined)}
              />
            </label>
          </div>
          <label className="prep-field">
            Target role
            <select
              value={draft.role}
              onChange={(e) => update('role', e.target.value as PreparationProfile['role'])}
            >
              <option value="software">Software engineer</option>
              <option value="backend">Backend engineer</option>
              <option value="fullstack">Full-stack engineer</option>
              <option value="analyst">Data / business analyst</option>
            </select>
          </label>
          <label className="prep-field">
            Your preparation goal
            <input
              maxLength={500}
              value={draft.goal}
              onChange={(e) => update('goal', e.target.value)}
              placeholder="Build fundamentals before campus interviews"
            />
          </label>
          <fieldset className="prep-subject-choices">
            <legend>Include in my daily plan</legend>
            {(Object.entries(SUBJECTS) as [SubjectId, string][]).map(([id, label]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={draft.subjects.includes(id)}
                  onChange={() => toggle('subjects', id)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset className="prep-subject-choices">
            <legend>Where would you like more practice?</legend>
            {(Object.entries(SUBJECTS) as [SubjectId, string][]).map(([id, label]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={draft.weakSubjects.includes(id)}
                  onChange={() => toggle('weakSubjects', id)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <label className="prep-optin">
            <input
              type="checkbox"
              checked={draft.aiContextOptIn}
              onChange={(e) => update('aiContextOptIn', e.target.checked)}
            />{' '}
            Enable optional study-context export for an AI coach.
          </label>
          <p className="small">
            Nothing is sent automatically. Export contains selected topics, role, available time,
            target date, and completion confidence. Source code, notes, resume text, quiz answers,
            and credentials are excluded.
          </p>
          <button
            className="button primary"
            disabled={busy || !draft.subjects.length}
            type="submit"
          >
            Save preparation profile
          </button>
          {notice && <p role="status">{notice}</p>}
        </form>
      </section>
      <aside className="column">
        <section className="panel prep-prose">
          <span className="eyebrow">AI-READY, ON YOUR TERMS</span>
          <h3>A portable coaching brief</h3>
          <p>
            The planner and lessons work offline. If you use an AI service, preview this brief and
            decide what to share. It asks the coach to guide your thinking without revealing answers
            during practice.
          </p>
          <button
            className="button"
            disabled={!prep.profile.aiContextOptIn}
            onClick={() => setContext(studyContext(prep))}
          >
            Preview coaching brief
          </button>
          {context && (
            <>
              <label className="prep-field">
                Exact export
                <textarea rows={14} value={context} readOnly />
              </label>
              <button
                className="button"
                onClick={() => {
                  const url = URL.createObjectURL(new Blob([context], { type: 'text/plain' }));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'dsacommit-coaching-brief.txt';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Download coaching brief
              </button>
            </>
          )}
        </section>
        <section className="panel prep-prose">
          <h3>Your original DSA journey stays yours.</h3>
          <p>
            Placement sessions, quizzes, and learning reviews are tracked separately from Striver
            solves. They never manufacture accepted submissions, GitHub commits, or DSA streak days.
          </p>
          <p>
            Use Settings → Data & recovery to back up both preparation history and DSA history
            together.
          </p>
        </section>
      </aside>
    </div>
  );
}
