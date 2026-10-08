import type { CurriculumData, CurriculumProblem } from '../../types';

const validPlatforms = new Set(['leetcode', 'gfg', 'other']);
const validDifficulties = new Set(['Easy', 'Medium', 'Hard']);
const reservedKeys = new Set(['__proto__', 'constructor', 'prototype']);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new Error(`${label} must be a nonempty string (maximum ${max} characters).`);
  return value.trim();
}

function url(value: unknown, label: string): string {
  const text = string(value, label, 2000);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`${label} must be an absolute HTTPS URL.`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
    throw new Error(`${label} must be an HTTPS URL without credentials.`);
  return text;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 10000)
    throw new Error(`${label} must be an integer between 1 and 10000.`);
  return value;
}

/** Whitelists navigation metadata; deliberately drops explanations or solution content. */
export function validateProblem(input: unknown, index = 0): CurriculumProblem {
  const row = record(input, `Problem ${index + 1}`);
  const label = `Problem ${index + 1}`;
  const id = string(row.id, `${label}: id`, 200);
  if (reservedKeys.has(id)) throw new Error(`${label}: unsafe id.`);
  const platform = string(row.platform, `${label}: platform`);
  if (!validPlatforms.has(platform))
    throw new Error(`${label}: platform must be leetcode, gfg, or other.`);
  const problem: CurriculumProblem = {
    id,
    order: integer(row.order, `${label}: order`),
    title: string(row.title, `${label}: title`),
    module: string(row.module, `${label}: module`),
    platform: platform as CurriculumProblem['platform'],
    problemUrl: url(row.problemUrl, `${label}: problemUrl`),
  };
  if (row.pattern !== undefined && row.pattern !== '')
    problem.pattern = string(row.pattern, `${label}: pattern`);
  if (row.difficulty !== undefined && row.difficulty !== '') {
    const difficulty = string(row.difficulty, `${label}: difficulty`);
    if (!validDifficulties.has(difficulty))
      throw new Error(
        `${label}: difficulty must be Easy, Medium, or Hard; omit unverified difficulty.`,
      );
    problem.difficulty = difficulty as CurriculumProblem['difficulty'];
  }
  if (row.sourceUrl !== undefined && row.sourceUrl !== '')
    problem.sourceUrl = url(row.sourceUrl, `${label}: sourceUrl`);
  if (row.slug !== undefined && row.slug !== '') {
    problem.slug = string(row.slug, `${label}: slug`, 200);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(problem.slug))
      throw new Error(`${label}: slug must use lowercase letters, digits, and hyphens.`);
  }
  if (platform === 'leetcode') {
    const parsed = new URL(problem.problemUrl);
    const match = parsed.pathname.match(/^\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
    if (
      !['leetcode.com', 'www.leetcode.com'].includes(parsed.hostname) ||
      !match ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(
        `${label}: use a canonical LeetCode problem URL, never a solution/discussion URL.`,
      );
    }
    if (problem.slug && problem.slug !== match[1])
      throw new Error(`${label}: slug does not match the LeetCode URL.`);
    problem.slug = match[1]!;
  }
  return problem;
}

export function validateCurriculum(input: unknown): CurriculumData {
  const data = record(input, 'Curriculum');
  if (!Array.isArray(data.problems) || data.problems.length === 0 || data.problems.length > 10000)
    throw new Error('Curriculum must contain between 1 and 10000 problems.');
  const expectedCount = integer(data.expectedCount, 'expectedCount');
  if (typeof data.complete !== 'boolean') throw new Error('complete must be a boolean.');
  const verifiedAt = string(data.verifiedAt, 'verifiedAt');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt) ||
    !Number.isFinite(Date.parse(verifiedAt)) ||
    new Date(verifiedAt).toISOString().slice(0, 10) !== verifiedAt
  ) {
    throw new Error('verifiedAt must be a valid YYYY-MM-DD verification date.');
  }
  const problems = data.problems.map(validateProblem).sort((a, b) => a.order - b.order);
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const problem of problems) {
    if (ids.has(problem.id)) throw new Error(`Duplicate problem id: ${problem.id}`);
    if (orders.has(problem.order)) throw new Error(`Duplicate curriculum order: ${problem.order}`);
    if (problem.order > expectedCount)
      throw new Error(`Order ${problem.order} exceeds expectedCount.`);
    ids.add(problem.id);
    orders.add(problem.order);
  }
  if (
    problems.length > expectedCount ||
    (data.complete &&
      (problems.length !== expectedCount || problems.some((p, i) => p.order !== i + 1)))
  ) {
    throw new Error(
      'A complete curriculum must contain every order from 1 through expectedCount exactly once.',
    );
  }
  const id = string(data.id, 'id', 200);
  if (reservedKeys.has(id)) throw new Error('Unsafe curriculum id.');
  return {
    id,
    name: string(data.name, 'name'),
    version: string(data.version, 'version', 100),
    sourceUrl: url(data.sourceUrl, 'sourceUrl'),
    verifiedAt,
    expectedCount,
    complete: data.complete,
    problems,
  };
}
