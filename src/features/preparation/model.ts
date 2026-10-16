import { applyRoadmapAction, emptyRoadmap, validateRoadmap } from './roadmap/model';
import { addLocalDays, isDueOnOrBefore, localDate, parseLocalDate } from '../../utils/date';
import { SUBJECTS } from './types';
import { resourceById } from './resources';
import type {
  Lesson,
  LessonProgress,
  PlanTask,
  PreparationAction,
  PreparationPlan,
  PreparationProfile,
  PreparationState,
  ResourceProgressEntry,
  ResourceTracking,
  StudySession,
  SubjectId,
} from './types';

const ROLES = ['software', 'backend', 'fullstack', 'analyst'] as const;
const CONFIDENCES = ['independent', 'assisted', 'relearn'] as const;
const SUBJECT_IDS = Object.keys(SUBJECTS) as SubjectId[];
function fail(message: string): never {
  throw new Error(`Preparation: ${message}`);
}
const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(`${label} must be an object`);
  return value as Record<string, unknown>;
};
const text = (value: unknown, label: string, maximum = 500, empty = false): string => {
  if (typeof value !== 'string' || value.length > maximum || (!empty && !value.trim()))
    fail(`Invalid ${label}`);
  return value as string;
};
const id = (value: unknown, label = 'ID'): string => {
  const result = text(value, label, 160);
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(result) ||
    ['constructor', 'prototype', '__proto__'].includes(result)
  )
    fail(`Invalid ${label}`);
  return result;
};
const integer = (
  value: unknown,
  label: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  )
    fail(`Invalid ${label}`);
  return value as number;
};
const timestamp = (value: unknown, label: string): string => {
  const result = text(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(result) || !Number.isFinite(Date.parse(result)))
    fail(`Invalid ${label}`);
  try {
    parseLocalDate(result.slice(0, 10));
  } catch {
    fail(`Invalid ${label}`);
  }
  return result;
};
const dateKey = (value: unknown, label: string): string => {
  const result = text(value, label, 10);
  try {
    parseLocalDate(result);
  } catch {
    fail(`Invalid ${label}`);
  }
  return result;
};
const choice = <T extends string>(value: unknown, choices: readonly T[], label: string): T => {
  if (typeof value !== 'string' || !choices.includes(value as T)) fail(`Invalid ${label}`);
  return value as T;
};
const identifiers = (value: unknown, label: string, maximum = 100_000): string[] => {
  if (!Array.isArray(value) || value.length > maximum) fail(`Invalid ${label}`);
  const result = (value as unknown[]).map((item) => id(item, label));
  if (new Set(result).size !== result.length) fail(`Duplicate ${label}`);
  return result;
};
const optional = <T>(value: unknown, fn: (v: unknown) => T): T | undefined =>
  value === undefined ? undefined : fn(value);
const boolean = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') fail(`Invalid ${label}`);
  return value as boolean;
};

function validateResourceEntry(raw: unknown): ResourceProgressEntry {
  const entry = object(raw, 'resource progress entry');
  return {
    id: id(entry.id, 'progress entry ID'),
    resourceId: id(entry.resourceId, 'resource ID'),
    topic: text(entry.topic, 'studied topic', 500),
    subject: choice(entry.subject, SUBJECT_IDS, 'study subject'),
    completed: boolean(entry.completed, 'completion status'),
    minutes: integer(entry.minutes, 'study minutes', 0, 1440),
    studiedAt: timestamp(entry.studiedAt, 'study date'),
  };
}

/** Catalog changes must not erase historical resource IDs or self-reported study entries. */
function validateResourceTracking(raw: unknown): ResourceTracking {
  const value = object(raw, 'resource tracking');
  const result: ResourceTracking = { resources: {}, entries: {} };
  for (const [key, rawState] of Object.entries(object(value.resources, 'resource states'))) {
    id(key, 'resource ID');
    const state = object(rawState, 'resource state');
    result.resources[key] = {
      bookmarked: boolean(state.bookmarked, 'bookmark status'),
      lastVisitedAt: optional(state.lastVisitedAt, (v) => timestamp(v, 'last resource visit')),
    };
  }
  for (const [key, rawEntry] of Object.entries(object(value.entries, 'resource entries'))) {
    id(key, 'progress entry ID');
    const entry = validateResourceEntry(rawEntry);
    if (entry.id !== key) fail('Resource progress identity mismatch');
    result.entries[key] = entry;
  }
  return result;
}

