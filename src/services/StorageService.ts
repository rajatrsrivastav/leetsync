import type { AppState, Settings } from '../types';

export const STATE_KEY = 'dsacommit.state';
export const TOKEN_KEY = 'dsacommit.github-token';
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
    schemaVersion: 1,
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
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 0 && raw.schemaVersion !== 1)
    throw new Error('This data requires a newer DSACommit version.');
  const settings = record(raw.settings) ? raw.settings : {};
  const result = {
    ...emptyState(),
    ...raw,
    schemaVersion: 1,
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
  }
  for (const p of Object.values(result.progress)) p.successfulRevisions ??= 0;
  return result;
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
    return migrateState((await this.driver.get(STATE_KEY))[STATE_KEY]);
  }
  transaction<T>(fn: (state: AppState) => T | Promise<T>): Promise<T> {
    const task = this.tail.then(async () => {
      const state = await this.read();
      const value = await fn(state);
      await this.driver.set({ [STATE_KEY]: state });
      return value;
    });
    this.tail = task.catch(() => undefined);
    return task;
  }
}
