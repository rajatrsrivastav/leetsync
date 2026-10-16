import { addDateKeyDays, localDate, parseLocalDate } from '../../../utils/date';
import { roadmapTopicById, roadmapTopics } from './topics';
import type {
  RoadmapAction,
  RoadmapAssignment,
  RoadmapResponse,
  RoadmapState,
  RoadmapTrack,
} from './types';

export const emptyRoadmap = (): RoadmapState => ({ version: 1, days: {}, responses: {} });

const STATUSES = ['draft', 'completed', 'revision'] as const;
const UNDERSTANDING = ['not-rated', 'needs-work', 'some-support', 'independent'] as const;
const PRACTICE = ['not-attempted', 'partial', 'completed'] as const;

function fail(message = 'Invalid preparation roadmap data; history has been preserved.'): never {
  throw new Error(message);
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
};
const id = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(value) ||
    ['constructor', 'prototype', '__proto__'].includes(value)
  )
    return fail();
  return value;
};
const day = (value: unknown): string => {
  if (typeof value !== 'string') return fail();
  try {
    parseLocalDate(value);
  } catch {
    return fail();
  }
  return value;
};
const timestamp = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    return fail();
  return value;
};
const oneOf = <T extends string>(value: unknown, choices: readonly T[]): T => {
  if (typeof value !== 'string' || !choices.includes(value as T)) return fail();
  return value as T;
};

/**
 * Outcome rules shown in the UI: a draft can hold anything, "needs revision" requires a rating,
 * and "completed" requires understanding with at most some support and an attempted practice.
 */
export function roadmapOutcomeProblem(
  response: Pick<RoadmapResponse, 'status' | 'understanding' | 'practiceResult'>,
): string | undefined {
  if (response.status === 'draft') return undefined;
  if (response.understanding === 'not-rated') return 'Rate your understanding first.';
  if (response.status === 'completed') {
    if (response.understanding === 'needs-work')
      return 'Understanding marked as needing work is recorded as a revision, not a completion.';
    if (response.practiceResult === 'not-attempted')
      return 'Attempt the practice before marking the topic completed.';
  }
  return undefined;
}

function validateResponse(raw: unknown): RoadmapResponse {
  const r = record(raw);
  if (
    !Number.isInteger(r.minutes) ||
    (r.minutes as number) < 0 ||
    (r.minutes as number) > 1440 ||
    typeof r.notes !== 'string' ||
    r.notes.length > 5000
  )
    return fail();
  const response: RoadmapResponse = {
    assignmentId: id(r.assignmentId),
    topicId: id(r.topicId),
    recordedAt: timestamp(r.recordedAt),
    status: oneOf(r.status, STATUSES),
    understanding: oneOf(r.understanding, UNDERSTANDING),
    practiceResult: oneOf(r.practiceResult, PRACTICE),
    minutes: r.minutes as number,
    notes: r.notes,
  };
  if (roadmapOutcomeProblem(response)) return fail();
  return response;
}

export function validateRoadmap(raw: unknown): RoadmapState {
  const value = record(raw);
  if (value.version !== 1)
    throw new Error('Unsupported roadmap version; update the extension before continuing.');
  const result = emptyRoadmap();
  const assignments = new Map<string, RoadmapAssignment>();
  for (const [key, v] of Object.entries(record(value.days))) {
    day(key);
    const a = record(v);
    const assignment: RoadmapAssignment = {
      id: id(a.id),
      topicId: id(a.topicId),
      assignedOn: day(a.assignedOn),
      kind: oneOf(a.kind, ['new', 'review'] as const),
    };
    if (assignment.assignedOn > key) return fail();
    const previous = assignments.get(assignment.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(assignment)) return fail();
    assignments.set(assignment.id, assignment);
    result.days[key] = assignment;
  }
  for (const [key, v] of Object.entries(record(value.responses))) {
    id(key);
    const response = validateResponse(v);
    const assignment = assignments.get(key);
    if (
      response.assignmentId !== key ||
      !assignment ||
      assignment.topicId !== response.topicId ||
      localDate(new Date(response.recordedAt)) < assignment.assignedOn
    )
      return fail();
    result.responses[key] = response;
  }
  if (value.bookmarks !== undefined) {
    result.bookmarks = {};
    for (const [topicId, savedAt] of Object.entries(record(value.bookmarks)))
      result.bookmarks[id(topicId)] = timestamp(savedAt);
  }
  return result;
}

