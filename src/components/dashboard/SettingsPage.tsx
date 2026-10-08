import { useState } from 'react';
import { Check, Download, Github } from 'lucide-react';
import { browser } from 'wxt/browser';
import type { Settings } from '../../types';
import { curriculum } from '../../domain/curriculum/Striver180CurriculumProvider';
import { localDate } from '../../utils/date';
import { LanguageSelect } from '../Onboarding';
import { ExternalLink } from '../ui';
import type { DashboardProps } from './types';
import { PageHeading } from './shared';

export function SettingsPage({ state, act, busy }: DashboardProps) {
  const [draft, setDraft] = useState<Settings>(structuredClone(state.settings)),
    [token, setToken] = useState(''),
    [notice, setNotice] = useState('');
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const github = <K extends keyof Settings['github']>(key: K, value: Settings['github'][K]) =>
    setDraft((d) => ({ ...d, github: { ...d.github, [key]: value } }));
  const save = async () => {
    setNotice('');
    if (draft.github.enabled) {
      const granted = await browser.permissions.request({ origins: ['https://api.github.com/*'] });
      if (!granted) {
        setNotice('GitHub permission was not granted. Local practice remains available.');
        return;
      }
    }
    const result = await act({ type: 'settings', settings: draft, token: token || undefined });
    if (result) {
      setToken('');
      setNotice('Settings saved.');
    }
  };
  const backup = () => {
    const blob = new Blob(
      [JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dsacommit-backup-${localDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <PageHeading
        eyebrow="MAKE IT YOURS"
        title="Your practice, your pace."
        description="Keep the defaults simple. Change them when you need to."
      />
      {notice && (
        <p className="notice" role="status" style={{ marginBottom: 20 }}>
          {notice}
        </p>
      )}
      <div className="settings-grid">
        <div className="column">
          <section className="panel">
            <h3>Practice preferences</h3>
            <div className="stack">
              <label>
                Daily target
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={draft.dailyGoal}
                  onChange={(e) => set('dailyGoal', Number(e.target.value))}
                />
              </label>
              <label>
                Primary language
                <LanguageSelect
                  value={draft.primaryLanguage}
                  onChange={(v) => set('primaryLanguage', v)}
                />
              </label>
              <label>
                Curriculum
                <select disabled>
                  <option>Striver 180 · 179 problems</option>
                </select>
              </label>
              <label>
                Timer behavior
                <select disabled>
                  <option>Manual start · survives reloads and restarts</option>
                </select>
              </label>
              <label>
                Appearance
                <select
                  value={draft.theme}
                  onChange={(e) => set('theme', e.target.value as Settings['theme'])}
                >
                  <option value="system">System</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>
              {[
                ['showPattern', 'Show pattern before an attempt'],
                ['revisionScheduling', 'Schedule spaced revisions'],
                ['debug', 'Enable adapter debug logging'],
              ].map(([k, label]) => (
                <label className="check-label" key={k}>
                  <input
                    type="checkbox"
                    checked={!!draft[k as keyof Settings]}
                    onChange={(e) => set(k as 'showPattern', e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <button className="button primary" disabled={busy} onClick={() => void save()}>
              Save settings
              <Check size={14} />
            </button>
            <p className="export-note">
              Goal changes apply to future activity days. A day with saved activity keeps its
              original target.
            </p>
          </section>
          <section className="panel">
            <h3>Your data belongs to you</h3>
            <p className="small">
              No telemetry, backend, or browsing-history collection. Export your saved attempts and
              progress before reinstalling or switching browsers. Backups include saved code and
              notes, never your GitHub token.
            </p>
            <button className="button" onClick={backup}>
              <Download size={14} />
              Export local backup
            </button>
            <p className="export-note">
              Keyboard shortcuts can be assigned in your browser’s extension shortcuts page.
            </p>
          </section>
        </div>
        <section className="panel">
          <h3 className="flex items-center gap-2">
            <Github size={17} />
            GitHub integration
            <span className="tag" style={{ marginLeft: 'auto' }}>
              OPTIONAL
            </span>
          </h3>
          <p className="small" style={{ marginBottom: 20 }}>
            Save real completed solutions to your own repository. Your local progress is always
            saved first.
          </p>
          <div className="stack">
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.github.enabled}
                onChange={(e) => github('enabled', e.target.checked)}
              />
              Enable GitHub sync
            </label>
            <label>
              Repository
              <input
                value={draft.github.repository}
                placeholder="username/dsa-journey"
                autoComplete="off"
                onChange={(e) => github('repository', e.target.value.trim())}
              />
            </label>
            <label>
              Branch
              <input
                value={draft.github.branch}
                placeholder="main"
                onChange={(e) => github('branch', e.target.value)}
              />
            </label>
            <label>
              Fine-grained access token
              <input
                type="password"
                autoComplete="new-password"
                value={token}
                placeholder="Leave blank to keep your saved token"
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
            <p className="small">
              Select only your DSA repository, with Contents read/write permission. Tokens stay in
              this browser profile; extension storage is not an encrypted vault.
            </p>
            {[
              ['autoCommit', 'Auto commit after reflection'],
              ['includeMetadata', 'Include attempt metadata in solution'],
              ['updateReadme', 'Update DSACommit README section in the same commit'],
            ].map(([k, label]) => (
              <label className="check-label" key={k}>
                <input
                  type="checkbox"
                  checked={!!draft.github[k as keyof Settings['github']]}
                  onChange={(e) => github(k as 'autoCommit', e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="settings-actions">
            <button className="button primary" disabled={busy} onClick={() => void save()}>
              Save configuration
            </button>
            <button
              className="button"
              disabled={busy || !state.settings.github.enabled}
              onClick={async () => {
                const r = await act({ type: 'validateGithub' });
                if (r) setNotice('GitHub token, repository, and branch verified.');
              }}
            >
              Test connection
            </button>
            <button
              className="button ghost"
              disabled={busy}
              onClick={async () => {
                const r = await act({ type: 'disconnectGithub' });
                if (r) {
                  setDraft(r.settings);
                  setToken('');
                  setNotice('GitHub disconnected and token removed.');
                }
              }}
            >
              Disconnect
            </button>
          </div>
          <div className="attempt-history">
            <h3>Sync activity</h3>
            {Object.values(state.syncJobs).length ? (
              Object.values(state.syncJobs)
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 10)
                .map((j) => (
                  <div className="history-row" key={j.id}>
                    <div className="flex justify-between">
                      <span>
                        {curriculum.getProblem(state.attempts[j.attemptId]?.problemId ?? '')?.title}
                      </span>
                      <span className="tag">{j.status}</span>
                    </div>
                    {j.lastError && <p>{j.lastError}</p>}
                    {j.commitUrl ? (
                      <ExternalLink href={j.commitUrl}>View commit</ExternalLink>
                    ) : (
                      <button
                        className="text-button small"
                        disabled={busy || j.status === 'syncing'}
                        onClick={() => void act({ type: 'retrySync', attemptId: j.attemptId })}
                      >
                        Retry sync
                      </button>
                    )}
                  </div>
                ))
            ) : (
              <p className="small" style={{ marginTop: 10 }}>
                No syncs yet. Completed attempts with captured or pasted code can be committed here.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