export function defaultPreparation(): PreparationState {
  return {
    version: 1,
    profile: {
      minutesPerDay: 60,
      role: 'software',
      subjects: [...SUBJECT_IDS],
      weakSubjects: [],
      goal: 'Build consistent practice across placement subjects.',
      aiContextOptIn: false,
    },
    progress: {},
    sessions: {},
    plans: {},
  };
}

function validateProfile(raw: unknown): PreparationProfile {
  const value = object(raw, 'profile');
  const defaults = defaultPreparation().profile;
  const subjects =
    value.subjects === undefined
      ? defaults.subjects
      : identifiers(value.subjects, 'subjects', SUBJECT_IDS.length).map((s) =>
          choice(s, SUBJECT_IDS, 'subject'),
        );
  if (!subjects.length) fail('Select at least one subject');
  const weakSubjects =
    value.weakSubjects === undefined
      ? []
      : identifiers(value.weakSubjects, 'weak subjects', SUBJECT_IDS.length).map((s) =>
          choice(s, SUBJECT_IDS, 'weak subject'),
        );
  if (value.aiContextOptIn !== undefined && typeof value.aiContextOptIn !== 'boolean')
    fail('Invalid AI context preference');
  return {
    minutesPerDay:
      value.minutesPerDay === undefined
        ? defaults.minutesPerDay
        : integer(value.minutesPerDay, 'daily minutes', 10, 480),
    role: value.role === undefined ? defaults.role : choice(value.role, ROLES, 'role'),
    subjects,
    weakSubjects,
    goal: value.goal === undefined ? defaults.goal : text(value.goal, 'goal', 1000, true),
    aiContextOptIn: value.aiContextOptIn === true,
    targetDate: optional(value.targetDate, (v) => dateKey(v, 'placement date')),
  };
}

