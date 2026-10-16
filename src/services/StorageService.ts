import { validatePreparation } from '../features/preparation/model';
import type { AppState, Settings } from '../types';

export const STATE_KEY = 'dsacommit.state';
export const TOKEN_KEY = 'dsacommit.github-token';
export const CHECKPOINT_KEY = 'dsacommit.checkpoint';
export const QUARANTINE_KEY = 'dsacommit.recovery-original';
export const defaultSettings: Settings = {
  onboardingComplete: false,
  dailyGoal: 2,
  primaryLanguage: 'python3',
  curriculumId: 'striver180',
  timerBehavior: 'manual',
  showPattern: true,
  revisionScheduling: true,
  debug: false,
  theme: 'system',
  github: {
    enabled: false,
    repository: '',
    branch: 'main',
    autoCommit: true,
    includeMetadata: true,
    updateReadme: false,
  },
};
export function emptyState(): AppState {
  return {
    schemaVersion: 2,
    settings: structuredClone(defaultSettings),
    attempts: {},
    progress: {},
    activities: {},
    queues: {},
    syncJobs: {},
  };
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
/** Fail closed on unknown schemas; never silently erase data written by a newer release. */
export function migrateState(raw: unknown): AppState {
  if (raw === undefined || raw === null) return emptyState();
  if (!record(raw))
    throw new Error('Stored data is invalid. Export a backup before making changes.');
  if (raw.schemaVersion !== undefined && ![0, 1, 2].includes(raw.schemaVersion as number))
    throw new Error('This data requires a newer DSACommit version.');
  const settings = record(raw.settings) ? raw.settings : {};
  const result = {
    ...emptyState(),
    ...structuredClone(raw),
    schemaVersion: 2,
    settings: {
      ...defaultSettings,
      ...settings,
      github: { ...defaultSettings.github, ...(record(settings.github) ? settings.github : {}) },
    },
  } as AppState;
  for (const key of ['attempts', 'progress', 'activities', 'queues', 'syncJobs'] as const) {
    if (raw[key] !== undefined && !record(raw[key]))
      throw new Error(`Invalid stored ${key}; data has been preserved.`);
  }
  if (
    !Number.isInteger(result.settings.dailyGoal) ||
    result.settings.dailyGoal < 1 ||
    result.settings.dailyGoal > 20
  )
    throw new Error('Invalid stored daily goal.');
  for (const attempt of Object.values(result.attempts)) {
    if (!attempt || !attempt.id || !attempt.problemId || !Number.isFinite(attempt.activeSeconds))
      throw new Error('Invalid stored attempt; data has been preserved.');
    attempt.submissionIds ??= [];
    attempt.kind ??= 'new';
    if (raw.schemaVersion === 0 || raw.schemaVersion === undefined) {
      attempt.hintsUsed ??= 0;
      attempt.startedAt ??= attempt.completedAt ?? '1970-01-01T00:00:00.000Z';
      if (attempt.status === 'completed') attempt.completedAt ??= attempt.startedAt;
    }
    if (attempt.code && !attempt.codeProvenance) attempt.codeProvenance = 'legacy-unverified';
  }
  for (const p of Object.values(result.progress)) {
    if (!record(p)) throw new Error('Invalid stored progress.');
    p.successfulRevisions ??= 0;
  }
  if (result.preparation !== undefined)
    result.preparation = validatePreparation(result.preparation);
  validateRecords(result);
  return result;
}
/** Reject corrupted records before a mutation can replace any historical state. */
function validateRecords(s: AppState) {
  if (s.preparation !== undefined) validatePreparation(s.preparation);
  const fail = () => {
    throw new Error(
      'Invalid stored records. Original data is preserved; restore a verified backup.',
    );
  };
  const strings = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((x) => typeof x === 'string');
  const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
  if (
    !Number.isInteger(s.settings.dailyGoal) ||
    s.settings.dailyGoal < 1 ||
    s.settings.dailyGoal > 20
  )
    fail();
  for (const [id, a] of Object.entries(s.attempts)) {
    if (
      !a ||
      !Number.isFinite(a.activeSeconds) ||
      (a.language !== undefined && typeof a.language !== 'string')
    )
      fail();
    if (
      a.hintLevels !== undefined &&
      (!Array.isArray(a.hintLevels) || a.hintLevels.some((n) => ![1, 2, 3].includes(n)))
    )
      fail();
    if (
      a.learning !== undefined &&
      (!record(a.learning) ||
        ['invariant', 'bruteForce', 'edgeCase', 'nextTime'].some(
          (key) =>
            a.learning![key as keyof typeof a.learning] !== undefined &&
            typeof a.learning![key as keyof typeof a.learning] !== 'string',
        ) ||
        (a.learning.mistakes !== undefined && !strings(a.learning.mistakes)))
    )
      fail();
    if (
      a.complexityAnalysis !== undefined &&
      (!record(a.complexityAnalysis) ||
        a.complexityAnalysis.method !== 'local-heuristic' ||
        !strings(a.complexityAnalysis.reasoning) ||
        !strings(a.complexityAnalysis.variables) ||
        !strings(a.complexityAnalysis.uncertainty) ||
        typeof a.complexityAnalysis.reviewed !== 'boolean' ||
        typeof a.complexityAnalysis.codeFingerprint !== 'string')
    )
      fail();
    if (
      a.id !== id ||
      !date(a.startedAt) ||
      !['ready', 'active', 'paused', 'accepted', 'completed', 'abandoned'].includes(a.status) ||
      a.activeSeconds < 0 ||
      !strings(a.submissionIds) ||
      !Number.isInteger(a.submissionCount) ||
      a.submissionCount < 0 ||
      !Number.isInteger(a.hintsUsed) ||
      a.hintsUsed < 0 ||
      (a.status === 'active' && !date(a.runningSince)) ||
      (a.status === 'completed' &&
        (!date(a.completedAt) ||
          !['independent', 'assisted', 'relearn'].includes(a.confidence!))) ||
      (a.code !== undefined && (typeof a.code !== 'string' || a.code.length > 200_000))
    )
      fail();
  }
  for (const [id, p] of Object.entries(s.progress))
    if (
      !p ||
      p.problemId !== id ||
      !strings(p.attemptIds) ||
      !['not_started', 'in_progress', 'independent', 'assisted', 'relearn'].includes(p.state)
    )
      fail();
  for (const [key, a] of Object.entries(s.activities))
    if (
      !a ||
      a.date !== key ||
      !/^\d{4}-\d{2}-\d{2}$/.test(key) ||
      !Number.isInteger(a.goal) ||
      a.goal < 1 ||
      a.goal > 20 ||
      !strings(a.attemptIds) ||
      !strings(a.problemIds)
    )
      fail();
  for (const [key, q] of Object.entries(s.queues))
    if (
      !q ||
      q.date !== key ||
      !Array.isArray(q.items) ||
      q.items.some(
        (i) => !i || typeof i.problemId !== 'string' || !['new', 'revision'].includes(i.kind),
      )
    )
      fail();
  for (const [id, j] of Object.entries(s.syncJobs))
    if (
      !j ||
      j.id !== id ||
      !['pending', 'syncing', 'synced', 'failed'].includes(j.status) ||
      !Number.isInteger(j.attempts) ||
      !date(j.updatedAt)
    )
      fail();
  if (s.pendingSubmissions !== undefined && !record(s.pendingSubmissions)) fail();
  for (const [id, p] of Object.entries(s.pendingSubmissions ?? {}))
    if (
      !p ||
      p.requestId !== id ||
      !s.attempts[p.attemptId] ||
      !date(p.submittedAt) ||
      typeof p.problemSlug !== 'string' ||
      !['waiting', 'checking', 'resolved', 'recovery'].includes(p.status)
    )
      fail();
}
export interface StorageDriver {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}
/** All transactions run in the background context. One atomic document includes progress and outbox. */
export class StorageService {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private driver: StorageDriver) {}
  async read(): Promise<AppState> {
    const raw = (await this.driver.get(STATE_KEY))[STATE_KEY];
    try {
      if (raw === null) throw new Error('Stored state is null; recovery is required.');
      if (raw === undefined) {
        const checkpoint = (await this.driver.get(CHECKPOINT_KEY))[CHECKPOINT_KEY];
        if (checkpoint !== undefined) return this.recovered(checkpoint);
      }
      return migrateState(raw);
    } catch (error) {
      // Future schemas belong to a newer version: never downgrade them using an older checkpoint.
      if (
        record(raw) &&
        ((typeof raw.schemaVersion === 'number' && raw.schemaVersion > 2) ||
          (record(raw.preparation) &&
            typeof raw.preparation.version === 'number' &&
            raw.preparation.version > 1))
      )
        throw error;
      const checkpoint = (await this.driver.get(CHECKPOINT_KEY))[CHECKPOINT_KEY];
      if (checkpoint === undefined) throw error;
      return this.recovered(checkpoint);
    }
  }
  private recovered(raw: unknown) {
    const state = migrateState(raw);
    state.recoveryNotice =
      'Recovered the last valid checkpoint. A recent change may be missing. Export recovery data and review your last attempt.';
    return state;
  }
  async exportRecovery() {
    const keys = [STATE_KEY, CHECKPOINT_KEY, QUARANTINE_KEY];
    const result: Record<string, unknown> = {};
    for (const key of keys) result[key] = (await this.driver.get(key))[key];
    return result;
  }
  transaction<T>(fn: (state: AppState) => T | Promise<T>, restoreCorrupt = false): Promise<T> {
    const task = this.tail.then(async () => {
      let state: AppState;
      try {
        state = await this.read();
      } catch (error) {
        if (!restoreCorrupt) throw error;
        const raw = (await this.driver.get(STATE_KEY))[STATE_KEY];
        if (
          record(raw) &&
          ((typeof raw.schemaVersion === 'number' && raw.schemaVersion > 2) ||
            (record(raw.preparation) &&
              typeof raw.preparation.version === 'number' &&
              raw.preparation.version > 1))
        )
          throw error;
        if ((await this.driver.get(QUARANTINE_KEY))[QUARANTINE_KEY] === undefined)
          await this.driver.set({ [QUARANTINE_KEY]: raw });
        state = emptyState();
        state.recoveryNotice =
          'Restored from backup. Original unreadable data remains in recovery records.';
      }
      const previous = structuredClone(state);
      const value = await fn(state);
      validateRecords(state);
      state.revision = (state.revision ?? 0) + 1;
      if (previous.recoveryNotice) {
        const raw = (await this.driver.get(STATE_KEY))[STATE_KEY];
        if (
          raw !== undefined &&
          (await this.driver.get(QUARANTINE_KEY))[QUARANTINE_KEY] === undefined
        ) {
          try {
            migrateState(raw);
          } catch {
            await this.driver.set({ [QUARANTINE_KEY]: raw });
          }
        }
      }
      // Write the checkpoint first; failure leaves the authoritative document untouched.
      await this.driver.set({ [CHECKPOINT_KEY]: previous });
      await this.driver.set({ [STATE_KEY]: state });
      return value;
    });
    this.tail = task.catch(() => undefined);
    return task;
  }
}
