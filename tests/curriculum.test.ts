import { describe, expect, it } from 'vitest';
import bundled from '../src/data/curricula/striver180.json';
import { curriculum, Striver180CurriculumProvider } from '../src/domain/curriculum';
import {
  assertStableProblemIds,
  curriculumFromCsv,
  parseCsv,
} from '../src/domain/curriculum/import';
import { validateCurriculum, validateProblem } from '../src/domain/curriculum/validation';
import type { CurriculumData, ProblemProgress, ProgressState } from '../src/types';

function fixture(): CurriculumData {
  return validateCurriculum(structuredClone(bundled));
}
function progress(problemId: string, state: ProblemProgress['state']): ProblemProgress {
  return { problemId, state, attemptIds: [], successfulRevisions: 0 };
}

describe('verified Striver provider', () => {
  it('bundles all 179 unique ordered records in the official 17 modules', () => {
    const problems = curriculum.getProblems();
    expect(curriculum.data.complete).toBe(true);
    expect(problems).toHaveLength(179);
    expect(curriculum.getModules()).toHaveLength(17);
    expect(problems.map((p) => p.order)).toEqual(Array.from({ length: 179 }, (_, i) => i + 1));
    expect(new Set(problems.map((p) => p.id)).size).toBe(179);
    expect(problems[0]?.title).toBe('Majority Element-I');
    expect(problems[1]?.slug).toBe('maximum-subarray');
    expect(problems[178]?.title).toBe('Print all primes till N');
    expect(curriculum.getModules().map((module) => module.problems.length)).toEqual([
      12, 5, 13, 9, 10, 16, 14, 8, 5, 15, 10, 29, 19, 5, 4, 4, 1,
    ]);
  });

  it('keeps in-progress work next and skips all explicit completion outcomes', () => {
    const problems = curriculum.getProblems();
    const state: ProgressState = {};
    for (const [index, confidence] of (['independent', 'assisted', 'relearn'] as const).entries()) {
      const id = problems[index]!.id;
      state[id] = progress(id, confidence);
    }
    const fourth = problems[3]!;
    state[fourth.id] = progress(fourth.id, 'in_progress');
    expect(curriculum.getNextProblem(state)?.id).toBe(fourth.id);
  });

  it('returns null only when every available row has an explicit completion', () => {
    const state = Object.fromEntries(
      curriculum.getProblems().map((p) => [p.id, progress(p.id, 'assisted')]),
    );
    expect(curriculum.getNextProblem(state)).toBeNull();
    expect(curriculum.getNextProblem({})?.order).toBe(1);
  });

  it('preserves separate curriculum identities for a reused platform problem', () => {
    const rows = curriculum.getAllBySlug('subsets');
    expect(rows.map((row) => row.order)).toEqual([40, 175]);
    expect(rows[0]!.id).not.toBe(rows[1]!.id);
    expect(curriculum.getBySlug('unknown')).toBeUndefined();
  });

  it('does not let callers mutate returned navigation rows', () => {
    const provider = new Striver180CurriculumProvider();
    provider.getProblems()[0]!.title = 'Mutated';
    expect(provider.getNextProblem({})?.title).toBe('Majority Element-I');
  });

  it('uses verified LeetCode difficulty and leaves unmatched problems unrated', () => {
    expect(curriculum.getProblems().filter((problem) => problem.difficulty)).toHaveLength(145);
    expect(
      curriculum
        .getProblems()
        .filter((problem) => problem.platform === 'other')
        .every((problem) => problem.difficulty === undefined),
    ).toBe(true);
    expect(curriculum.getBySlug('majority-element')?.difficulty).toBe('Easy');
    expect(curriculum.getBySlug('koko-eating-bananas')?.difficulty).toBe('Medium');
    expect(curriculum.getBySlug('trapping-rain-water')?.difficulty).toBe('Hard');
    expect(curriculum.getBySlug('find-the-index-of-the-first-occurrence-in-a-string')?.order).toBe(
      173,
    );
  });

  it('keeps solution/discussion and known mismatched links out of the solving queue', () => {
    for (const order of [124, 130, 171]) {
      const row = curriculum.getProblems().find((problem) => problem.order === order)!;
      expect(row.platform).toBe('other');
      expect(row.problemUrl).toBe(row.sourceUrl);
    }
    expect(
      curriculum
        .getProblems()
        .every((problem) => !/\/(discuss|solutions)\//.test(problem.problemUrl)),
    ).toBe(true);
  });
});

describe('curriculum validation', () => {
  it('rejects duplicate IDs and orders that could overwrite or misroute progress', () => {
    const data = fixture();
    data.problems[1]!.id = data.problems[0]!.id;
    expect(() => validateCurriculum(data)).toThrow('Duplicate problem id');
    data.problems[1]!.id = 'unique';
    data.problems[1]!.order = 1;
    expect(() => validateCurriculum(data)).toThrow('Duplicate curriculum order');
  });

  it('rejects incomplete data claimed as complete and retains explicit partial order', () => {
    const data = fixture();
    data.problems = data.problems.slice(1, 4);
    expect(() => validateCurriculum(data)).toThrow('complete curriculum');
    data.complete = false;
    expect(validateCurriculum(data).problems.map((p) => p.order)).toEqual([2, 3, 4]);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'http://leetcode.com/problems/two-sum/',
    'https://token@leetcode.com/problems/two-sum/',
  ])('rejects unsafe URL %s', (problemUrl) => {
    expect(() => validateProblem({ ...fixture().problems[0], problemUrl })).toThrow('HTTPS');
  });

  it('rejects lookalike hosts, discussion links, and mismatched slugs', () => {
    const problem = fixture().problems[0]!;
    expect(() =>
      validateProblem({
        ...problem,
        problemUrl: 'https://leetcode.com.evil.example/problems/majority-element/',
      }),
    ).toThrow('canonical');
    expect(() =>
      validateProblem({ ...problem, problemUrl: `${problem.problemUrl}discuss/1` }),
    ).toThrow('canonical');
    expect(() => validateProblem({ ...problem, slug: 'two-sum' })).toThrow('does not match');
  });

  it('drops non-navigation content and rejects prototype keys', () => {
    const problem = fixture().problems[0]!;
    expect(validateProblem({ ...problem, editorial: 'Do not bundle me' })).not.toHaveProperty(
      'editorial',
    );
    expect(() => validateProblem({ ...problem, id: '__proto__' })).toThrow('unsafe id');
  });

  it('rejects invalid dates and unverifiable difficulty categories', () => {
    expect(() => validateCurriculum({ ...fixture(), verifiedAt: '2026-02-30' })).toThrow(
      'verification date',
    );
    expect(() => validateProblem({ ...fixture().problems[0], difficulty: 'Core' })).toThrow(
      'omit unverified',
    );
  });
});

describe('curriculum import', () => {
  it('parses quoted commas, escaped quotes, line endings, and a BOM', () => {
    expect(parseCsv('\uFEFFtitle,pattern\r\n"A, B","Say ""hello"""\r\n"C\nD",DFS\n')).toEqual([
      ['title', 'pattern'],
      ['A, B', 'Say "hello"'],
      ['C\nD', 'DFS'],
    ]);
  });

  it('rejects malformed CSV rather than silently shifting metadata', () => {
    expect(() => parseCsv('a,b\n"unterminated,b')).toThrow('unterminated');
    expect(() => parseCsv('a,b\n"hello"oops,b')).toThrow('Malformed');
    expect(() =>
      curriculumFromCsv(
        'id,order,title,module,platform,problemUrl\nx,1,x,Arrays,leetcode',
        fixture(),
      ),
    ).toThrow('fields');
  });

  it('validates a metadata-only CSV import without deriving missing order/title', () => {
    const data = fixture();
    data.complete = false;
    const csv =
      'id,order,title,module,pattern,platform,problemUrl,sourceUrl\nstriver180:majority-element-i,1,Majority Element-I,Arrays,Linear Scan,leetcode,https://leetcode.com/problems/majority-element/,https://takeuforward.org/practice/dsa/majority-element-i';
    const imported = curriculumFromCsv(csv, data);
    expect(imported.problems).toHaveLength(1);
    expect(imported.problems[0]?.slug).toBe('majority-element');
    expect(imported.complete).toBe(false);
    expect(() => curriculumFromCsv(csv.replace(',order,', ','), data)).toThrow(
      'Missing CSV header: order',
    );
  });

  it('rejects editorial columns and duplicate headers', () => {
    expect(() => curriculumFromCsv('id,editorial\nx,hello', fixture())).toThrow(
      'Unknown CSV header',
    );
    expect(() => curriculumFromCsv('id,id\nx,y', fixture())).toThrow('duplicate headers');
  });

  it('permits reordering but prevents identity reassignment that would detach progress', () => {
    const before = fixture();
    const next = fixture();
    next.problems[0]!.order = 2;
    next.problems[1]!.order = 1;
    expect(() => assertStableProblemIds(before, next)).not.toThrow();
    next.problems[0]!.id = 'new-id-for-existing-problem';
    expect(() => assertStableProblemIds(before, next)).toThrow('Keep that id');
    next.problems[0]!.id = before.problems[0]!.id;
    next.problems[0]!.sourceUrl = before.problems[1]!.sourceUrl;
    expect(() => assertStableProblemIds(before, next)).toThrow('reassigned');
  });
});