/** Validates persisted data without silently replacing malformed records or dropping history. */
export function validatePreparation(raw: unknown): PreparationState {
  if (raw === undefined) return defaultPreparation();
  const value = object(raw, 'state');
  if (value.version !== undefined && value.version !== 1)
    fail('Unsupported data version; update the extension before importing');
  const result: PreparationState = {
    version: 1,
    profile: validateProfile(value.profile === undefined ? {} : value.profile),
    sessions: {},
    progress: {},
    plans: {},
  };
  for (const [key, rawSession] of Object.entries(
    object(value.sessions === undefined ? {} : value.sessions, 'sessions'),
  )) {
    id(key, 'session ID');
    const s = object(rawSession, 'session');
    if (s.id !== key) fail('Session identity mismatch');
    const status = choice(s.status, ['active', 'paused', 'completed'] as const, 'session status');
    const answers: Record<string, number> = {};
    for (const [questionId, answer] of Object.entries(
      object(s.answers === undefined ? {} : s.answers, 'answers'),
    ))
      answers[id(questionId, 'question ID')] = integer(answer, 'answer', 0, 100);
    const session: StudySession = {
      id: key,
      lessonId: id(s.lessonId, 'lesson ID'),
      startedAt: timestamp(s.startedAt, 'session start'),
      status,
      seconds: integer(s.seconds, 'study seconds'),
      answers,
      runningSince: optional(s.runningSince, (v) => timestamp(v, 'timer start')),
      completedAt: optional(s.completedAt, (v) => timestamp(v, 'completion date')),
      confidence: optional(s.confidence, (v) => choice(v, CONFIDENCES, 'confidence')),
      reflection: optional(s.reflection, (v) => text(v, 'reflection', 10_000, true)),
      score: optional(s.score, (v) => integer(v, 'quiz score', 0, 1000)),
      total: optional(s.total, (v) => integer(v, 'quiz total', 0, 1000)),
    };
    if ((status === 'active') !== (session.runningSince !== undefined))
      fail('Timer does not match session status');
    if (status === 'completed' && (!session.completedAt || !session.confidence))
      fail('Incomplete completion record');
    if (
      status !== 'completed' &&
      (session.completedAt ||
        session.confidence ||
        session.score !== undefined ||
        session.total !== undefined)
    )
      fail('Unfinished session contains completion data');
    if (
      (session.score === undefined) !== (session.total === undefined) ||
      (session.score ?? 0) > (session.total ?? 0)
    )
      fail('Invalid quiz result');
    if (
      session.confidence === 'independent' &&
      session.total &&
      (session.score ?? 0) / session.total < 0.8
    )
      fail('Quiz result does not support independent confidence');
    if (session.runningSince && Date.parse(session.runningSince) < Date.parse(session.startedAt))
      fail('Timer precedes session');
    if (session.completedAt && Date.parse(session.completedAt) < Date.parse(session.startedAt))
      fail('Completion precedes session');
    result.sessions[key] = session;
  }
  for (const [key, rawProgress] of Object.entries(
    object(value.progress === undefined ? {} : value.progress, 'progress'),
  )) {
    id(key, 'lesson ID');
    const p = object(rawProgress, 'progress record');
    if (p.lessonId !== key) fail('Progress identity mismatch');
    const progress: LessonProgress = {
      lessonId: key,
      sessionIds: identifiers(p.sessionIds, 'session IDs'),
      intervalDays: integer(p.intervalDays, 'revision interval', 0, 365),
      independentReviews: integer(p.independentReviews, 'independent reviews'),
      lastCompletedAt: optional(p.lastCompletedAt, (v) => timestamp(v, 'last completion')),
      dueAt: optional(p.dueAt, (v) => timestamp(v, 'review date')),
      confidence: optional(p.confidence, (v) => choice(v, CONFIDENCES, 'confidence')),
    };
    if (progress.sessionIds.some((sessionId) => result.sessions[sessionId]?.lessonId !== key))
      fail('Progress references an absent or different lesson session');
    if (
      progress.lastCompletedAt &&
      (!progress.confidence ||
        !progress.dueAt ||
        !progress.sessionIds.some(
          (sessionId) => result.sessions[sessionId]?.status === 'completed',
        ))
    )
      fail('Completed progress lacks its session or revision details');
    result.progress[key] = progress;
  }
  for (const [key, rawPlan] of Object.entries(
    object(value.plans === undefined ? {} : value.plans, 'plans'),
  )) {
    dateKey(key, 'plan date');
    const p = object(rawPlan, 'plan');
    if (p.date !== key || !Array.isArray(p.tasks) || p.tasks.length > 100)
      fail('Invalid daily plan');
    const tasks = (p.tasks as unknown[]).map((rawTask) => {
      const t = object(rawTask, 'task');
      const task: PlanTask = {
        id: id(t.id, 'task ID'),
        kind: choice(t.kind, ['dsa', 'learn', 'review'] as const, 'task kind'),
        title: text(t.title, 'task title', 500),
        subject: choice(t.subject, SUBJECT_IDS, 'subject'),
        minutes: integer(t.minutes, 'task minutes', 1, 480),
        reason: text(t.reason, 'task reason', 2000),
        lessonId: optional(t.lessonId, (v) => id(v, 'lesson ID')),
        problemId: optional(t.problemId, (v) => id(v, 'problem ID')),
      };
      if (task.kind !== 'dsa' && !task.lessonId) fail('Lesson task has no lesson');
      if (task.kind === 'dsa' && (task.subject !== 'dsa' || !task.problemId))
        fail('Coding task has no problem');
      return task;
    });
    const budget = integer(p.budget, 'plan budget', 10, 480);
    if (
      new Set(tasks.map((t) => t.id)).size !== tasks.length ||
      tasks.reduce((sum, t) => sum + t.minutes, 0) > budget
    )
      fail('Invalid plan allocation');
    result.plans[key] = {
      date: key,
      budget,
      tasks,
      generatedAt: timestamp(p.generatedAt, 'plan creation'),
    };
  }
  const active = Object.values(result.sessions).filter((session) => session.status === 'active');
  if (active.length > 1) fail('Multiple study timers are running');
  if (value.activeSessionId !== undefined) {
    result.activeSessionId = id(value.activeSessionId, 'active session ID');
    if (result.sessions[result.activeSessionId]?.status !== 'active')
      fail('Active timer references a missing or inactive session');
  }
  if (active.length && result.activeSessionId !== active[0]?.id)
    fail('Active timer is not selected');
  if (value.roadmap !== undefined) result.roadmap = validateRoadmap(value.roadmap);
  if (value.resourceTracking !== undefined)
    result.resourceTracking = validateResourceTracking(value.resourceTracking);
  return result;
}

