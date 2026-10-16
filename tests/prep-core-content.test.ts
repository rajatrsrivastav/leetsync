import { describe, expect, it } from 'vitest';
import { preparationLessons } from '../src/features/preparation/catalog';
import { coreLessons } from '../src/features/preparation/coreContent';
import { SUBJECTS } from '../src/features/preparation/types';

describe('unified preparation curriculum', () => {
  it('covers every advertised subject with unique persistent lesson and question IDs', () => {
    const ids = preparationLessons.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    const quizIds = preparationLessons.flatMap((lesson) => lesson.quiz ?? []).map((q) => q.id);
    expect(new Set(quizIds).size).toBe(quizIds.length);
    expect(new Set(preparationLessons.map((lesson) => lesson.subject))).toEqual(
      new Set(Object.keys(SUBJECTS)),
    );
    for (const lesson of preparationLessons) {
      expect(lesson.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(lesson.roles.length, `${lesson.id} must be available to a role`).toBeGreaterThan(0);
      expect(lesson.minutes).toBeGreaterThan(0);
      expect(Number.isFinite(lesson.minutes)).toBe(true);
    }
  });

  it('has no missing or circular prerequisites that could permanently block the planner', () => {
    const catalog = new Map(preparationLessons.map((lesson) => [lesson.id, lesson]));
    const visited = new Set<string>();
    const ancestors = new Set<string>();
    const visit = (id: string) => {
      expect(ancestors.has(id), `Circular prerequisite at ${id}`).toBe(false);
      if (visited.has(id)) return;
      const lesson = catalog.get(id);
      expect(lesson, `Missing prerequisite ${id}`).toBeDefined();
      ancestors.add(id);
      for (const prerequisite of lesson!.prerequisites) visit(prerequisite);
      ancestors.delete(id);
      visited.add(id);
    };
    for (const lesson of preparationLessons) visit(lesson.id);
    expect(visited.size).toBe(preparationLessons.length);
  });

  it('has usable self-check answer keys throughout the catalog', () => {
    for (const question of preparationLessons.flatMap((lesson) => lesson.quiz ?? [])) {
      expect(question.options.length, question.id).toBeGreaterThanOrEqual(2);
      expect(new Set(question.options).size, question.id).toBe(question.options.length);
      expect(Number.isInteger(question.answer), question.id).toBe(true);
      expect(question.answer, question.id).toBeGreaterThanOrEqual(0);
      expect(question.answer, question.id).toBeLessThan(question.options.length);
      expect(question.explanation.trim().length, question.id).toBeGreaterThan(30);
    }
  });
});

describe('core CS and system design lessons', () => {
  it('provides the complete guided-learning path for all six core subject groups', () => {
    const coverage = Object.fromEntries(
      ['os', 'dbms', 'networks', 'oop', 'sql', 'system'].map((subject) => [
        subject,
        coreLessons.filter((lesson) => lesson.subject === subject).length,
      ]),
    );
    expect(coverage).toEqual({ os: 3, dbms: 3, networks: 3, oop: 2, sql: 3, system: 4 });
    for (const lesson of coreLessons) {
      expect(lesson.concept.trim().length, lesson.id).toBeGreaterThan(50);
      expect(lesson.explanation.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(lesson.example.trim().length, lesson.id).toBeGreaterThan(150);
      expect(lesson.practice.trim().length, lesson.id).toBeGreaterThan(100);
      expect(lesson.questions.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(lesson.checkpoints.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(lesson.resources.length, lesson.id).toBeGreaterThan(0);
      expect(lesson.quiz?.length, lesson.id).toBeGreaterThan(0);
    }
  });

  it('links dated primary resources with secure public URLs', () => {
    const primaryHosts = new Set([
      'pages.cs.wisc.edu',
      'www.cs.rpi.edu',
      'www.postgresql.org',
      'www.rfc-editor.org',
      'developer.mozilla.org',
      'docs.oracle.com',
      'learn.microsoft.com',
      'docs.aws.amazon.com',
    ]);
    for (const resource of coreLessons.flatMap((lesson) => lesson.resources)) {
      const url = new URL(resource.url);
      expect(url.protocol).toBe('https:');
      expect(url.username).toBe('');
      expect(url.password).toBe('');
      expect(primaryHosts.has(url.hostname), resource.url).toBe(true);
      expect(resource.verification).toBe('verified');
      expect(resource.verifiedAt).toBe('2026-10-15');
      expect(resource.title.trim().length).toBeGreaterThan(2);
      expect(resource.publisher.length).toBeGreaterThan(2);
    }
  });

  it('preserves numerically correct answer keys for the worked CS concepts', () => {
    const questions = new Map(
      coreLessons.flatMap((lesson) => lesson.quiz ?? []).map((q) => [q.id, q]),
    );
    const selected = (id: string) => {
      const question = questions.get(id)!;
      return question.options[question.answer];
    };
    expect(selected('os-page-offset')).toBe(String(8209 % 4096));
    expect(selected('sql-left-cardinality')).toBe(
      String([2, 0, 1].reduce((rows, matches) => rows + Math.max(1, matches), 0)),
    );
    expect(selected('sql-count-null')).toBe('0');
    expect(selected('sql-dense-rank')).toBe('1, 1, 2');
    expect(selected('system-average-load')).toBe(String(864000 / (24 * 60 * 60)));
  });

  it('distinguishes original design exercises from attributed company questions', () => {
    for (const id of ['system-hld', 'system-lld-booking']) {
      const lesson = coreLessons.find((item) => item.id === id)!;
      expect(lesson.example.toLowerCase()).toContain('original practice scenario');
      expect(lesson.practice.toLowerCase()).toContain('original');
    }
  });
});
