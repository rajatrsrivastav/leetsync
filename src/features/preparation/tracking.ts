import type { AppState } from '../../types';
import { addLocalDays, localDate } from '../../utils/date';
import { lessonById } from './catalog';
import type { ResourceProgressEntry } from './types';

export function latestResourceTopics(entries: ResourceProgressEntry[]): ResourceProgressEntry[] {
  const latest = new Map<string, ResourceProgressEntry>();
  for (const entry of [...entries].sort(
    (a, b) => Date.parse(b.studiedAt) - Date.parse(a.studiedAt) || b.id.localeCompare(a.id),
  )) {
    const key = JSON.stringify([entry.resourceId, entry.subject, entry.topic.trim().toLowerCase()]);
    if (!latest.has(key)) latest.set(key, entry);
  }
  return [...latest.values()];
}
/** Daily counts of DSA solves plus recorded study: roadmap outcomes, resource entries, old sessions. */
export function preparationActivity(state: AppState, days: number, now = new Date()) {
  const prep = state.preparation;
  return Array.from({ length: days }, (_, i) => {
    const date = localDate(addLocalDays(now, i - days + 1));
    const studies = Object.values(prep?.sessions ?? {}).filter(
      (s) =>
        s.completedAt && s.status === 'completed' && localDate(new Date(s.completedAt)) === date,
    );
    const logs = Object.values(prep?.resourceTracking?.entries ?? {}).filter(
      (e) => localDate(new Date(e.studiedAt)) === date,
    );
    const tasks = Object.values(prep?.roadmap?.responses ?? {}).filter(
      (r) => r.status !== 'draft' && localDate(new Date(r.recordedAt)) === date,
    );
    const solves = new Set(state.activities[date]?.problemIds ?? []).size;
    return {
      date,
      solves,
      tasks: tasks.length,
      studies: studies.length + logs.length + tasks.length,
      minutes:
        logs.reduce((n, e) => n + e.minutes, 0) +
        tasks.reduce((n, r) => n + r.minutes, 0) +
        Math.floor(studies.reduce((n, s) => n + s.seconds, 0) / 60),
    };
  });
}
export function previousTopics(state: AppState) {
  return Object.values(state.preparation?.progress ?? {}).map((p) => ({
    id: p.lessonId,
    title: lessonById(p.lessonId)?.title ?? p.lessonId,
    subject: lessonById(p.lessonId)?.subject,
    completed: !!p.lastCompletedAt,
    lastStudiedAt:
      p.lastCompletedAt ?? state.preparation?.sessions[p.sessionIds.at(-1) ?? '']?.startedAt,
    dueAt: p.dueAt,
  }));
}
