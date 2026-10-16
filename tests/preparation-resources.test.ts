import { describe, expect, it } from 'vitest';
import {
  applyPreparationAction,
  defaultPreparation,
  validatePreparation,
} from '../src/features/preparation/model';
import type {
  PreparationAction,
  PreparationState,
  ResourceProgressEntry,
} from '../src/features/preparation/types';
import { createBackup, mergeBackup, parseBackup } from '../src/services/BackupService';
import {
  emptyState,
  migrateState,
  STATE_KEY,
  StorageService,
} from '../src/services/StorageService';

const now = new Date('2026-10-17T12:00:00.000Z');
const later = new Date(+now + 60_000);
const entry = (fields: Partial<ResourceProgressEntry> = {}): ResourceProgressEntry => ({
  id: 'study-1',
  resourceId: 'core-cs',
  topic: 'Processes and threads',
  subject: 'os',
  completed: true,
  minutes: 20,
  studiedAt: now.toISOString(),
  ...fields,
});
const act = (prep: PreparationState, action: PreparationAction, date = now) =>
  applyPreparationAction(prep, action, [], [], date);
function withHistory(): PreparationState {
  const prep = defaultPreparation();
  prep.sessions.old = {
    id: 'old',
    lessonId: 'os-old',
    startedAt: '2026-10-16T12:00:00.000Z',
    status: 'completed',
    seconds: 300,
    completedAt: '2026-10-16T12:05:00.000Z',
    confidence: 'assisted',
    reflection: 'Keep my old learning history',
    answers: {},
  };
  prep.progress['os-old'] = {
    lessonId: 'os-old',
    sessionIds: ['old'],
    lastCompletedAt: '2026-10-16T12:05:00.000Z',
    dueAt: '2026-10-23T12:05:00.000Z',
    intervalDays: 7,
    independentReviews: 0,
    confidence: 'assisted',
  };
  return prep;
}

describe('Resource tracking domain', () => {
  it('adds optional tracking without changing preparation version or legacy history', () => {
    const prep = withHistory();
    const original = validatePreparation(prep);
    expect(original.resourceTracking).toBeUndefined();
    act(prep, { type: 'prepResourceProgress', entry: entry() });
    const { resourceTracking, ...retained } = validatePreparation(prep);
    expect(retained).toEqual(original);
    expect(prep.version).toBe(1);
    expect(resourceTracking?.entries['study-1']).toEqual(entry());
    const state = { ...emptyState(), preparation: prep };
    expect(migrateState(JSON.parse(JSON.stringify(state))).preparation).toEqual(
      validatePreparation(prep),
    );
  });

  it('tracks visits and explicit bookmarks without claiming completion or study time', () => {
    const prep = defaultPreparation();
    act(prep, { type: 'prepResourceVisit', resourceId: 'hld-primary' });
    expect(prep.resourceTracking).toEqual({
      resources: { 'hld-primary': { bookmarked: false, lastVisitedAt: now.toISOString() } },
      entries: {},
    });
    expect(prep.progress).toEqual({});
    expect(prep.sessions).toEqual({});
    act(prep, { type: 'prepResourceBookmark', resourceId: 'hld-primary', bookmarked: true });
    act(prep, { type: 'prepResourceVisit', resourceId: 'hld-primary' }, later);
    act(prep, { type: 'prepResourceVisit', resourceId: 'hld-primary' }, now);
    expect(prep.resourceTracking?.resources['hld-primary']).toEqual({
      bookmarked: true,
      lastVisitedAt: later.toISOString(),
    });
    act(prep, { type: 'prepResourceBookmark', resourceId: 'hld-primary', bookmarked: false });
    expect(prep.resourceTracking?.resources['hld-primary']?.bookmarked).toBe(false);
  });

  it('appends explicit study records idempotently and rejects a conflicting reused entry ID', () => {
    const prep = defaultPreparation();
    act(prep, { type: 'prepResourceProgress', entry: entry() });
    const before = structuredClone(prep);
    act(prep, { type: 'prepResourceProgress', entry: entry() }, later);
    expect(prep).toEqual(before);
    expect(() =>
      act(prep, { type: 'prepResourceProgress', entry: entry({ minutes: 99 }) }),
    ).toThrow('already used');
    expect(prep).toEqual(before);
    act(prep, {
      type: 'prepResourceProgress',
      entry: entry({ id: 'study-2', completed: false, minutes: 0 }),
    });
    expect(Object.keys(prep.resourceTracking!.entries)).toEqual(['study-1', 'study-2']);
    expect(prep.resourceTracking!.entries['study-2']?.completed).toBe(false);
  });

  it.each<Partial<ResourceProgressEntry>>([
    { id: '__proto__' },
    { id: '' },
    { topic: '' },
    { topic: 'a'.repeat(501) },
    { resourceId: 'unlisted' },
    { subject: 'aptitude' },
    { minutes: -1 },
    { minutes: 0.5 },
    { minutes: 1441 },
    { studiedAt: '2026-02-30T12:00:00Z' },
    { studiedAt: later.toISOString() },
    { completed: 'yes' as unknown as boolean },
  ])('rejects malformed or unsupported study input without mutation: %j', (fields) => {
    const prep = defaultPreparation();
    const before = structuredClone(prep);
    expect(() => act(prep, { type: 'prepResourceProgress', entry: entry(fields) })).toThrow();
    expect(prep).toEqual(before);
  });

  it('rejects invalid bookmark values and catalog IDs without initializing tracking', () => {
    const prep = defaultPreparation();
    expect(() => act(prep, { type: 'prepResourceVisit', resourceId: 'missing' })).toThrow(
      'unavailable',
    );
    expect(() =>
      act(prep, {
        type: 'prepResourceBookmark',
        resourceId: 'core-cs',
        bookmarked: 1 as unknown as boolean,
      }),
    ).toThrow('bookmark');
    expect(prep.resourceTracking).toBeUndefined();
  });

  it('retains resource IDs from prior catalogs while blocking new unlisted entries', () => {
    const prep = defaultPreparation();
    prep.resourceTracking = {
      resources: { 'retired-resource': { bookmarked: true, lastVisitedAt: now.toISOString() } },
      entries: { legacy: entry({ id: 'legacy', resourceId: 'retired-resource' }) },
    };
    expect(validatePreparation(prep).resourceTracking).toEqual(prep.resourceTracking);
    expect(() =>
      act(prep, {
        type: 'prepResourceProgress',
        entry: entry({ id: 'new', resourceId: 'retired-resource' }),
      }),
    ).toThrow('unavailable');
  });

  it.each([
    null,
    [],
    { resources: {}, entries: [] },
    { resources: [], entries: {} },
    { resources: { 'core-cs': { bookmarked: 'yes' } }, entries: {} },
    { resources: {}, entries: { wrong: entry() } },
    { resources: {}, entries: { 'study-1': entry({ minutes: -1 }) } },
  ])('rejects corrupted tracking instead of replacing it: %j', (resourceTracking) => {
    const raw = { ...defaultPreparation(), resourceTracking };
    const original = structuredClone(raw);
    expect(() => validatePreparation(raw)).toThrow();
    expect(raw).toEqual(original);
  });
});