export function studyElapsed(session: StudySession, now = new Date()): number {
  if (!Number.isFinite(now.getTime())) fail('Invalid current time');
  return (
    session.seconds +
    (session.status === 'active' && session.runningSince
      ? Math.max(0, Math.floor((now.getTime() - Date.parse(session.runningSince)) / 1000))
      : 0)
  );
}

/** Existing plans are deliberately stable: finishing work or changing preferences cannot erase today's plan. */
export function generatePreparationPlan(
  prep: PreparationState,
  lessons: Lesson[],
  dsaTasks: PlanTask[],
  now = new Date(),
): PreparationPlan {
  const date = localDate(now);
  if (prep.plans[date]) return structuredClone(prep.plans[date]);
  const budget = prep.profile.minutesPerDay;
  const tasks: PlanTask[] = [];
  let remaining = budget;
  const selected = new Set(prep.profile.subjects);
  const coding = selected.has('dsa')
    ? dsaTasks.filter(
        (t) =>
          t.kind === 'dsa' &&
          t.subject === 'dsa' &&
          Number.isInteger(t.minutes) &&
          t.minutes > 0 &&
          t.problemId,
      )
    : [];
  let codingIndex = 0;
  // Preserve queue order while reserving room for other selected subjects when possible.
  const firstCoding = coding[0];
  if (
    firstCoding &&
    firstCoding.minutes <= remaining &&
    (selected.size === 1 || firstCoding.minutes <= Math.max(15, budget / 2))
  ) {
    tasks.push(structuredClone(firstCoding));
    remaining -= firstCoding.minutes;
    codingIndex = 1;
  }
  const daysToTarget = prep.profile.targetDate
    ? Math.ceil((parseLocalDate(prep.profile.targetDate).getTime() - now.getTime()) / 86_400_000)
    : undefined;
  const candidates = lessons.flatMap((lesson, index) => {
    if (
      !selected.has(lesson.subject) ||
      !Number.isInteger(lesson.minutes) ||
      lesson.minutes < 1 ||
      !lesson.prerequisites.every((prerequisite) =>
        Boolean(prep.progress[prerequisite]?.lastCompletedAt),
      )
    )
      return [];
    const progress = prep.progress[lesson.id];
    const due = isDueOnOrBefore(progress?.dueAt, now);
    const pending = Object.values(prep.sessions).find(
      (s) => s.lessonId === lesson.id && s.status !== 'completed',
    );
    if (progress?.lastCompletedAt && !due && !pending) return [];
    const recent = progress?.sessionIds
      .map((key) => prep.sessions[key])
      .filter((s) => s?.status === 'completed')
      .sort((a, b) => (b?.completedAt ?? '').localeCompare(a?.completedAt ?? ''))[0];
    let priority = 10;
    const reasons: string[] = [];
    if (pending) {
      priority += 100;
      reasons.push('Resume the session saved on this device');
    }
    if (due) {
      priority += 70;
      reasons.push(
        `Spaced review is due${progress?.confidence ? ` after ${progress.confidence} practice` : ''}`,
      );
    }
    if (prep.profile.weakSubjects.includes(lesson.subject)) {
      priority += 30;
      reasons.push('You marked this subject for extra practice');
    }
    if (progress?.confidence === 'relearn') {
      priority += 25;
      reasons.push('Your last reflection requested relearning');
    } else if (progress?.confidence === 'assisted') {
      priority += 15;
      reasons.push('Your previous attempt used assistance');
    }
    if (recent?.total && (recent.score ?? 0) / recent.total < 0.8) {
      priority += 20;
      reasons.push('Your last quiz suggests more recall practice');
    }
    if (lesson.roles.includes(prep.profile.role)) {
      priority += 12;
      reasons.push(`Relevant to your ${prep.profile.role} role goal`);
    }
    if (
      daysToTarget !== undefined &&
      daysToTarget >= 0 &&
      daysToTarget <= 30 &&
      lesson.level === 'Interview'
    ) {
      priority += 20;
      reasons.push('Interview practice fits your upcoming placement timeline');
    }
    if (!reasons.length)
      reasons.push(
        lesson.prerequisites.length
          ? 'Prerequisites are complete; build on that foundation'
          : 'Build a foundation before advanced practice',
      );
    return [
      {
        lesson,
        index,
        priority,
        due,
        minutes: pending
          ? Math.max(1, lesson.minutes - Math.floor(studyElapsed(pending, now) / 60))
          : lesson.minutes,
        reason: reasons.join('. ') + '.',
      },
    ];
  });
  const chosen = new Set<string>();
  const counts: Partial<Record<SubjectId, number>> = {};
  while (true) {
    const next = candidates
      .filter((c) => !chosen.has(c.lesson.id) && c.minutes <= remaining)
      .sort(
        (a, b) =>
          b.priority -
            (counts[b.lesson.subject] ?? 0) * 65 -
            (a.priority - (counts[a.lesson.subject] ?? 0) * 65) || a.index - b.index,
      )[0];
    if (!next) break;
    const kind = next.due ? 'review' : 'learn';
    tasks.push({
      id: `${kind}:${next.lesson.id}:${date}`,
      kind,
      lessonId: next.lesson.id,
      title: next.lesson.title,
      subject: next.lesson.subject,
      minutes: next.minutes,
      reason: next.reason,
    });
    remaining -= next.minutes;
    chosen.add(next.lesson.id);
    counts[next.lesson.subject] = (counts[next.lesson.subject] ?? 0) + 1;
  }
  // Additional coding tasks use remaining budget and never reorder the existing DSA queue.
  for (const task of coding.slice(codingIndex)) {
    if (task.minutes > remaining) break;
    if (!tasks.some((existing) => existing.id === task.id)) {
      tasks.push(structuredClone(task));
      remaining -= task.minutes;
    }
  }
  return { date, budget, tasks, generatedAt: now.toISOString() };
}

