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
export function preparationActivity(state: AppState, days: number, now = new Date()) {
  return Array.from({ length: days }, (_, i) => {
    const date = localDate(addLocalDays(now, i - days + 1));
    const studies = Object.values(state.preparation?.sessions ?? {}).filter(
      (s) =>
        s.completedAt && s.status === 'completed' && localDate(new Date(s.completedAt)) === date,
    );
    const logs = Object.values(state.preparation?.resourceTracking?.entries ?? {}).filter(
      (e) => localDate(new Date(e.studiedAt)) === date,
    );
    const solves = new Set(state.activities[date]?.problemIds ?? []).size;
    return {
      date,
      solves,
      studies: studies.length + logs.length,
      minutes:
        logs.reduce((n, e) => n + e.minutes, 0) +
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
