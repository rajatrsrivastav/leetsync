import { describe, it, expect, vi } from 'vitest';
import {
  StorageService,
  STATE_KEY,
  CHECKPOINT_KEY,
  QUARANTINE_KEY,
  emptyState,
} from '../src/services/StorageService';
import { createBackup, parseBackup, mergeBackup } from '../src/services/BackupService';
import { prepareAttempt, startAttempt, manualAccept, completeAttempt } from '../src/domain/attempt';
import {
  verifiedSource,
  verifySubmission,
  normalizeCheck,
} from '../src/platforms/leetcode/submissionVerification';
import { analyzeComplexity } from '../src/services/ComplexityService';
import { practiceSignals } from '../src/services/PracticeSignals';
const problem = {
  id: 'p',
  order: 1,
  title: 'P',
  module: 'Arrays',
  platform: 'leetcode' as const,
  problemUrl: 'https://leetcode.com/problems/p/',
};
const now = new Date('2026-10-08T10:00:00Z');
function driver() {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: async (k: string) => ({ [k]: structuredClone(data[k]) }),
    set: async (items: Record<string, unknown>) => {
      Object.assign(data, structuredClone(items));
    },
  };
}
describe('durable recovery and backups', () => {
  it('preserves all state through new worker instances and repeated writes', async () => {
    const d = driver();
    const s = new StorageService(d);
    await s.transaction((state) => {
      prepareAttempt(state, problem, now, 'a');
      startAttempt(state, 'a', now);
      state.settings.debug = true;
    });
    const before = await s.read();
    expect(await new StorageService(d).read()).toEqual(before);
    expect(d.data[CHECKPOINT_KEY]).toBeTruthy();
  });
  it('recovers corruption and retains the original after further transactions', async () => {
    const d = driver();
    const s = new StorageService(d);
    await s.transaction((x) => {
      x.settings.dailyGoal = 3;
    });
    await s.transaction((x) => {
      x.settings.debug = true;
    });
    d.data[STATE_KEY] = 'corrupt original';
    expect((await s.read()).settings.dailyGoal).toBe(3);
    await s.transaction((x) => {
      x.settings.primaryLanguage = 'cpp';
    });
    await s.transaction((x) => {
      x.settings.debug = false;
    });
    expect(d.data[QUARANTINE_KEY]).toBe('corrupt original');
    expect((await s.read()).recoveryNotice).toBeTruthy();
  });
  it('does not replace authoritative state if checkpoint storage fails', async () => {
    const d = driver();
    const s = new StorageService(d);
    await s.transaction((x) => {
      x.settings.dailyGoal = 3;
    });
    const original = structuredClone(d.data[STATE_KEY]);
    d.set = async () => {
      throw Error('quota');
    };
    await expect(
      s.transaction((x) => {
        x.settings.dailyGoal = 4;
      }),
    ).rejects.toThrow('quota');
    expect(d.data[STATE_KEY]).toEqual(original);
  });
  it('refuses future schemas even with a valid checkpoint', async () => {
    const d = driver();
    d.data[STATE_KEY] = { schemaVersion: 99 };
    d.data[CHECKPOINT_KEY] = emptyState();
    await expect(new StorageService(d).read()).rejects.toThrow('newer');
  });
  it('merges a backup idempotently, pauses imported timers, and excludes credentials', () => {
    const state = emptyState();
    prepareAttempt(state, problem, now, 'a');
    startAttempt(state, 'a', now);
    const backup = createBackup(state, new Date(+now + 60000));
    expect(JSON.stringify(backup)).not.toContain('github-token');
    const imported = mergeBackup(
      emptyState(),
      parseBackup(JSON.stringify(backup)),
      new Date(+now + 120000),
    );
    expect(imported.attempts.a).toMatchObject({ status: 'paused', activeSeconds: 60 });
    expect(mergeBackup(imported, parseBackup(JSON.stringify(backup)))).toEqual(imported);
  });
  it('restores unreadable state only through explicit recovery and retains originals', async () => {
    const d = driver();
    d.data[STATE_KEY] = 'broken';
    const s = new StorageService(d);
    await expect(s.transaction(() => {})).rejects.toThrow();
    await s.transaction(
      (x) =>
        Object.assign(x, mergeBackup(x, parseBackup(JSON.stringify(createBackup(emptyState()))))),
      true,
    );
    expect(d.data[QUARANTINE_KEY]).toBe('broken');
    expect((await s.read()).schemaVersion).toBe(2);
  });
  it('rejects malformed imports and prototype keys', () => {
    expect(() => parseBackup('{"__proto__":{}}')).toThrow();
    const b = createBackup(emptyState());
    (b.state.attempts as any).a = { id: 'a' };
    expect(() => parseBackup(JSON.stringify(b))).toThrow();
  });
});
describe('submission authority', () => {
  const at = new Date().toISOString();
  const details = () => ({
    data: {
      submissionDetails: {
        id: '123',
        code: 'exact source\n',
        statusCode: 10,
        timestamp: String(Math.floor(Date.now() / 1000)),
        lang: { name: 'Python3' },
        question: { titleSlug: 'p' },
      },
    },
  });
  it('requires terminal Accepted, matching identity, problem, and fresh timestamp', () => {
    expect(normalizeCheck({ state: 'PENDING', status_code: 10 })).toBeNull();
    expect(verifiedSource(details(), '123', 'p', at)).toEqual({
      code: 'exact source\n',
      language: 'Python3',
    });
    expect(verifiedSource(details(), '124', 'p', at)).toBeNull();
    expect(verifiedSource(details(), '123', 'other', at)).toBeNull();
    const old = details();
    old.data.submissionDetails.timestamp = '1';
    expect(verifiedSource(old, '123', 'p', at)).toBeNull();
  });
  it('captures the source from submission details, independent of editor snapshots', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ state: 'SUCCESS', status_code: 10 })))
      .mockResolvedValueOnce(new Response(JSON.stringify(details())));
    expect(await verifySubmission('123', 'p', at, fetcher)).toMatchObject({
      code: 'exact source\n',
      codeProvenance: 'server-verified',
      id: 'leetcode:submission:123',
    });
  });
  it('keeps Accepted without code when source verification fails', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ state: 'SUCCESS', status_code: 10 })))
      .mockResolvedValueOnce(new Response('{}', { status: 403 }));
    const result = await verifySubmission('123', 'p', at, fetcher);
    expect(result?.verdict).toBe('accepted');
    expect(result?.code).toBeUndefined();
  });
  it('never queues legacy source and marks assisted solves honestly', () => {
    const s = emptyState();
    s.settings.github.enabled = true;
    prepareAttempt(s, problem, now, 'a');
    manualAccept(s, 'a', now);
    s.attempts.a!.hintsUsed = 1;
    completeAttempt(s, 'a', { confidence: 'independent', code: 'old', language: 'python3' }, now);
    expect(s.syncJobs).toEqual({});
    expect(s.attempts.a!.confidence).toBe('assisted');
    expect(practiceSignals(s, problem).reasons).toContain('Last solve used help');
  });
  it('queues manually confirmed source', () => {
    const s = emptyState();
    s.settings.github.enabled = true;
    prepareAttempt(s, problem, now, 'a');
    manualAccept(s, 'a', now);
    completeAttempt(
      s,
      'a',
      { confidence: 'independent', code: 'exact', language: 'python3', codeConfirmed: true },
      now,
    );
    expect(s.syncJobs.a?.status).toBe('pending');
  });
});
it('does not manufacture complexity from loops or recursion', () => {
  const a = analyzeComplexity('def solve(nums):\n for n in nums:\n  recurse(n)', 'python3');
  expect(a.time).toBeUndefined();
  expect(a.space).toBeUndefined();
  expect(a.variables[0]).toContain('nums');
  expect(a.reviewed).toBe(false);
  expect(a.uncertainty.length).toBeGreaterThan(0);
});
