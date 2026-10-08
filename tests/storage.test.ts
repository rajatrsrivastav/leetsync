import { describe, expect, it } from 'vitest';
import {
  emptyState,
  migrateState,
  STATE_KEY,
  StorageService,
  type StorageDriver,
} from '../src/services/StorageService';
import { prepareAttempt, startAttempt } from '../src/domain/attempt';
import type { CurriculumProblem } from '../src/types';

class MemoryDriver implements StorageDriver {
  data: Record<string, unknown> = {};
  writes = 0;
  failNextWrite = false;
  async get(key: string) {
    return { [key]: structuredClone(this.data[key]) };
  }
  async set(items: Record<string, unknown>) {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('Storage quota exceeded');
    }
    this.writes += 1;
    Object.assign(this.data, structuredClone(items));
  }
}

const problem: CurriculumProblem = {
  id: 'two-sum',
  order: 1,
  title: 'Two Sum',
  module: 'Arrays',
  platform: 'leetcode',
  problemUrl: 'https://leetcode.com/problems/two-sum/',
};

describe('storage migrations', () => {
  it('initializes independent default objects for fresh installs', () => {
    const first = migrateState(undefined);
    const second = migrateState(null);
    expect(first.settings.dailyGoal).toBe(2);
    expect(first.settings.github.enabled).toBe(false);
    expect(first.schemaVersion).toBe(1);
    first.settings.github.repository = 'one/repo';
    expect(second.settings.github.repository).toBe('');
    expect(emptyState().settings.github.repository).toBe('');
  });

  it('adds defaults while retaining legacy settings, progress, and attempt history', () => {
    const migrated = migrateState({
      schemaVersion: 0,
      settings: { dailyGoal: 3, github: { repository: 'me/practice' } },
      attempts: {
        old: {
          id: 'old',
          problemId: 'two-sum',
          status: 'completed',
          activeSeconds: 120,
          submissionCount: 1,
          confidence: 'assisted',
          notes: 'Retain my note',
        },
      },
      progress: {
        'two-sum': {
          problemId: 'two-sum',
          state: 'assisted',
          attemptIds: ['old'],
          firstSolvedAt: '2026-10-01T12:00:00Z',
        },
      },
    });
    expect(migrated).toMatchObject({
      schemaVersion: 1,
      settings: {
        dailyGoal: 3,
        timerBehavior: 'manual',
        github: { repository: 'me/practice', enabled: false, branch: 'main' },
      },
    });
    expect(migrated.attempts.old).toMatchObject({
      activeSeconds: 120,
      notes: 'Retain my note',
      kind: 'new',
      submissionIds: [],
    });
    expect(migrated.progress['two-sum']).toMatchObject({
      attemptIds: ['old'],
      successfulRevisions: 0,
    });
  });

  it('accepts a pre-versioned empty state through the defined migration path', () => {
    expect(migrateState({ settings: { primaryLanguage: 'cpp' } })).toMatchObject({
      schemaVersion: 1,
      settings: { primaryLanguage: 'cpp', dailyGoal: 2 },
    });
  });

  it('round trips a valid active session and pending sync without resetting either', () => {
    const state = emptyState();
    prepareAttempt(state, problem, new Date('2026-10-08T12:00:00Z'), 'a');
    startAttempt(state, 'a', new Date('2026-10-08T12:01:00Z'));
    state.syncJobs.old = {
      id: 'old',
      attemptId: 'old',
      status: 'failed',
      attempts: 2,
      lastError: 'Offline',
      updatedAt: '2026-10-08T12:00:00Z',
    };
    expect(migrateState(structuredClone(state))).toEqual(state);
  });

  it.each([2, 99, -1, '1'])(
    'refuses unsupported schema version %s rather than erasing user data',
    (schemaVersion) => {
      expect(() => migrateState({ schemaVersion })).toThrow(/newer DSACommit/);
    },
  );

  it.each([[], 'bad', 42])('rejects malformed root storage', (value) => {
    expect(() => migrateState(value)).toThrow(/invalid/i);
  });

  it.each(['attempts', 'progress', 'activities', 'queues', 'syncJobs'])(
    'rejects an invalid %s container',
    (key) => {
      expect(() => migrateState({ schemaVersion: 1, [key]: [] })).toThrow(/Invalid stored/);
    },
  );

  it.each([0, -1, 1.5, 21, '2'])('rejects invalid stored daily goal %s', (dailyGoal) => {
    expect(() => migrateState({ settings: { dailyGoal } })).toThrow(/daily goal/);
  });
});

describe('serialized atomic storage transactions', () => {
  it('serializes asynchronous concurrent writes so neither update is lost', async () => {
    const driver = new MemoryDriver();
    const storage = new StorageService(driver);
    const events: string[] = [];
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = storage.transaction(async (state) => {
      events.push('first started');
      await pending;
      state.settings.dailyGoal += 1;
      events.push('first completed');
      return state.settings.dailyGoal;
    });
    const second = storage.transaction((state) => {
      events.push('second started');
      state.settings.dailyGoal += 1;
      return state.settings.dailyGoal;
    });
    release();
    expect(await Promise.all([first, second])).toEqual([3, 4]);
    expect(events).toEqual(['first started', 'first completed', 'second started']);
    expect((await storage.read()).settings.dailyGoal).toBe(4);
  });

  it('does not persist a failed mutation and permits the next queued transaction to proceed', async () => {
    const driver = new MemoryDriver();
    const storage = new StorageService(driver);
    await expect(
      storage.transaction((state) => {
        state.settings.dailyGoal = 9;
        throw new Error('Invalid reflection');
      }),
    ).rejects.toThrow('Invalid reflection');
    expect(driver.writes).toBe(0);
    expect((await storage.read()).settings.dailyGoal).toBe(2);
    await storage.transaction((state) => {
      state.settings.primaryLanguage = 'cpp';
    });
    expect((await storage.read()).settings.primaryLanguage).toBe('cpp');
  });

  it('reports driver write failures without poisoning subsequent transactions', async () => {
    const driver = new MemoryDriver();
    const storage = new StorageService(driver);
    driver.failNextWrite = true;
    await expect(
      storage.transaction((state) => {
        state.settings.dailyGoal = 8;
      }),
    ).rejects.toThrow('Storage quota exceeded');
    expect((await storage.read()).settings.dailyGoal).toBe(2);
    await storage.transaction((state) => {
      state.settings.dailyGoal = 3;
    });
    expect((await storage.read()).settings.dailyGoal).toBe(3);
  });

  it('preserves unsupported future data byte-for-byte and performs no writes', async () => {
    const driver = new MemoryDriver();
    const future = { schemaVersion: 55, importantFutureData: ['retain', 'all', 'of', 'this'] };
    driver.data[STATE_KEY] = structuredClone(future);
    const storage = new StorageService(driver);
    await expect(
      storage.transaction((state) => {
        state.settings.dailyGoal = 1;
      }),
    ).rejects.toThrow(/newer/);
    expect(driver.data[STATE_KEY]).toEqual(future);
    expect(driver.writes).toBe(0);
  });

  it('reads detached snapshots so UI mutations do not alter stored progress', async () => {
    const driver = new MemoryDriver();
    const storage = new StorageService(driver);
    await storage.transaction((state) => {
      state.settings.dailyGoal = 3;
    });
    const read = await storage.read();
    read.settings.dailyGoal = 10;
    expect((await storage.read()).settings.dailyGoal).toBe(3);
  });
});
