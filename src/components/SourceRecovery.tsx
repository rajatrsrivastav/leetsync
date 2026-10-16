import { useState } from 'react';
import type { Attempt, AppState } from '../types';
import type { Command } from '../services/commands';
export function SourceRecovery({
  attempt,
  state,
  act,
  busy,
}: {
  attempt: Attempt;
  state: AppState;
  act: (c: Command) => Promise<AppState | undefined>;
  busy: boolean;
}) {
  const [code, setCode] = useState(attempt.code ?? ''),
    [language, setLanguage] = useState(attempt.language ?? state.settings.primaryLanguage),
    [confirmed, setConfirmed] = useState(false);
  const captures = Object.values(state.pendingSubmissions ?? {}).filter(
    (p) => p.attemptId === attempt.id && p.status === 'recovery',
  );
  return (
    <div>
      {captures.map((p) => (
        <p key={p.requestId} role="status">
          {p.lastError}{' '}
          {p.submissionId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act({ type: 'retryCapture', requestId: p.requestId })}
            >
              Retry verification on the problem page
            </button>
          )}
        </p>
      ))}
      {attempt.status === 'completed' &&
        !['synced', 'syncing'].includes(state.syncJobs[attempt.id]?.status ?? '') && (
          <details>
            <summary>Recover or confirm accepted source</summary>
            <p>
              Open the exact Accepted submission in LeetCode history and copy its complete source.
              This is a manual confirmation, not server verification.
            </p>
            <label>
              Source
              <textarea
                rows={6}
                maxLength={200000}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              Language
              <input
                maxLength={80}
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{' '}
              I confirm the exact accepted code and language.
            </label>
            <button
              type="button"
              disabled={busy || !confirmed || !code.trim() || !language.trim()}
              onClick={() =>
                void act({ type: 'recoverCode', attemptId: attempt.id, code, language, confirmed })
              }
            >
              Save confirmed source locally
            </button>
          </details>
        )}
    </div>
  );
}