export type RoadmapTopicProgress = {
  topicId: string;
  status: 'completed' | 'revision';
  lastRecordedAt: string;
  dueOn: string;
  completions: number;
  revisions: number;
  minutes: number;
};

const finalResponses = (state: RoadmapState) =>
  Object.values(state.responses)
    .filter((r) => r.status !== 'draft')
    .sort(
      (a, b) =>
        Date.parse(b.recordedAt) - Date.parse(a.recordedAt) ||
        b.assignmentId.localeCompare(a.assignmentId),
    );

/** Latest outcome per topic with its spaced review date. Drafts never count as progress. */
export function roadmapProgress(state: RoadmapState): RoadmapTopicProgress[] {
  const latest = new Map<string, RoadmapResponse>();
  for (const r of finalResponses(state)) if (!latest.has(r.topicId)) latest.set(r.topicId, r);
  return [...latest.values()].map((r) => {
    const all = Object.values(state.responses).filter(
      (x) => x.topicId === r.topicId && x.status !== 'draft',
    );
    const completions = all.filter((x) => x.status === 'completed').length;
    const revisions = all.length - completions;
    const recordedOn = localDate(new Date(r.recordedAt));
    const interval =
      r.status === 'revision'
        ? 1
        : r.understanding === 'some-support' && completions === 1
          ? 3
          : Math.min(90, 7 * 2 ** Math.max(0, completions - 1));
    return {
      topicId: r.topicId,
      status: r.status as 'completed' | 'revision',
      lastRecordedAt: r.recordedAt,
      dueOn: addDateKeyDays(recordedOn, interval),
      completions,
      revisions,
      minutes: all.reduce((sum, x) => sum + x.minutes, 0),
    };
  });
}

export const isUnfinished = (state: RoadmapState, assignment: RoadmapAssignment) =>
  !state.responses[assignment.id] || state.responses[assignment.id]?.status === 'draft';

export function dueReviews(state: RoadmapState, date: string) {
  return roadmapProgress(state)
    .filter((p) => p.dueOn <= date && roadmapTopicById(p.topicId))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.topicId.localeCompare(b.topicId));
}

function selectTopic(
  state: RoadmapState,
  date: string,
): { topicId: string; kind: 'new' | 'review' } | undefined {
  const progress = roadmapProgress(state);
  const byTopic = new Map(progress.map((p) => [p.topicId, p]));
  const next = roadmapTopics.find(
    (t) =>
      !byTopic.has(t.id) &&
      t.prerequisites.every((prerequisite) => byTopic.get(prerequisite)?.status === 'completed'),
  );
  const due = dueReviews(state, date);
  const last = Object.values(state.days)
    .filter((a) => !isUnfinished(state, a))
    .sort((a, b) => b.assignedOn.localeCompare(a.assignedOn))[0];
  // At most one review between new topics while eligible new material remains.
  if (due[0] && (last?.kind !== 'review' || !next))
    return { topicId: due[0].topicId, kind: 'review' };
  return next ? { topicId: next.id, kind: 'new' } : undefined;
}

/** Today's task. An unfinished earlier task is resumed under its original id, never auto-closed. */
export function ensureRoadmapDay(
  state: RoadmapState,
  now = new Date(),
): RoadmapAssignment | undefined {
  const date = localDate(now);
  const existing = state.days[date];
  if (existing) return existing;
  const unfinished = Object.values(state.days)
    .filter((a) => a.assignedOn <= date && isUnfinished(state, a))
    .sort((a, b) => a.assignedOn.localeCompare(b.assignedOn) || a.id.localeCompare(b.id))[0];
  if (unfinished) return (state.days[date] = structuredClone(unfinished));
  const next = selectTopic(state, date);
  if (!next) return undefined;
  return (state.days[date] = {
    id: `extra:${date}`,
    topicId: next.topicId,
    assignedOn: date,
    kind: next.kind,
  });
}

