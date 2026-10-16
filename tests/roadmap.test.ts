import { describe, expect, it } from 'vitest';
import {
  applyRoadmapAction,
  dueReviews,
  emptyRoadmap,
  ensureRoadmapDay,
  mergeRoadmap,
  roadmapOutcomeProblem,
  roadmapProgress,
  roadmapTrackSummary,
  upcomingRoadmap,
  validateRoadmap,
} from '../src/features/preparation/roadmap/model';
import {
  ROADMAP_TRACK_ORDER,
  roadmapTopicById,
  roadmapTopics,
} from '../src/features/preparation/roadmap/topics';
import { ROADMAP_TRACKS, type RoadmapResponse } from '../src/features/preparation/roadmap/types';
import { resourceById } from '../src/features/preparation/resources';
import { applyPreparationAction, defaultPreparation } from '../src/features/preparation/model';
import { preparationActivity } from '../src/features/preparation/tracking';
import { createBackup, mergeBackup, parseBackup } from '../src/services/BackupService';
import { emptyState, migrateState } from '../src/services/StorageService';
import { addLocalDays, localDate } from '../src/utils/date';

const day1 = new Date(2026, 9, 17, 9, 0, 0); // local time, 17 Oct 2026
const at = (days: number, hour = 9) => {
  const d = addLocalDays(day1, days);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const outcome = (
  assignmentId: string,
  topicId: string,
  fields: Partial<Omit<RoadmapResponse, 'recordedAt'>> = {},
): Omit<RoadmapResponse, 'recordedAt'> => ({
  assignmentId,
  topicId,
  status: 'completed',
  understanding: 'independent',
  practiceResult: 'completed',
  minutes: 25,
  notes: '',
  ...fields,
});

describe('roadmap catalog', () => {
  it('covers every track from foundation to advanced with unique, chained topics', () => {
    expect(roadmapTopics.length).toBeGreaterThanOrEqual(60);
    expect(new Set(roadmapTopics.map((t) => t.id)).size).toBe(roadmapTopics.length);
    for (const track of ROADMAP_TRACK_ORDER) {
      const topics = roadmapTopics.filter((t) => t.track === track);
      expect(topics.length).toBeGreaterThanOrEqual(8);
      expect(topics[0]?.level).toBe('Foundation');
      expect(topics.at(-1)?.level).toBe('Advanced');
      const levels = topics.map((t) => ['Foundation', 'Intermediate', 'Advanced'].indexOf(t.level));
      expect([...levels].sort((a, b) => a - b)).toEqual(levels);
      topics.forEach((t, i) => {
        expect(t.stage).toBe(i + 1);
        expect(t.prerequisites).toEqual(i ? [topics[i - 1]!.id] : []);
        expect(t.minutes).toBeGreaterThanOrEqual(20);
        expect(t.minutes).toBeLessThanOrEqual(30);
      });
    }
  });
  it('rotates tracks day by day in stage order', () => {
    const firstRound = roadmapTopics.slice(0, ROADMAP_TRACK_ORDER.length).map((t) => t.track);
    expect(firstRound).toEqual(ROADMAP_TRACK_ORDER);
    expect(Object.keys(ROADMAP_TRACKS).sort()).toEqual([...ROADMAP_TRACK_ORDER].sort());
    for (let i = 1; i < roadmapTopics.length; i++)
      expect(roadmapTopics[i]!.track).not.toBe(roadmapTopics[i - 1]!.track);
  });
  it('links every topic to a verified section or exercise, never a bare homepage', () => {
    for (const t of roadmapTopics) {
      for (const link of [t.learn, t.practice]) {
        const url = new URL(link.url);
        expect(url.protocol).toBe('https:');
        expect(url.pathname.length > 1 || url.hash.length > 1).toBe(true);
        expect(link.label.trim().length).toBeGreaterThan(3);
        expect(link.source.trim().length).toBeGreaterThan(2);
      }
      expect(t.practice.prompt.length).toBeGreaterThan(60);
      expect(t.verifiedAt).toBe('2026-10-17');
      expect(resourceById(t.resourceId)).toBeDefined();
    }
    // Curated source repositories must be linked by section or file, never by repository root.
    const curated = ['kratos0718/', 'donnemartin/', 'ashishps1/', 'alex/what-happens-when'];
    const repoLinks = roadmapTopics
      .flatMap((t) => [t.learn.url, t.practice.url])
      .filter((u) => curated.some((c) => u.includes(c)));
    expect(repoLinks.length).toBeGreaterThan(30);
    for (const url of repoLinks)
      expect(url.includes('/blob/') || new URL(url).hash.length > 1).toBe(true);
  });
  it('assigns real design and coding exercises rather than unrelated problems', () => {
    const kinds = (track: string) =>
      roadmapTopics.filter((t) => t.track === track).map((t) => t.practice.kind);
    expect(kinds('hld').filter((k) => k === 'Design').length).toBeGreaterThanOrEqual(6);
    expect(kinds('lld').every((k) => k === 'Code')).toBe(true);
    expect(kinds('aptitude').every((k) => k === 'Practice')).toBe(true);
    expect(kinds('interviews').every((k) => k === 'Practice')).toBe(true);
    const leetcode = roadmapTopics.filter((t) => t.practice.url.includes('leetcode.com'));
    expect(leetcode.every((t) => ['os', 'dbms', 'oop'].includes(t.track))).toBe(true);
    expect(roadmapTopics.find((t) => t.id === 'hld-5')?.practice.label).toMatch(/URL Shortener/);
    expect(roadmapTopics.find((t) => t.id === 'lld-2')?.practice.label).toMatch(/Parking Lot/);
  });
});

describe('daily assignment engine', () => {
  it('assigns one task per day, persists it, and rotates after completion', () => {
    const state = emptyRoadmap();
    const first = ensureRoadmapDay(state, day1)!;
    expect(first).toEqual({
      id: 'extra:2026-10-17',
      topicId: 'os-1',
      assignedOn: '2026-10-17',
      kind: 'new',
    });
    expect(ensureRoadmapDay(state, at(0, 20))).toBe(state.days['2026-10-17']);
    applyRoadmapAction(
      state,
      { type: 'prepRoadmapRecord', response: outcome(first.id, 'os-1') },
      at(0, 10),
    );
    expect(ensureRoadmapDay(state, at(1))?.topicId).toBe('dbms-1');
    expect(upcomingRoadmap(state, at(1), 3).map((u) => u.topicId)).toEqual([
      'cn-1',
      'oop-1',
      'hld-1',
    ]);
  });
  it('resumes an unfinished task on later days instead of completing or skipping it', () => {
    const state = emptyRoadmap();
    const first = ensureRoadmapDay(state, day1)!;
    applyRoadmapAction(
      state,
      {
        type: 'prepRoadmapRecord',
        response: outcome(first.id, 'os-1', {
          status: 'draft',
          understanding: 'not-rated',
          practiceResult: 'partial',
          minutes: 10,
          notes: 'half way',
        }),
      },
      at(0, 10),
    );
    const resumed = ensureRoadmapDay(state, at(3))!;
    expect(resumed).toEqual(first);
    expect(state.days['2026-10-20']).toEqual(first);
    expect(state.responses[first.id]?.status).toBe('draft');
    expect(roadmapProgress(state)).toEqual([]);
    applyRoadmapAction(
      state,
      { type: 'prepRoadmapRecord', response: outcome(first.id, 'os-1', { minutes: 15 }) },
      at(3, 11),
    );
    expect(state.responses[first.id]).toMatchObject({ status: 'completed', minutes: 15 });
    expect(ensureRoadmapDay(state, at(4))?.topicId).toBe('dbms-1');
    expect(validateRoadmap(state)).toEqual(state);
  });
  it('enforces outcome rules and keeps recorded outcomes immutable', () => {
    const state = emptyRoadmap();
    const first = ensureRoadmapDay(state, day1)!;
    expect(
      roadmapOutcomeProblem({
        status: 'completed',
        understanding: 'not-rated',
        practiceResult: 'completed',
      }),
    ).toMatch(/Rate/);
    expect(
      roadmapOutcomeProblem({
        status: 'completed',
        understanding: 'needs-work',
        practiceResult: 'completed',
      }),
    ).toMatch(/revision/);
    expect(
      roadmapOutcomeProblem({
        status: 'completed',
        understanding: 'independent',
        practiceResult: 'not-attempted',
      }),
    ).toMatch(/Attempt/);
    expect(
      roadmapOutcomeProblem({
        status: 'revision',
        understanding: 'needs-work',
        practiceResult: 'not-attempted',
      }),
    ).toBeUndefined();
    expect(() =>
      applyRoadmapAction(
        state,
        {
          type: 'prepRoadmapRecord',
          response: outcome(first.id, 'os-1', { understanding: 'needs-work' }),
        },
        day1,
      ),
    ).toThrow(/revision/);
    expect(() =>
      applyRoadmapAction(
        state,
        { type: 'prepRoadmapRecord', response: outcome('extra:2026-10-18', 'dbms-1') },
        day1,
      ),
    ).toThrow(/current preparation task/);
    applyRoadmapAction(
      state,
      {
        type: 'prepRoadmapRecord',
        response: outcome(first.id, 'os-1', {
          status: 'revision',
          understanding: 'needs-work',
          practiceResult: 'partial',
        }),
      },
      day1,
    );
    const saved = structuredClone(state);
    applyRoadmapAction(
      state,
      {
        type: 'prepRoadmapRecord',
        response: outcome(first.id, 'os-1', {
          status: 'revision',
          understanding: 'needs-work',
          practiceResult: 'partial',
        }),
      },
      at(0, 12),
    );
    expect(state).toEqual(saved);
    expect(() =>
      applyRoadmapAction(
        state,
        { type: 'prepRoadmapRecord', response: outcome(first.id, 'os-1') },
        at(0, 12),
      ),
    ).toThrow(/already recorded/);
    expect(state).toEqual(saved);
  });
  it('schedules revisions for tomorrow and spaced reviews after completion', () => {
    const state = emptyRoadmap();
    const first = ensureRoadmapDay(state, day1)!;
    applyRoadmapAction(
      state,
      {
        type: 'prepRoadmapRecord',
        response: outcome(first.id, 'os-1', { status: 'revision', understanding: 'needs-work' }),
      },
      day1,
    );
    expect(dueReviews(state, '2026-10-18')[0]).toMatchObject({
      topicId: 'os-1',
      dueOn: '2026-10-18',
    });
    const second = ensureRoadmapDay(state, at(1))!;
    expect(second).toMatchObject({ topicId: 'os-1', kind: 'review' });
    applyRoadmapAction(
      state,
      { type: 'prepRoadmapRecord', response: outcome(second.id, 'os-1') },
      at(1),
    );
    const progress = roadmapProgress(state)[0]!;
    expect(progress).toMatchObject({
      status: 'completed',
      completions: 1,
      revisions: 1,
      minutes: 50,
      dueOn: '2026-10-25',
    });
    // A review never follows a review while new material remains.
    expect(ensureRoadmapDay(state, at(2))?.kind).toBe('new');
    expect(ensureRoadmapDay(state, at(2))?.topicId).toBe('dbms-1');
    const supported = emptyRoadmap();
    const a = ensureRoadmapDay(supported, day1)!;
    applyRoadmapAction(
      supported,
      {
        type: 'prepRoadmapRecord',
        response: outcome(a.id, 'os-1', {
          understanding: 'some-support',
          practiceResult: 'partial',
        }),
      },
      day1,
    );
    expect(roadmapProgress(supported)[0]?.dueOn).toBe('2026-10-20');
  });
  it('brings a topic marked for revision back before its successor unlocks', () => {
    const state = emptyRoadmap();
    const first = ensureRoadmapDay(state, day1)!;
    applyRoadmapAction(
      state,
      {
        type: 'prepRoadmapRecord',
        response: outcome(first.id, 'os-1', { status: 'revision', understanding: 'needs-work' }),
      },
      day1,
    );
    const summary = roadmapTrackSummary(state, localDate(at(1)));
    expect(summary.os).toMatchObject({ completed: 0, revision: 1, due: 1, next: 'os-2' });
    expect(roadmapTopicById('os-2')?.prerequisites).toEqual(['os-1']);
    const review = ensureRoadmapDay(state, at(1))!;
    expect(review).toMatchObject({ topicId: 'os-1', kind: 'review' });
    applyRoadmapAction(
      state,
      { type: 'prepRoadmapRecord', response: outcome(review.id, 'os-1') },
      at(1),
    );
    for (let i = 1; i < 7; i++) {
      const a = ensureRoadmapDay(state, at(i + 1))!;
      expect(a).toMatchObject({ topicId: `${ROADMAP_TRACK_ORDER[i]}-1`, kind: 'new' });
      applyRoadmapAction(
        state,
        { type: 'prepRoadmapRecord', response: outcome(a.id, a.topicId) },
        at(i + 1),
      );
    }
    // The completed review falls due again after seven days and takes one slot.
    const spaced = ensureRoadmapDay(state, at(8))!;
    expect(spaced).toMatchObject({ topicId: 'os-1', kind: 'review' });
    applyRoadmapAction(
      state,
      { type: 'prepRoadmapRecord', response: outcome(spaced.id, 'os-1') },
      at(8),
    );
    expect(ensureRoadmapDay(state, at(9))).toMatchObject({ topicId: 'interviews-1', kind: 'new' });
    applyRoadmapAction(
      state,
      { type: 'prepRoadmapRecord', response: outcome('extra:2026-10-26', 'interviews-1') },
      at(9),
    );
    // dbms-1 (completed on day 3) falls due before os-2 gets its first slot.
    const dbmsReview = ensureRoadmapDay(state, at(10))!;
    expect(dbmsReview).toMatchObject({ topicId: 'dbms-1', kind: 'review' });
    applyRoadmapAction(
      state,
      { type: 'prepRoadmapRecord', response: outcome(dbmsReview.id, 'dbms-1') },
      at(10),
    );
    expect(ensureRoadmapDay(state, at(11))?.topicId).toBe('os-2');
    expect(roadmapTrackSummary(state, localDate(at(10))).dbms).toMatchObject({
      completed: 1,
      next: 'dbms-2',
    });
    expect(roadmapProgress(state).find((p) => p.topicId === 'os-1')).toMatchObject({
      completions: 2,
      revisions: 1,
      dueOn: '2026-11-08',
    });
  });
  it('stores bookmarks only for catalog topics', () => {
    const state = emptyRoadmap();
    applyRoadmapAction(
      state,
      { type: 'prepRoadmapBookmark', topicId: 'hld-3', bookmarked: true },
      day1,
    );
    expect(state.bookmarks).toEqual({ 'hld-3': day1.toISOString() });
    applyRoadmapAction(
      state,
      { type: 'prepRoadmapBookmark', topicId: 'hld-3', bookmarked: true },
      at(1),
    );
    expect(state.bookmarks?.['hld-3']).toBe(day1.toISOString());
    expect(() =>
      applyRoadmapAction(state, { type: 'prepRoadmapBookmark', topicId: 'nope', bookmarked: true }),
    ).toThrow(/catalog/);
    applyRoadmapAction(
      state,
      { type: 'prepRoadmapBookmark', topicId: 'hld-3', bookmarked: false },
      day1,
    );
    expect(state.bookmarks).toEqual({});
    expect(validateRoadmap(state).bookmarks).toEqual({});
  });
  it.each([
    { version: 2, days: {}, responses: {} },
    { version: 1, days: [], responses: {} },
    {
      version: 1,
      days: { 'bad-date': { id: 'x', topicId: 'os-1', assignedOn: '2026-10-17', kind: 'new' } },
      responses: {},
    },
    {
      version: 1,
      days: { '2026-10-16': { id: 'x', topicId: 'os-1', assignedOn: '2026-10-17', kind: 'new' } },
      responses: {},
    },
    {
      version: 1,
      days: {},
      responses: { orphan: { ...outcome('orphan', 'os-1'), recordedAt: day1.toISOString() } },
    },
    {
      version: 1,
      days: { '2026-10-17': { id: 'x', topicId: 'os-1', assignedOn: '2026-10-17', kind: 'new' } },
      responses: {
        x: {
          ...outcome('x', 'os-1', { understanding: 'needs-work' }),
          recordedAt: day1.toISOString(),
        },
      },
    },
    { version: 1, days: {}, responses: {}, bookmarks: { 'os-1': 'yesterday' } },
    JSON.parse(
      `{"version":1,"days":{},"responses":{},"bookmarks":{"__proto__":"${day1.toISOString()}"}}`,
    ),
  ])('rejects corrupted roadmap data without replacing it: %j', (raw) => {
    const original = structuredClone(raw);
    expect(() => validateRoadmap(raw)).toThrow();
    expect(raw).toEqual(original);
  });
  it('keeps retired topic ids on load and skips them when selecting', () => {
    const state = emptyRoadmap();
    state.days['2026-10-10'] = {
      id: 'extra:2026-10-10',
      topicId: 'retired-9',
      assignedOn: '2026-10-10',
      kind: 'new',
    };
    state.responses['extra:2026-10-10'] = {
      ...outcome('extra:2026-10-10', 'retired-9', {
        status: 'revision',
        understanding: 'needs-work',
      }),
      recordedAt: '2026-10-10T10:00:00.000Z',
    };
    expect(validateRoadmap(state)).toEqual(state);
    expect(ensureRoadmapDay(state, day1)?.topicId).toBe('os-1');
  });
});

describe('roadmap persistence across the app state', () => {
  it('migrates, backs up, merges, and counts activity without touching DSA records', () => {
    const state = { ...emptyState(), preparation: defaultPreparation() };
    applyPreparationAction(state.preparation, { type: 'prepRoadmapToday' }, [], [], day1);
    const assignment = state.preparation.roadmap!.days[localDate(day1)]!;
    applyPreparationAction(
      state.preparation,
      {
        type: 'prepRoadmapRecord',
        response: outcome(assignment.id, assignment.topicId, { minutes: 30, notes: 'kept' }),
      },
      [],
      [],
      at(0, 10),
    );
    applyPreparationAction(
      state.preparation,
      { type: 'prepRoadmapBookmark', topicId: 'lld-1', bookmarked: true },
      [],
      [],
      day1,
    );
    const reloaded = migrateState(JSON.parse(JSON.stringify(state)));
    expect(reloaded.preparation?.roadmap).toEqual(state.preparation.roadmap);
    expect(reloaded.attempts).toEqual({});
    const activity = preparationActivity(state, 1, at(0, 23)).at(-1)!;
    expect(activity).toMatchObject({ tasks: 1, studies: 1, minutes: 30, solves: 0 });

    const other = { ...emptyState(), preparation: defaultPreparation() };
    applyPreparationAction(other.preparation, { type: 'prepRoadmapToday' }, [], [], day1);
    applyPreparationAction(
      other.preparation,
      {
        type: 'prepRoadmapRecord',
        response: outcome(assignment.id, assignment.topicId, {
          status: 'revision',
          understanding: 'needs-work',
        }),
      },
      [],
      [],
      at(0, 11),
    );
    applyPreparationAction(other.preparation, { type: 'prepRoadmapToday' }, [], [], at(1));
    applyPreparationAction(
      other.preparation,
      { type: 'prepRoadmapBookmark', topicId: 'lld-1', bookmarked: true },
      [],
      [],
      at(1),
    );
    applyPreparationAction(
      other.preparation,
      { type: 'prepRoadmapBookmark', topicId: 'cn-2', bookmarked: true },
      [],
      [],
      at(1),
    );
    const merged = mergeBackup(
      state,
      parseBackup(JSON.stringify(createBackup(other, at(1)))),
      at(1),
    );
    // The colliding local outcome wins; a day the local store lacks is imported; bookmarks union.
    expect(merged.preparation?.roadmap?.responses[assignment.id]).toMatchObject({
      status: 'completed',
      notes: 'kept',
    });
    expect(merged.preparation?.roadmap?.days[localDate(at(1))]).toEqual(
      other.preparation.roadmap!.days[localDate(at(1))],
    );
    expect(merged.preparation?.roadmap?.bookmarks).toEqual({
      'lld-1': day1.toISOString(),
      'cn-2': at(1).toISOString(),
    });
    expect(mergeRoadmap(merged.preparation!.roadmap, other.preparation.roadmap!)).toEqual(
      merged.preparation!.roadmap,
    );
  });
});