describe('Resource tracking persistence and backups', () => {
  it('persists tracking across storage service restarts alongside existing records', async () => {
    const data: Record<string, unknown> = {};
    const driver = {
      get: async (key: string) => ({ [key]: structuredClone(data[key]) }),
      set: async (items: Record<string, unknown>) => {
        Object.assign(data, structuredClone(items));
      },
    };
    await new StorageService(driver).transaction((state) => {
      state.preparation = withHistory();
      act(state.preparation, { type: 'prepResourceProgress', entry: entry() });
      state.settings.dailyGoal = 3;
    });
    const saved = await new StorageService(driver).read();
    expect(saved.settings.dailyGoal).toBe(3);
    expect(saved.preparation?.resourceTracking?.entries['study-1']).toEqual(entry());
    expect(saved.preparation?.sessions.old?.reflection).toBe('Keep my old learning history');
    expect(data[STATE_KEY]).toEqual(saved);
  });

  it('merges history without overwriting entry collisions or explicit local bookmarks', () => {
    const current = { ...emptyState(), preparation: defaultPreparation() };
    act(current.preparation, { type: 'prepResourceProgress', entry: entry() });
    act(current.preparation, {
      type: 'prepResourceBookmark',
      resourceId: 'core-cs',
      bookmarked: false,
    });
    const source = { ...emptyState(), preparation: withHistory() };
    act(source.preparation, { type: 'prepResourceProgress', entry: entry({ minutes: 45 }) });
    act(source.preparation, {
      type: 'prepResourceProgress',
      entry: entry({ id: 'another', topic: 'Memory paging' }),
    });
    act(source.preparation, {
      type: 'prepResourceBookmark',
      resourceId: 'core-cs',
      bookmarked: true,
    });
    act(source.preparation, { type: 'prepResourceVisit', resourceId: 'core-cs' }, later);
    act(source.preparation, { type: 'prepResourceBookmark', resourceId: 'lld', bookmarked: true });
    const original = structuredClone(current);
    const incoming = parseBackup(JSON.stringify(createBackup(source, later)));
    const merged = mergeBackup(current, incoming, later);
    expect(merged.preparation?.resourceTracking?.entries['study-1']).toEqual(entry());
    expect(merged.preparation?.resourceTracking?.entries.another?.topic).toBe('Memory paging');
    expect(merged.preparation?.resourceTracking?.resources['core-cs']).toEqual({
      bookmarked: false,
      lastVisitedAt: later.toISOString(),
    });
    expect(merged.preparation?.resourceTracking?.resources.lld?.bookmarked).toBe(true);
    expect(merged.preparation?.sessions.old).toEqual(source.preparation.sessions.old);
    expect(current).toEqual(original);
    expect(mergeBackup(merged, incoming, later)).toEqual(merged);
  });

  it('restores tracking into a fresh profile and does not replace an active tracker profile', () => {
    const source = { ...emptyState(), preparation: defaultPreparation() };
    source.preparation.profile.minutesPerDay = 90;
    act(source.preparation, { type: 'prepResourceProgress', entry: entry() });
    const incoming = parseBackup(JSON.stringify(createBackup(source, now)));
    const fresh = mergeBackup(emptyState(), incoming, later);
    expect(fresh.preparation?.resourceTracking).toEqual(
      validatePreparation(source.preparation).resourceTracking,
    );
    const current = { ...emptyState(), preparation: defaultPreparation() };
    act(current.preparation, { type: 'prepResourceVisit', resourceId: 'striver' });
    expect(mergeBackup(current, incoming, later).preparation?.profile.minutesPerDay).toBe(60);
  });
});
