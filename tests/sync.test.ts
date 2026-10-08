import { describe, expect, it, vi } from 'vitest';
import { GitHubSyncService, retryDue } from '../src/services/GitHubSyncService';
import {
  emptyState,
  STATE_KEY,
  StorageService,
  type StorageDriver,
} from '../src/services/StorageService';
import { completeAttempt, manualAccept, prepareAttempt } from '../src/domain/attempt';
import type { CurriculumProblem, SyncJob } from '../src/types';
const p: CurriculumProblem = {
  id: 'p',
  order: 1,
  title: 'Example',
  module: 'Arrays',
  platform: 'leetcode',
  slug: 'example',
  problemUrl: 'https://leetcode.com/problems/example/',
};
const date = new Date('2026-10-08T12:00:00Z');
class Memory implements StorageDriver {
  data: Record<string, unknown> = {};
  async get() {
    return structuredClone(this.data);
  }
  async set(v: Record<string, unknown>) {
    Object.assign(this.data, structuredClone(v));
  }
}
async function setup() {
  const driver = new Memory();
  const state = emptyState();
  state.settings.github.enabled = true;
  state.settings.github.repository = 'test/solutions';
  prepareAttempt(state, p, date, 'attempt');
  manualAccept(state, 'attempt', date);
  completeAttempt(
    state,
    'attempt',
    { confidence: 'assisted', code: 'print(1)', language: 'python3' },
    date,
  );
  driver.data[STATE_KEY] = state;
  return new StorageService(driver);
}
describe('durable GitHub outbox', () => {
  it('does not lose local progress when GitHub is offline', async () => {
    const storage = await setup();
    const github = { sync: vi.fn().mockRejectedValue(new Error('Offline')) };
    await new GitHubSyncService(
      storage,
      github,
      [p],
      async () => true,
      () => date,
    ).drain();
    const saved = await storage.read();
    expect(saved.attempts.attempt?.status).toBe('completed');
    expect(saved.progress.p?.state).toBe('assisted');
    expect(saved.syncJobs.attempt).toMatchObject({
      status: 'failed',
      attempts: 1,
      lastError: 'Offline',
    });
  });
  it('coalesces concurrent wakeups and preserves new work during a remote request', async () => {
    const storage = await setup();
    let release!: (v: { commitUrl: string }) => void;
    const github = {
      sync: vi.fn(
        () =>
          new Promise<{ commitUrl: string }>((r) => {
            release = r;
          }),
      ),
    };
    const service = new GitHubSyncService(
      storage,
      github,
      [p],
      async () => true,
      () => date,
    );
    const first = service.drain();
    const second = service.drain();
    await vi.waitFor(() => expect(github.sync).toHaveBeenCalledTimes(1));
    await storage.transaction((s) => {
      s.settings.primaryLanguage = 'java';
    });
    release({ commitUrl: 'https://github.com/test/solutions/commit/abc' });
    await Promise.all([first, second]);
    const saved = await storage.read();
    expect(saved.syncJobs.attempt?.status).toBe('synced');
    expect(saved.settings.primaryLanguage).toBe('java');
    await service.drain();
    expect(github.sync).toHaveBeenCalledTimes(1);
  });
  it('recovers an interrupted syncing job after worker restart', async () => {
    const storage = await setup();
    await storage.transaction((s) => {
      s.syncJobs.attempt!.status = 'syncing';
      s.syncJobs.attempt!.attempts = 1;
    });
    const github = {
      sync: vi
        .fn()
        .mockResolvedValue({ commitUrl: 'https://github.com/test/solutions/commit/abc' }),
    };
    await new GitHubSyncService(
      storage,
      github,
      [p],
      async () => true,
      () => date,
    ).drain();
    expect((await storage.read()).syncJobs.attempt).toMatchObject({
      status: 'synced',
      attempts: 2,
    });
  });
  it('never contacts GitHub when disabled or permission was revoked', async () => {
    const storage = await setup();
    const github = { sync: vi.fn() };
    await new GitHubSyncService(
      storage,
      github,
      [p],
      async () => false,
      () => date,
    ).drain();
    expect(github.sync).not.toHaveBeenCalled();
    expect((await storage.read()).syncJobs.attempt?.lastError).toContain('permission');
    await storage.transaction((s) => {
      s.settings.github.enabled = false;
      s.syncJobs.attempt!.status = 'pending';
    });
    await new GitHubSyncService(
      storage,
      github,
      [p],
      async () => true,
      () => date,
    ).drain();
    expect(github.sync).not.toHaveBeenCalled();
  });
  it('backs off failed jobs and stops automatically after five tries', () => {
    const job: SyncJob = {
      id: 'a',
      attemptId: 'a',
      status: 'failed',
      attempts: 1,
      updatedAt: date.toISOString(),
    };
    expect(retryDue(job, date)).toBe(false);
    expect(retryDue(job, new Date(+date + 60_000))).toBe(true);
    expect(retryDue({ ...job, attempts: 5 }, new Date(+date + 86400000))).toBe(false);
    expect(retryDue({ ...job, status: 'synced' }, new Date(+date + 86400000))).toBe(false);
  });
});
