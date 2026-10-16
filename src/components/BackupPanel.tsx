import { useState } from 'react';
import { browser } from 'wxt/browser';
import { createBackup, parseBackup } from '../services/BackupService';
import type { AppState } from '../types';
import type { Command } from '../services/commands';
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function BackupPanel({
  state,
  act,
  busy = false,
}: {
  state?: AppState;
  act: (c: Command) => Promise<AppState | undefined>;
  busy?: boolean;
}) {
  const [text, setText] = useState(''),
    [summary, setSummary] = useState(''),
    [error, setError] = useState('');
  return (
    <section className="panel">
      <h3>Data & recovery</h3>
      <p className="small">
        Saved in this browser profile · extension ID {browser.runtime.id}.{' '}
        {import.meta.env.DEV
          ? 'Development installation: a temporary browser profile has separate data.'
          : 'Production installation.'}{' '}
        Updates and Reload preserve data. Uninstalling, deleting the profile, or changing the
        extension ID does not.
      </p>
      {state?.recoveryNotice && <p role="alert">{state.recoveryNotice}</p>}
      <div className="row-actions">
        {state && (
          <button
            className="button"
            onClick={() => download(createBackup(state), 'dsacommit-backup.json')}
          >
            Export backup
          </button>
        )}
        <button
          className="button"
          onClick={async () => {
            const r = await browser.runtime.sendMessage({
              channel: 'dsacommit',
              command: { type: 'exportRecovery' },
            });
            if (r?.ok) download(r.recovery, 'dsacommit-recovery.json');
            else setError(r?.error ?? 'Recovery export failed.');
          }}
        >
          Export recovery records
        </button>
      </div>
      <label>
        Import a DSACommit backup
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            setText('');
            setError('');
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 20_000_000) throw new Error('Backup exceeds 20 MB.');
              const value = await file.text();
              const parsed = parseBackup(value);
              setSummary(
                `${Object.keys(parsed.state.attempts).length} attempts · ${Object.keys(parsed.state.progress).length} problem records. Existing IDs stay unchanged. Imported timers pause and unsynced jobs require manual retry.`,
              );
              setText(value);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      </label>
      {text && (
        <>
          <p className="small">{summary}</p>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              const result = await act({ type: 'importBackup', text });
              if (result) {
                setText('');
                setSummary('Backup merged successfully.');
              }
            }}
          >
            Merge backup
          </button>
        </>
      )}
      {!text && summary && <p role="status">{summary}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