function pause(prep: PreparationState, session: StudySession, now: Date): void {
  if (session.status !== 'active') return;
  session.seconds = studyElapsed(session, now);
  session.status = 'paused';
  delete session.runningSince;
  if (prep.activeSessionId === session.id) delete prep.activeSessionId;
}
function requireSession(prep: PreparationState, sessionId: string): StudySession {
  const session = prep.sessions[id(sessionId, 'session ID')];
  if (!session) fail('Study session was not found');
  return session;
}
function requireLesson(lessons: Lesson[], lessonId: string): Lesson {
  const lesson = lessons.find((item) => item.id === lessonId);
  if (!lesson) fail('Lesson is unavailable in this curriculum');
  return lesson;
}
function resume(prep: PreparationState, session: StudySession, now: Date): void {
  if (session.status === 'completed') fail('A completed study session cannot be resumed');
  if (session.status === 'active') return;
  if (prep.activeSessionId) pause(prep, requireSession(prep, prep.activeSessionId), now);
  session.status = 'active';
  session.runningSince = now.toISOString();
  prep.activeSessionId = session.id;
}

/** Domain-owned scoring and transitions; UI requests never supply scores or elapsed time. */
export function applyPreparationAction(
  prep: PreparationState,
  action: PreparationAction,
  lessons: Lesson[],
  dsaTasks: PlanTask[],
  now = new Date(),
): void {
  if (!Number.isFinite(now.getTime())) fail('Invalid current time');
  switch (action.type) {
    case 'prepRoadmapToday':
    case 'prepRoadmapRecord':
      prep.roadmap ??= emptyRoadmap();
      applyRoadmapAction(prep.roadmap, action, now);
      return;
    case 'prepResourceVisit':
    case 'prepResourceBookmark': {
      const resourceId = id(action.resourceId, 'resource ID');
      if (!resourceById(resourceId)) fail('Resource is unavailable in this catalog');
      const bookmarked =
        action.type === 'prepResourceBookmark'
          ? boolean(action.bookmarked, 'bookmark status')
          : undefined;
      const tracking = (prep.resourceTracking ??= { resources: {}, entries: {} });
      const state = (tracking.resources[resourceId] ??= { bookmarked: false });
      if (bookmarked !== undefined) state.bookmarked = bookmarked;
      else if (!state.lastVisitedAt || Date.parse(state.lastVisitedAt) < +now)
        state.lastVisitedAt = now.toISOString();
      return;
    }
    case 'prepResourceProgress': {
      const entry = validateResourceEntry(action.entry);
      const resource = resourceById(entry.resourceId);
      if (!resource) fail('Resource is unavailable in this catalog');
      if (!resource.subjects.includes(entry.subject)) fail('Subject does not match this resource');
      if (Date.parse(entry.studiedAt) > +now) fail('Study date cannot be in the future');
      const existing = prep.resourceTracking?.entries[entry.id];
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(entry))
          fail('Progress entry ID is already used; create a new entry');
        return;
      }
      const tracking = (prep.resourceTracking ??= { resources: {}, entries: {} });
      tracking.entries[entry.id] = entry;
      tracking.resources[entry.resourceId] ??= { bookmarked: false };
      return;
    }
    case 'prepProfile':
      prep.profile = validateProfile(action.profile);
      return;
    case 'prepPlan':
      if (action.refresh !== undefined && typeof action.refresh !== 'boolean')
        fail('Invalid refresh preference');
      if (action.refresh) delete prep.plans[localDate(now)];
      prep.plans[localDate(now)] = generatePreparationPlan(prep, lessons, dsaTasks, now);
      return;
    case 'prepStart': {
      const sessionId = id(action.sessionId, 'session ID');
      const lesson = requireLesson(lessons, id(action.lessonId, 'lesson ID'));
      const existing = prep.sessions[sessionId];
      if (existing) {
        if (existing.lessonId !== lesson.id) fail('Session ID is already used by another lesson');
        return;
      }
      if (
        !lesson.prerequisites.every((prerequisite) =>
          Boolean(prep.progress[prerequisite]?.lastCompletedAt),
        )
      )
        fail('Complete the prerequisite lessons first');
      const unfinished = Object.values(prep.sessions).find(
        (s) => s.lessonId === lesson.id && s.status !== 'completed',
      );
      if (unfinished) {
        resume(prep, unfinished, now);
        return;
      }
      if (prep.activeSessionId) pause(prep, requireSession(prep, prep.activeSessionId), now);
      prep.sessions[sessionId] = {
        id: sessionId,
        lessonId: lesson.id,
        startedAt: now.toISOString(),
        runningSince: now.toISOString(),
        seconds: 0,
        status: 'active',
        answers: {},
      };
      prep.activeSessionId = sessionId;
      const progress = prep.progress[lesson.id] ?? {
        lessonId: lesson.id,
        sessionIds: [],
        intervalDays: 0,
        independentReviews: 0,
      };
      progress.sessionIds.push(sessionId);
      prep.progress[lesson.id] = progress;
      return;
    }
    case 'prepPause':
      pause(prep, requireSession(prep, action.sessionId), now);
      return;
    case 'prepResume':
      resume(prep, requireSession(prep, action.sessionId), now);
      return;
    case 'prepAnswer': {
      const session = requireSession(prep, action.sessionId);
      if (session.status === 'completed')
        fail('Answers are locked after completion; start a new review');
      if (session.status !== 'active')
        fail('Resume the study timer before answering a quiz question');
      const lesson = requireLesson(lessons, session.lessonId);
      const question = lesson.quiz?.find((q) => q.id === action.questionId);
      if (!question) fail('Quiz question was not found');
      const answer = integer(action.answer, 'answer', 0, question.options.length - 1);
      session.answers ??= {};
      session.answers[question.id] = answer;
      return;
    }
    case 'prepComplete': {
      const session = requireSession(prep, action.sessionId);
      if (session.status === 'completed') return;
      const lesson = requireLesson(lessons, session.lessonId);
      let confidence = choice(action.confidence, CONFIDENCES, 'confidence');
      const reflection = text(action.reflection, 'reflection', 10_000, true);
      if (
        lesson.quiz?.some(
          (question) =>
            !Number.isInteger(session.answers?.[question.id]) ||
            (session.answers?.[question.id] ?? -1) < 0 ||
            (session.answers?.[question.id] ?? Infinity) >= question.options.length,
        )
      )
        fail('Answer every quiz question before completing');
      const total = lesson.quiz?.length ?? 0;
      const score =
        lesson.quiz?.filter((question) => session.answers?.[question.id] === question.answer)
          .length ?? 0;
      if (total && score / total < 0.5) confidence = 'relearn';
      else if (total && score / total < 0.8 && confidence === 'independent')
        confidence = 'assisted';
      const previous = prep.progress[lesson.id];
      const countedReview = Boolean(
        previous?.lastCompletedAt &&
        isDueOnOrBefore(previous.dueAt, now) &&
        confidence === 'independent',
      );
      const interval =
        confidence === 'relearn'
          ? 1
          : confidence === 'assisted'
            ? 7
            : countedReview
              ? Math.min(365, Math.max(30, previous?.intervalDays ?? 30) * 2)
              : Math.max(30, previous?.intervalDays ?? 0);
      session.seconds = studyElapsed(session, now);
      session.status = 'completed';
      delete session.runningSince;
      session.completedAt = now.toISOString();
      session.confidence = confidence;
      session.reflection = reflection;
      if (total) {
        session.total = total;
        session.score = score;
      }
      if (prep.activeSessionId === session.id) delete prep.activeSessionId;
      prep.progress[lesson.id] = {
        lessonId: lesson.id,
        sessionIds: [...new Set([...(previous?.sessionIds ?? []), session.id])],
        lastCompletedAt: now.toISOString(),
        confidence,
        dueAt: addLocalDays(now, interval).toISOString(),
        intervalDays: interval,
        independentReviews: (previous?.independentReviews ?? 0) + (countedReview ? 1 : 0),
      };
      return;
    }
    default:
      fail('Unknown study action');
  }
}

