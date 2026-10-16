import type { CurriculumProblem, SyncJob } from '../types';
import type { GitHubService } from './GitHubService';
import type { StorageService } from './StorageService';

export function retryDue(job: SyncJob, now = new Date()): boolean {
  if (job.status === 'synced') return false;
  if (job.status === 'pending' || job.status === 'syncing') return true;
  const delay = Math.min(60, 2 ** Math.max(0, job.attempts - 1)) * 60_000;
  return job.attempts < 5 && now.getTime() - Date.parse(job.updatedAt) >= delay;
}

/** Durable outbox. Remote calls happen outside storage transactions; local solves stay responsive. */
export class GitHubSyncService {
  private running: Promise<void> | undefined;
  constructor(
    private storage: StorageService,
    private github: Pick<GitHubService, 'sync'>,
    private problems: CurriculumProblem[],
    private permitted: () => Promise<boolean>,
    private now = () => new Date(),
  ) {}
  drain(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.run().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }
  private async run() {
    const initial = await this.storage.read();
    if (!initial.settings.github.enabled) return;
    const ids = Object.values(initial.syncJobs)
      .filter((j) => retryDue(j, this.now()))
      .map((j) => j.id);
    for (const id of ids) {
      const snapshot = await this.storage.transaction((state) => {
        const job = state.syncJobs[id];
        if (!state.settings.github.enabled || !job || !retryDue(job, this.now())) return undefined;
        job.destination ??= {
          repository: state.settings.github.repository,
          branch: state.settings.github.branch,
        };
        job.status = 'syncing';
        job.attempts += 1;
        job.updatedAt = this.now().toISOString();
        delete job.lastError;
        return state;
      });
      if (!snapshot) continue;
      const job = snapshot.syncJobs[id]!;
      try {
        if (!(await this.permitted()))
          throw new Error(
            'GitHub permission is missing. Save your configuration in Settings to grant it.',
          );
        const attempt = snapshot.attempts[job.attemptId];
        const problem = this.problems.find((p) => p.id === attempt?.problemId);
        if (!attempt || !problem)
          throw new Error(
            'This attempt’s curriculum problem is unavailable. Restore the curriculum before retrying.',
          );
        if (job.destination) Object.assign(snapshot.settings.github, job.destination);
        const result = await this.github.sync(attempt, problem, snapshot, this.problems);
        await this.storage.transaction((state) => {
          const current = state.syncJobs[id];
          if (!current) return;
          current.status = 'synced';
          current.commitUrl = result.commitUrl;
          current.updatedAt = this.now().toISOString();
          delete current.lastError;
        });
      } catch (error) {
        await this.storage.transaction((state) => {
          const current = state.syncJobs[id];
          if (!current || current.status === 'synced') return;
          current.status = 'failed';
          current.updatedAt = this.now().toISOString();
          // GitHubService only exposes sanitized diagnostics, never raw API bodies or credentials.
          current.lastError =
            error instanceof Error ? error.message : 'Sync failed. Your progress is saved locally.';
        });
      }
    }
  }
}
