import { addDateKeyDays, localDate, parseLocalDate } from '../../../utils/date';
import { roadmapTopics } from './topics';
import type { RoadmapAction, RoadmapAssignment, RoadmapResponse, RoadmapState } from './types';

export const emptyRoadmap = (): RoadmapState => ({ version: 1, days: {}, responses: {} });
const fail = (): never => { throw new Error('Invalid preparation roadmap data; history has been preserved.'); };
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fail();
  return v as Record<string, unknown>;
};
const id = (v: unknown): string => {
  if (typeof v !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(v) || ['constructor','prototype','__proto__'].includes(v)) return fail();
  return v;
};
const day = (v: unknown): string => { if (typeof v !== 'string') return fail(); try { parseLocalDate(v); return v; } catch { return fail(); } };
const timestamp = (v: unknown): string => { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(v) || !Number.isFinite(Date.parse(v))) return fail(); return v; };
function response(raw: unknown): RoadmapResponse {
  const r = record(raw);
  if (!['draft','completed','revision'].includes(String(r.status)) || !['not-rated','needs-work','some-support','independent'].includes(String(r.understanding)) || !['not-attempted','partial','completed'].includes(String(r.practiceResult)) || !Number.isInteger(r.minutes) || Number(r.minutes) < 0 || Number(r.minutes) > 1440 || typeof r.notes !== 'string' || r.notes.length > 5000) return fail();
  if (r.status !== 'draft' && r.understanding === 'not-rated') return fail();
  if (r.status === 'completed' && (r.understanding !== 'independent' || r.practiceResult !== 'completed')) return fail();
  return { assignmentId: id(r.assignmentId), topicId: id(r.topicId), recordedAt: timestamp(r.recordedAt), status: r.status as RoadmapResponse['status'], understanding: r.understanding as RoadmapResponse['understanding'], practiceResult: r.practiceResult as RoadmapResponse['practiceResult'], minutes: r.minutes as number, notes: r.notes };
}
export function validateRoadmap(raw: unknown): RoadmapState {
  const value = record(raw);
  if (value.version !== 1) throw new Error('Unsupported roadmap version; update the extension before continuing.');
  const result = emptyRoadmap();
  const assignments = new Map<string, RoadmapAssignment>();
  for (const [key, v] of Object.entries(record(value.days))) {
    day(key); const a = record(v);
    if (!['new','review'].includes(String(a.kind))) return fail();
    const assignment: RoadmapAssignment = { id: id(a.id), topicId: id(a.topicId), assignedOn: day(a.assignedOn), kind: a.kind as RoadmapAssignment['kind'] };
    if (assignment.assignedOn > key) return fail();
    const previous = assignments.get(assignment.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(assignment)) return fail();
    assignments.set(assignment.id, assignment); result.days[key] = assignment;
  }
  for (const [key, v] of Object.entries(record(value.responses))) {
    id(key); const r = response(v), a = assignments.get(key);
    if (r.assignmentId !== key || !a || a.topicId !== r.topicId || localDate(new Date(r.recordedAt)) < a.assignedOn) return fail();
    result.responses[key] = r;
  }
  return result;
}
export function roadmapProgress(state: RoadmapState) {
  const latest = new Map<string, RoadmapResponse>();
  for (const r of Object.values(state.responses).filter(r => r.status !== 'draft').sort((a,b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || b.assignmentId.localeCompare(a.assignmentId))) if (!latest.has(r.topicId)) latest.set(r.topicId, r);
  return [...latest.values()].map(r => {
    const independent = Object.values(state.responses).filter(x => x.topicId === r.topicId && x.status === 'completed').length;
    return { topicId: r.topicId, status: r.status, lastRecordedAt: r.recordedAt, dueOn: addDateKeyDays(localDate(new Date(r.recordedAt)), r.status === 'revision' ? 1 : Math.min(90, 7 * 2 ** Math.min(4, independent - 1))) };
  });
}
function selectTopic(state: RoadmapState, date: string): { topicId: string; kind: 'new' | 'review' } | undefined {
  const progress = roadmapProgress(state);
  const byTopic = new Map(progress.map(p => [p.topicId, p]));
  const next = roadmapTopics.find(t => !byTopic.has(t.id) && t.prerequisites.every(id => byTopic.get(id)?.status === 'completed'));
  const due = progress.filter(p => p.dueOn <= date && roadmapTopics.some(t => t.id === p.topicId)).sort((a,b) => a.dueOn.localeCompare(b.dueOn));
  const last = Object.values(state.days).filter(a => state.responses[a.id]?.status !== 'draft' && !!state.responses[a.id]).sort((a,b) => b.assignedOn.localeCompare(a.assignedOn))[0];
  // At most one review between new topics while eligible new material remains.
  if (due[0] && (last?.kind !== 'review' || !next)) return { topicId: due[0].topicId, kind: 'review' };
  return next ? { topicId: next.id, kind: 'new' } : undefined;
}
export function ensureRoadmapDay(state: RoadmapState, now = new Date()): RoadmapAssignment | undefined {
  const date = localDate(now);
  if (state.days[date]) return state.days[date];
  const unfinished = Object.values(state.days).filter(a => a.assignedOn <= date && (!state.responses[a.id] || state.responses[a.id]?.status === 'draft')).sort((a,b) => a.assignedOn.localeCompare(b.assignedOn) || a.id.localeCompare(b.id))[0];
  if (unfinished) return state.days[date] = structuredClone(unfinished);
  const next = selectTopic(state, date);
  if (!next) return undefined;
  return state.days[date] = { id: `extra:${date}`, topicId: next.topicId, assignedOn: date, kind: next.kind };
}
export function applyRoadmapAction(state: RoadmapState, action: RoadmapAction, now = new Date()) {
  const assignment = ensureRoadmapDay(state, now);
  if (action.type === 'prepRoadmapToday') return;
  const draft = action.response;
  if (!assignment || assignment.id !== draft.assignmentId || assignment.topicId !== draft.topicId) throw new Error('Record progress for the current preparation task.');
  if (!roadmapTopics.some(t => t.id === assignment.topicId)) throw new Error('This topic needs a newer catalog. Saved data is preserved.');
  const normalized = { ...draft, status: draft.status === 'completed' && (draft.understanding !== 'independent' || draft.practiceResult !== 'completed') ? 'revision' : draft.status, recordedAt: now.toISOString() };
  const value = response(normalized);
  const old = state.responses[assignment.id];
  if (old && old.status !== 'draft') {
    if (JSON.stringify({ ...old, recordedAt: '' }) !== JSON.stringify({ ...value, recordedAt: '' })) throw new Error('This task is already recorded. Its history is preserved.');
    return;
  }
  state.responses[assignment.id] = value;
}
export function upcomingRoadmap(state: RoadmapState, now = new Date(), count = 8) {
  const copy = structuredClone(state), result: { topicId: string; kind: 'new' | 'review' }[] = [];
  let date = localDate(now);
  const current = ensureRoadmapDay(copy, now);
  if (current && (!copy.responses[current.id] || copy.responses[current.id]?.status === 'draft')) copy.responses[current.id] = { assignmentId: current.id, topicId: current.topicId, status: 'completed', understanding: 'independent', practiceResult: 'completed', minutes: 0, notes: '', recordedAt: now.toISOString() };
  for (let i=0; i<count; i++) {
    date = addDateKeyDays(date, 1);
    const next = ensureRoadmapDay(copy, parseLocalDate(date));
    if (!next) break;
    result.push({ topicId: next.topicId, kind: next.kind });
    copy.responses[next.id] = { assignmentId: next.id, topicId: next.topicId, status: 'completed', understanding: 'independent', practiceResult: 'completed', minutes: 0, notes: '', recordedAt: parseLocalDate(date).toISOString() };
  }
  return result;
}
/** Preserve local IDs. Imported draft progress never closes an unfinished local task. */
export function mergeRoadmap(local: RoadmapState | undefined, incoming: RoadmapState): RoadmapState {
  if (!local) return validateRoadmap(incoming);
  const result = structuredClone(local);
  const localIds = new Map(Object.values(result.days).map(a => [a.id, a]));
  const imported = new Set<string>();
  for (const [date, a] of Object.entries(incoming.days)) {
    const collision = localIds.get(a.id);
    if (result.days[date] || (collision && JSON.stringify(collision) !== JSON.stringify(a))) continue;
    result.days[date] = structuredClone(a); imported.add(a.id);
  }
  for (const [id, r] of Object.entries(incoming.responses)) if (!result.responses[id] && imported.has(id) && !localIds.has(id)) result.responses[id] = structuredClone(r);
  return validateRoadmap(result);
}
