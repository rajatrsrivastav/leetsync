import { describe, it, expect } from 'vitest';
import {
  latestResourceTopics,
  preparationActivity,
  previousTopics,
} from '../src/features/preparation/tracking';
import { emptyState } from '../src/services/StorageService';
import { defaultPreparation } from '../src/features/preparation/model';
import { trackedResources } from '../src/features/preparation/resources';
import type { ResourceProgressEntry } from '../src/features/preparation/types';
import { localDate } from '../src/utils/date';
const entry: ResourceProgressEntry = {
  id: 'first',
  resourceId: 'core-cs',
  topic: 'Scheduling',
  subject: 'os',
  completed: false,
  minutes: 15,
  studiedAt: '2026-10-17T10:00:00Z',
};
describe('tracking summaries', () => {
  it('counts topics once while preserving repeated study events and explicit status changes', () => {
    const later = {
      ...entry,
      id: 'second',
      topic: ' scheduling ',
      completed: true,
      studiedAt: '2026-10-17T11:00:00Z',
    };
    expect(latestResourceTopics([entry, later])).toEqual([later]);
    expect(latestResourceTopics([entry, { ...later, subject: 'dbms' }])).toHaveLength(2);
  });
  it('orders imported timestamps by instant rather than offset spelling', () => {
    const earlier = {
      ...entry,
      id: 'offset',
      completed: true,
      studiedAt: '2026-10-17T12:00:00+05:30',
    };
    expect(latestResourceTopics([entry, earlier])).toEqual([entry]);
  });
  it('uses local-day study logs and old completed sessions, never visits, for activity', () => {
    const state = emptyState();
    state.preparation = defaultPreparation();
    state.preparation.resourceTracking = {
      resources: { 'core-cs': { bookmarked: true, lastVisitedAt: entry.studiedAt } },
      entries: {},
    };
    expect(preparationActivity(state, 7, new Date(entry.studiedAt)).every((d) => !d.studies)).toBe(
      true,
    );
    state.preparation.resourceTracking.entries.first = entry;
    const date = localDate(new Date(entry.studiedAt));
    state.activities[date] = { date, goal: 2, problemIds: ['p', 'p'], attemptIds: [] };
    const before = structuredClone(state);
    expect(preparationActivity(state, 30, new Date(entry.studiedAt)).at(-1)).toEqual({
      date,
      solves: 1,
      studies: 1,
      minutes: 15,
    });
    expect(state).toEqual(before);
    expect(previousTopics(state)).toEqual([]);
  });
  it('keeps the nine curated destinations unique, HTTPS-only, and the snapshot limitation explicit', () => {
    expect(trackedResources).toHaveLength(9);
    expect(new Set(trackedResources.map((r) => r.url)).size).toBe(9);
    expect(trackedResources.every((r) => new URL(r.url).protocol === 'https:')).toBe(true);
    expect(trackedResources.find((r) => r.id === 'company')?.description).toMatch(
      /July 2026 snapshot.*not live question frequency/,
    );
  });
});
