import { describe, it, expect } from 'vitest';
import { emptyState } from '../src/services/StorageService';
import { defaultPreparation } from '../src/features/preparation/model';
import {
  preparationDsaTasks,
  preparationTaskDone,
  studyContext,
} from '../src/features/preparation/integration';
import { curriculum } from '../src/domain/curriculum';
import { localDate } from '../src/utils/date';

describe('placement integration boundaries', () => {
  it('adapts the DSA queue without reordering, completing, or mutating it', () => {
    const state = emptyState();
    const [first, second] = curriculum.getProblems();
    const date = localDate();
    state.queues[date] = {
      date,
      items: [
        { problemId: first!.id, kind: 'new', reason: 'Existing reason' },
        { problemId: second!.id, kind: 'new', reason: 'Next ordered problem' },
      ],
    };
    const before = structuredClone(state);
    const tasks = preparationDsaTasks(state);
    expect(tasks.map((t) => t.problemId)).toEqual([first!.id, second!.id]);
    expect(tasks[0]?.reason).toBe('Existing reason');
    expect(state).toEqual(before);
    state.activities[date] = { date, goal: 2, attemptIds: [], problemIds: [first!.id] };
    expect(preparationDsaTasks(state).map((t) => t.problemId)).toEqual([second!.id]);
    expect(preparationTaskDone(tasks[0]!, state)).toBe(true);
  });
  it('requires explicit AI opt-in and excludes private notes, answers, and goals from export', () => {
    const prep = defaultPreparation();
    expect(() => studyContext(prep)).toThrow('Enable');
    prep.profile.aiContextOptIn = true;
    prep.profile.goal = 'Private resume details';
    prep.sessions.secret = {
      id: 'secret',
      lessonId: 'os-processes-threads',
      startedAt: new Date().toISOString(),
      seconds: 10,
      status: 'paused',
      reflection: 'Private project evidence',
      answers: { q: 2 },
    };
    const result = studyContext(prep);
    expect(result).not.toContain('Private');
    expect(result).not.toContain('q:2');
    expect(result).toContain('Do not reveal algorithms');
    expect(result).toContain('software');
  });
});