export function applyRoadmapAction(state: RoadmapState, action: RoadmapAction, now = new Date()) {
  if (action.type === 'prepRoadmapBookmark') {
    const topicId = id(action.topicId);
    if (!roadmapTopicById(topicId)) throw new Error('This topic is not in the roadmap catalog.');
    if (typeof action.bookmarked !== 'boolean') throw new Error('Invalid bookmark value.');
    state.bookmarks ??= {};
    if (action.bookmarked) state.bookmarks[topicId] ??= now.toISOString();
    else delete state.bookmarks[topicId];
    return;
  }
  const assignment = ensureRoadmapDay(state, now);
  if (action.type === 'prepRoadmapToday') return;
  const draft = record(action.response);
  if (!assignment || assignment.id !== draft.assignmentId || assignment.topicId !== draft.topicId)
    throw new Error('Record progress for the current preparation task.');
  if (!roadmapTopicById(assignment.topicId))
    throw new Error('This topic needs a newer catalog. Saved data is preserved.');
  const problem = roadmapOutcomeProblem({
    status: oneOf(draft.status, STATUSES),
    understanding: oneOf(draft.understanding, UNDERSTANDING),
    practiceResult: oneOf(draft.practiceResult, PRACTICE),
  });
  if (problem) throw new Error(problem);
  const value = validateResponse({ ...draft, recordedAt: now.toISOString() });
  const old = state.responses[assignment.id];
  if (old && old.status !== 'draft') {
    if (JSON.stringify({ ...old, recordedAt: '' }) !== JSON.stringify({ ...value, recordedAt: '' }))
      throw new Error('This task is already recorded. Its history is preserved.');
    return;
  }
  state.responses[assignment.id] = value;
}

/** Simulated future assignments assuming each day's task is completed independently. */
export function upcomingRoadmap(state: RoadmapState, now = new Date(), count = 8) {
  const copy = structuredClone(state);
  const result: { date: string; topicId: string; kind: 'new' | 'review' }[] = [];
  const finish = (assignment: RoadmapAssignment, at: Date) => {
    copy.responses[assignment.id] = {
      assignmentId: assignment.id,
      topicId: assignment.topicId,
      status: 'completed',
      understanding: 'independent',
      practiceResult: 'completed',
      minutes: 0,
      notes: '',
      recordedAt: at.toISOString(),
    };
  };
  const current = ensureRoadmapDay(copy, now);
  if (current && isUnfinished(copy, current)) finish(current, now);
  let date = localDate(now);
  for (let i = 0; i < count; i++) {
    date = addDateKeyDays(date, 1);
    const next = ensureRoadmapDay(copy, parseLocalDate(date));
    if (!next) break;
    result.push({ date, topicId: next.topicId, kind: next.kind });
    finish(next, parseLocalDate(date));
  }
  return result;
}

export function roadmapHistory(state: RoadmapState) {
  return finalResponses(state);
}

export function roadmapTrackSummary(state: RoadmapState, date = localDate()) {
  const progress = new Map(roadmapProgress(state).map((p) => [p.topicId, p]));
  const summary = {} as Record<
    RoadmapTrack,
    {
      total: number;
      completed: number;
      revision: number;
      due: number;
      minutes: number;
      next?: string;
    }
  >;
  for (const topic of roadmapTopics) {
    const row = (summary[topic.track] ??= {
      total: 0,
      completed: 0,
      revision: 0,
      due: 0,
      minutes: 0,
    });
    row.total += 1;
    const p = progress.get(topic.id);
    if (!p) {
      row.next ??= topic.id;
      continue;
    }
    row.minutes += p.minutes;
    if (p.status === 'completed') row.completed += 1;
    else row.revision += 1;
    if (p.dueOn <= date) row.due += 1;
  }
  return summary;
}

/** Preserve local IDs and bookmarks. Imported draft progress never closes an unfinished local task. */
export function mergeRoadmap(
  local: RoadmapState | undefined,
  incoming: RoadmapState,
): RoadmapState {
  if (!local) return validateRoadmap(incoming);
  const result = structuredClone(local);
  const localIds = new Map(Object.values(result.days).map((a) => [a.id, a]));
  const imported = new Set<string>();
  for (const [date, a] of Object.entries(incoming.days)) {
    const collision = localIds.get(a.id);
    if (result.days[date] || (collision && JSON.stringify(collision) !== JSON.stringify(a)))
      continue;
    result.days[date] = structuredClone(a);
    imported.add(a.id);
  }
  for (const [key, r] of Object.entries(incoming.responses))
    if (!result.responses[key] && imported.has(key) && !localIds.has(key))
      result.responses[key] = structuredClone(r);
  if (incoming.bookmarks) {
    result.bookmarks ??= {};
    for (const [topicId, savedAt] of Object.entries(incoming.bookmarks))
      result.bookmarks[topicId] ??= savedAt;
  }
  return validateRoadmap(result);
}
