import { describe, expect, it } from 'vitest';
import { practiceLessons } from '../src/features/preparation/practiceContent';

describe('placement practice curriculum integrity', () => {
  it('keeps lesson and quiz identifiers unique and prerequisites reachable', () => {
    const ids = practiceLessons.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    const questionIds = practiceLessons.flatMap((lesson) => lesson.quiz ?? []).map((q) => q.id);
    expect(new Set(questionIds).size).toBe(questionIds.length);
    for (const lesson of practiceLessons) {
      for (const prerequisite of lesson.prerequisites) {
        expect(ids, `${lesson.id} has missing prerequisite ${prerequisite}`).toContain(
          prerequisite,
        );
        expect(ids.indexOf(prerequisite)).toBeLessThan(ids.indexOf(lesson.id));
      }
    }
  });

  it('provides all five requested coding platforms with honest manual boundaries', () => {
    const dsa = practiceLessons.filter((lesson) => lesson.subject === 'dsa');
    const hosts = new Set(
      dsa.flatMap((lesson) => lesson.resources).map((r) => new URL(r.url).hostname),
    );
    for (const host of [
      'takeuforward.org',
      'leetcode.com',
      'codeforces.com',
      'www.hackerrank.com',
      'www.geeksforgeeks.org',
    ]) {
      expect(hosts).toContain(host);
    }
    expect(dsa.flatMap((lesson) => lesson.explanation).join(' ')).toContain(
      'does not detect Codeforces, GFG, or HackerRank verdicts',
    );
    expect(dsa.flatMap((lesson) => lesson.explanation).join(' ')).toContain(
      'does not mark a LeetCode problem solved',
    );
  });

  it('includes scorable aptitude questions with explanations and no invalid answer indexes', () => {
    const aptitude = practiceLessons.filter((lesson) => lesson.subject === 'aptitude');
    expect(aptitude.length).toBeGreaterThanOrEqual(4);
    for (const lesson of aptitude) {
      expect(lesson.quiz?.length).toBeGreaterThanOrEqual(3);
      for (const question of lesson.quiz ?? []) {
        expect(question.options.length).toBe(4);
        expect(new Set(question.options).size).toBe(4);
        expect(Number.isInteger(question.answer)).toBe(true);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(question.options.length);
        expect(question.explanation.length).toBeGreaterThan(50);
      }
    }
  });

  it('has numerically correct quantitative answer keys', () => {
    const questions = new Map(
      practiceLessons.flatMap((lesson) => lesson.quiz ?? []).map((q) => [q.id, q]),
    );
    const selected = (id: string) => {
      const question = questions.get(id)!;
      return question.options[question.answer];
    };
    expect(selected('percent-1')).toBe(`₹${500 * 1.2 * 0.8}`);
    expect(selected('percent-2')).toBe(String((64 / (3 + 5)) * 5));
    expect(selected('percent-3')).toBe(`${((50 - 40) / 40) * 100}%`);
    expect(selected('rates-1')).toBe(`${1 / (1 / 6 + 1 / 3)} hours`);
    expect(selected('rates-2')).toBe(`${240 / (120 / 40 + 120 / 60)} km/h`);
    expect(selected('rates-3')).toBe('3/10');
    expect((3 / 5) * (2 / 4)).toBeCloseTo(3 / 10);
    expect(selected('rates-4')).toBe(String((10 * 60 + 30 * 80) / 40));
  });

  it('uses secure publisher resources and makes restricted verification visible', () => {
    for (const resource of practiceLessons.flatMap((lesson) => lesson.resources)) {
      const url = new URL(resource.url);
      expect(url.protocol).toBe('https:');
      expect(url.username).toBe('');
      expect(url.password).toBe('');
      expect(resource.verifiedAt).toBe('2026-10-15');
      expect(resource.publisher.length).toBeGreaterThan(2);
      if (resource.verification === 'restricted') expect(resource.note?.length).toBeGreaterThan(20);
    }
  });

  it('covers all roles with company preparation grounded in employer resources', () => {
    const company = practiceLessons.filter((lesson) => lesson.subject === 'company');
    const roles = new Set(company.flatMap((lesson) => lesson.roles));
    for (const role of ['software', 'backend', 'fullstack', 'analyst'])
      expect(roles).toContain(role);
    for (const lesson of company) {
      expect(
        lesson.resources.some((r) =>
          ['careers.microsoft.com', 'www.amazon.jobs'].includes(new URL(r.url).hostname),
        ),
      ).toBe(true);
      expect(lesson.explanation.join(' ').toLowerCase()).toContain('original');
    }
  });
});
