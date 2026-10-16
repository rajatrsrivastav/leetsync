import { mergeRoadmap } from '../features/preparation/roadmap/model';
import {
  defaultPreparation,
  validatePreparation,
  studyElapsed,
} from '../features/preparation/model';
import type { AppState, ProblemProgress } from '../types';
import { migrateState } from './StorageService';
import { elapsedSeconds } from '../domain/attempt';

export function createBackup(state: AppState, now = new Date()) {
  // Whitelist the state root: the separately stored credential is never exported.
  const {
    schemaVersion,
    settings,
    attempts,
    progress,
    activities,
    queues,
    syncJobs,
    activeAttemptId,
    pendingSubmissions,
    revision,
    preparation,
  } = state;
  return {
    format: 'dsacommit-backup',
    version: 1,
    exportedAt: now.toISOString(),
    state: {
      schemaVersion,
      settings,
      attempts,
      progress,
      activities,
      queues,
      syncJobs,
      activeAttemptId,
      pendingSubmissions,
      revision,
      preparation,
    },
  };
}
export function parseBackup(text: string): { state: AppState; exportedAt: string } {
  if (text.length > 20_000_000) throw new Error('Backup exceeds 20 MB.');
  const raw = JSON.parse(text, (key, value) => {
    if (['__proto__', 'prototype', 'constructor'].includes(key))
      throw new Error('Unsafe backup property.');
    return value;
  });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid backup.');
  if (raw.format && (raw.format !== 'dsacommit-backup' || raw.version !== 1))
    throw new Error('Unsupported backup format.');
  const input = raw.format ? raw.state : raw;
  if (!input || !input.settings || !input.attempts || !input.progress || !input.activities)
    throw new Error('This is not a DSACommit backup.');
  const state = migrateState(input);
  const exportedAt =
    typeof raw.exportedAt === 'string' && Number.isFinite(Date.parse(raw.exportedAt))
      ? raw.exportedAt
      : new Date().toISOString();
  return { state, exportedAt };
}
/** Add missing history; existing IDs and existing daily goals always win. Never re-publish imported jobs. */
export function mergeBackup(
  current: AppState,
  input: ReturnType<typeof parseBackup>,
  now = new Date(),
): AppState {
  const merged = structuredClone(current),
    incoming = structuredClone(input.state);
  const importedIds = new Set<string>();
  for (const [id, a] of Object.entries(incoming.attempts)) {
    if (merged.attempts[id]) continue;
    if (a.status === 'active') {
      a.activeSeconds = elapsedSeconds(a, new Date(Math.min(Date.parse(input.exportedAt), +now)));
      a.status = 'paused';
      delete a.runningSince;
    }
    if (a.code) a.codeProvenance = 'legacy-unverified';
    merged.attempts[id] = a;
    importedIds.add(id);
  }
  for (const [id, p] of Object.entries(incoming.progress)) {
    const old = merged.progress[id];
    const sameProblemIds = p.attemptIds.filter(
      (attemptId) => merged.attempts[attemptId]?.problemId === id,
    );
    const importedCompletions = sameProblemIds.filter(
      (attemptId) =>
        importedIds.has(attemptId) && merged.attempts[attemptId]?.status === 'completed',
    );
    const latestWasImported =
      p.lastSolvedAt &&
      importedCompletions.some(
        (attemptId) => merged.attempts[attemptId]?.completedAt === p.lastSolvedAt,
      );
    // Older backups can lack lastSolvedAt. Retain their progress on a fresh
    // import only when all referenced attempts arrived without a collision.
    const legacyCompletion =
      !old &&
      !p.lastSolvedAt &&
      importedCompletions.length > 0 &&
      p.attemptIds.every(
        (attemptId) => importedIds.has(attemptId) && merged.attempts[attemptId]?.problemId === id,
      );
    const preferIncoming =
      legacyCompletion ||
      (latestWasImported &&
        (!old || !old.lastSolvedAt || Date.parse(p.lastSolvedAt!) > Date.parse(old.lastSolvedAt)));
    const retained: ProblemProgress = preferIncoming
      ? p
      : (old ?? {
          problemId: id,
          state: sameProblemIds.some((attemptId) =>
            ['ready', 'active', 'paused', 'accepted'].includes(merged.attempts[attemptId]!.status),
          )
            ? 'in_progress'
            : 'not_started',
          attemptIds: [],
          successfulRevisions: 0,
        });
    merged.progress[id] = {
      ...retained,
      // Existing references may predate retained attempt history. Do not erase
      // them while filtering unsupported references from an incoming backup.
      attemptIds: [...new Set([...(old?.attemptIds ?? []), ...sameProblemIds])],
      ...(old?.firstSolvedAt ? { firstSolvedAt: old.firstSolvedAt } : {}),
    };
  }
  const claimedIncomingAttempts = new Set<string>();
  for (const [date, a] of Object.entries(incoming.activities)) {
    const old = merged.activities[date];
    const validAttemptIds = a.attemptIds.filter((attemptId) => {
      const attempt = merged.attempts[attemptId];
      if (
        !importedIds.has(attemptId) ||
        claimedIncomingAttempts.has(attemptId) ||
        attempt?.status !== 'completed' ||
        !a.problemIds.includes(attempt.problemId)
      )
        return false;
      claimedIncomingAttempts.add(attemptId);
      return true;
    });
    if (!old && !validAttemptIds.length && (a.attemptIds.length || a.problemIds.length)) continue;
    merged.activities[date] = {
      ...(old ?? a),
      goal: old?.goal ?? a.goal,
      attemptIds: [...new Set([...(old?.attemptIds ?? []), ...validAttemptIds])],
      problemIds: [
        ...new Set([
          ...(old?.problemIds ?? []),
          ...validAttemptIds.map((attemptId) => merged.attempts[attemptId]!.problemId),
        ]),
      ],
    };
  }
  for (const [id, j] of Object.entries(incoming.syncJobs)) {
    if (
      merged.syncJobs[id] ||
      !importedIds.has(j.attemptId) ||
      merged.attempts[j.attemptId]?.status !== 'completed'
    )
      continue;
    merged.syncJobs[id] =
      j.status === 'synced'
        ? j
        : {
            ...j,
            status: 'failed',
            attempts: 5,
            lastError:
              'Restored from backup. Review the source and repository before explicitly retrying.',
          };
  }
  if (!current.settings.onboardingComplete && !Object.keys(current.attempts).length) {
    merged.settings = {
      ...incoming.settings,
      github: { ...incoming.settings.github, enabled: false },
    };
    merged.queues = incoming.queues;
  }
  if (incoming.preparation) {
    const local = merged.preparation ?? defaultPreparation();
    const restored = structuredClone(incoming.preparation);
    const unusedPreparation =
      !Object.keys(local.sessions).length &&
      !Object.keys(local.progress).length &&
      !Object.keys(local.resourceTracking?.resources ?? {}).length &&
      !Object.keys(local.resourceTracking?.entries ?? {}).length &&
      !Object.keys(local.roadmap?.days ?? {}).length &&
      JSON.stringify(validatePreparation({ profile: local.profile }).profile) ===
        JSON.stringify(validatePreparation({ profile: defaultPreparation().profile }).profile);
    if (!merged.preparation || unusedPreparation)
      local.profile = { ...restored.profile, aiContextOptIn: false };
    const importedCompletedSessions = new Set<string>();
    for (const [id, session] of Object.entries(restored.sessions)) {
      if (local.sessions[id]) continue;
      if (session.status === 'active') {
        session.seconds = studyElapsed(
          session,
          new Date(Math.min(Date.parse(input.exportedAt), +now)),
        );
        session.status = 'paused';
        delete session.runningSince;
      }
      local.sessions[id] = session;
      if (session.status === 'completed') importedCompletedSessions.add(id);
    }
    for (const [id, progress] of Object.entries(restored.progress)) {
      const existing = local.progress[id];
      // A newer timestamp alone is not evidence: its session may have collided with
      // a locally retained ID, including an ID belonging to another lesson.
      const importedLatestCompletion =
        progress.lastCompletedAt &&
        progress.sessionIds.some(
          (sessionId) =>
            importedCompletedSessions.has(sessionId) &&
            local.sessions[sessionId]?.lessonId === id &&
            local.sessions[sessionId]?.completedAt === progress.lastCompletedAt,
        );
      const preferIncoming =
        importedLatestCompletion &&
        (!existing ||
          Date.parse(progress.lastCompletedAt!) >
            Date.parse(existing.lastCompletedAt ?? '1970-01-01T00:00:00Z'));
      const retained = preferIncoming
        ? progress
        : (existing ?? {
            lessonId: id,
            sessionIds: [],
            intervalDays: 0,
            independentReviews: 0,
          });
      local.progress[id] = {
        ...retained,
        sessionIds: [...new Set([...(existing?.sessionIds ?? []), ...progress.sessionIds])].filter(
          (sessionId) => local.sessions[sessionId]?.lessonId === id,
        ),
      };
    }
    if (restored.roadmap) local.roadmap = mergeRoadmap(local.roadmap, restored.roadmap);
    if (restored.resourceTracking) {
      const tracking = (local.resourceTracking ??= { resources: {}, entries: {} });
      for (const [resourceId, state] of Object.entries(restored.resourceTracking.resources)) {
        const existing = tracking.resources[resourceId];
        if (!existing) tracking.resources[resourceId] = state;
        else if (
          state.lastVisitedAt &&
          (!existing.lastVisitedAt ||
            Date.parse(state.lastVisitedAt) > Date.parse(existing.lastVisitedAt))
        )
          existing.lastVisitedAt = state.lastVisitedAt;
      }
      // Self-reported entries are immutable history, not an aggregate to replace.
      for (const [entryId, entry] of Object.entries(restored.resourceTracking.entries))
        tracking.entries[entryId] ??= entry;
    }
    for (const [day, plan] of Object.entries(restored.plans)) local.plans[day] ??= plan;
    merged.preparation = validatePreparation(local);
  }
  // Do not import live submission watchers or an active timer into another browser/profile.
  return migrateState(merged);
}