/** Coverage and recall evidence, deliberately not a prediction of interview success. */
export function preparationMetrics(prep: PreparationState, lessons: Lesson[], now = new Date()) {
  const subjects = SUBJECT_IDS.map((subject) => {
    const subjectLessons = lessons.filter((lesson) => lesson.subject === subject);
    const completed = subjectLessons.filter((lesson) =>
      Boolean(prep.progress[lesson.id]?.lastCompletedAt),
    ).length;
    const due = subjectLessons.filter((lesson) =>
      isDueOnOrBefore(prep.progress[lesson.id]?.dueAt, now),
    ).length;
    const independent = subjectLessons.filter(
      (lesson) => prep.progress[lesson.id]?.confidence === 'independent',
    ).length;
    const started = subjectLessons.some((lesson) =>
      Boolean(prep.progress[lesson.id]?.sessionIds.length),
    );
    const status: 'not-started' | 'learning' | 'review-due' | 'practiced' = due
      ? 'review-due'
      : completed === subjectLessons.length && completed > 0
        ? 'practiced'
        : started
          ? 'learning'
          : 'not-started';
    return {
      id: subject,
      title: SUBJECTS[subject],
      total: subjectLessons.length,
      completed,
      due,
      independent,
      coveragePercent: subjectLessons.length
        ? Math.round((completed / subjectLessons.length) * 100)
        : 0,
      status,
    };
  });
  const completedLessons = subjects.reduce((sum, subject) => sum + subject.completed, 0);
  return {
    totalLessons: lessons.length,
    completedLessons,
    dueReviews: subjects.reduce((sum, subject) => sum + subject.due, 0),
    independentLessons: subjects.reduce((sum, subject) => sum + subject.independent, 0),
    coveragePercent: lessons.length ? Math.round((completedLessons / lessons.length) * 100) : 0,
    studyMinutes: Math.floor(
      Object.values(prep.sessions).reduce((sum, session) => sum + studyElapsed(session, now), 0) /
        60,
    ),
    activeSessionId: prep.activeSessionId,
    subjects,
  };
}
