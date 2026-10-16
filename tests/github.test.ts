import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  commitMessage,
  decodeBase64Utf8,
  GITHUB_API_VERSION,
  GitHubService,
  progressReadmeSection,
  README_END,
  README_START,
  receiptPath,
  slugify,
  solutionContent,
  solutionPath,
  updateReadme,
} from '../src/services/GitHubService';
import { emptyState } from '../src/services/StorageService';
import type { Attempt, CurriculumProblem } from '../src/types';

const token = 'github_pat_TEST_SECRET';
const problem: CurriculumProblem = {
  id: 'koko',
  order: 12,
  title: '875. Koko Eating Bananas',
  slug: 'koko-eating-bananas',
  module: 'Binary Search',
  pattern: 'Binary Search on Answer',
  difficulty: 'Medium',
  platform: 'leetcode',
  problemUrl: 'https://leetcode.com/problems/koko-eating-bananas/',
};
const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
  id: 'attempt-one',
  problemId: problem.id,
  curriculumId: 'striver180',
  kind: 'new',
  startedAt: '2026-10-08T10:00:00Z',
  completedAt: '2026-10-08T10:28:13Z',
  acceptedAt: '2026-10-08T10:28:00Z',
  activeSeconds: 1693,
  status: 'completed',
  codeProvenance: 'user-confirmed',
  submissionCount: 2,
  submissionIds: ['wrong', 'accepted'],
  hintsUsed: 1,
  editorialViewed: false,
  solutionViewed: false,
  confidence: 'assisted',
  language: 'python3',
  code: 'print("🍌")\n',
  ...overrides,
});
function state() {
  const result = emptyState();
  result.settings.github = {
    enabled: true,
    repository: 'student/dsa-journey',
    branch: 'main',
    autoCommit: true,
    includeMetadata: true,
    updateReadme: false,
  };
  result.attempts['attempt-one'] = attempt();
  result.progress.koko = {
    problemId: 'koko',
    state: 'assisted',
    lastConfidence: 'assisted',
    attemptIds: ['attempt-one'],
    firstSolvedAt: '2026-10-08T10:28:13Z',
    successfulRevisions: 0,
  };
  return result;
}
const hash = (number: number) => number.toString(16).padStart(40, '0');
const root = '/repos/student/dsa-journey';
function file(path: string, content: string) {
  return {
    type: 'file',
    path,
    size: Buffer.byteLength(content),
    encoding: 'base64',
    content: Buffer.from(content, 'utf8').toString('base64'),
  };
}
function receipt(attemptId = 'attempt-one') {
  return file(
    `.dsacommit/attempts/${attemptId}.json`,
    JSON.stringify({
      schemaVersion: 1,
      attemptId,
      problemId: problem.id,
      curriculumId: 'striver180',
    }),
  );
}
type Step = { method?: string; path: string; status?: number; body?: unknown; error?: string };
function http(steps: Step[]) {
  const requests: {
    path: string;
    method: string;
    body?: Record<string, unknown>;
    init: RequestInit;
  }[] = [];
  let index = 0;
  const mock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const step = steps[index++];
    expect(String(input).startsWith('https://api.github.com/')).toBe(true);
    const path = String(input).slice('https://api.github.com'.length);
    const method = init.method ?? 'GET';
    requests.push({
      path,
      method,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      init,
    });
    expect(step, `Unexpected ${method} ${path}`).toBeDefined();
    expect({ method, path }).toEqual({ method: step?.method ?? 'GET', path: step?.path });
    if (step?.error) throw new Error(step.error);
    return new Response(JSON.stringify(step?.body ?? {}), { status: step?.status ?? 200 });
  });
  return { requests, fetcher: mock as typeof fetch, done: () => expect(index).toBe(steps.length) };
}
function cycle(number = 1, readme?: string, patch: Partial<Step> = {}): Step[] {
  const parent = hash(number);
  return [
    { path: `${root}/git/ref/heads/main`, body: { object: { type: 'commit', sha: parent } } },
    { path: `${root}/contents/.dsacommit/attempts/attempt-one.json?ref=${parent}`, status: 404 },
    { path: `${root}/git/commits/${parent}`, body: { tree: { sha: hash(number + 10) } } },
    ...(readme === undefined
      ? []
      : [{ path: `${root}/readme?ref=${parent}`, body: file('README.md', readme) }]),
    { method: 'POST', path: `${root}/git/trees`, status: 201, body: { sha: hash(number + 20) } },
    { method: 'POST', path: `${root}/git/commits`, status: 201, body: { sha: hash(number + 30) } },
    { method: 'PATCH', path: `${root}/git/refs/heads/main`, body: {}, ...patch },
  ];
}
const auth = { getToken: async () => token };
afterEach(() => vi.useRealTimers());

describe('GitHub source and commit formatting', () => {
  it('uses stable module/problem/language paths with verified numbers only', () => {
    expect(solutionPath(problem, 'python3')).toBe(
      'binary-search/0875-koko-eating-bananas/solution.py',
    );
    expect(solutionPath({ ...problem, title: 'Koko Eating Bananas' }, 'C++')).toBe(
      'binary-search/koko-eating-bananas/solution.cpp',
    );
    expect(solutionPath(problem, 'unrecognized')).toBe(
      'binary-search/0875-koko-eating-bananas/solution.txt',
    );
    expect(slugify('../../Árrays \\ & Hashing')).toBe('arrays-hashing');
    expect(solutionPath({ ...problem, module: '../../', slug: '../danger' }, 'javascript')).toBe(
      'problem/0875-danger/solution.js',
    );
  });

  it('rejects receipt identifiers that could escape the managed directory', () => {
    expect(receiptPath('abcd-1234')).toBe('.dsacommit/attempts/abcd-1234.json');
    expect(() => receiptPath('../README')).toThrow(/identifier/);
    expect(() => receiptPath('one\ntwo')).toThrow(/identifier/);
  });

  it('keeps original source bytes when metadata is disabled', () => {
    const original = '#!/usr/bin/python3\r\nprint("🍌")\r\n';
    expect(solutionContent(attempt({ code: original }), problem, false)).toBe(original);
  });

  it('preserves shebang and source while neutralizing multiline and comment-closing metadata', () => {
    const code = '#!/usr/bin/env python3\n# coding: utf-8\nprint("🍌")\n';
    const content = solutionContent(
      attempt({ code, notes: 'Great!\nprint("not source") */ \\u000a' }),
      problem,
      true,
    );
    expect(content.startsWith('#!/usr/bin/env python3\n# coding: utf-8\n# Problem:')).toBe(true);
    expect(content).toContain('# Notes: Great! print("not source") * / /u000a\n');
    expect(content.endsWith('print("🍌")\n')).toBe(true);
    expect(content).toContain('# Time: 28m 13s\n');
    expect(content).toContain('# Confidence: assisted\n');
    expect(content).not.toContain('\nprint("not source")');
  });

  it('uses the correct comment syntax for Java, SQL and PHP', () => {
    expect(
      solutionContent(attempt({ language: 'java', code: 'class Solution {}' }), problem, true),
    ).toMatch(/^\/\/ Problem:/);
    expect(solutionContent(attempt({ language: 'sql', code: 'SELECT 1;' }), problem, true)).toMatch(
      /^-- Problem:/,
    );
    expect(
      solutionContent(attempt({ language: 'php', code: '<?php\necho 1;' }), problem, true),
    ).toMatch(/^<\?php\n\/\/ Problem:/);
  });

  it('describes real solves or revisions and includes the idempotency marker', () => {
    expect(commitMessage(attempt(), problem)).toBe(
      'feat(dsa): solve 875. Koko Eating Bananas [28m] 🟡\n\nDSACommit-Attempt: attempt-one',
    );
    expect(
      commitMessage(
        attempt({ kind: 'revision', confidence: 'independent', activeSeconds: 0 }),
        problem,
      ),
    ).toContain('revise 875. Koko Eating Bananas [untimed] 🟢');
  });
});

describe('managed README updates', () => {
  it('decodes non-ASCII README content without corrupting UTF-8', () => {
    const content = '# अभ्यास 🍌 — Résumé\n';
    const encoded = Buffer.from(content).toString('base64');
    expect(decodeBase64Utf8(`${encoded.slice(0, 8)}\n${encoded.slice(8)}`)).toBe(content);
    expect(() => decodeBase64Utf8('%%%')).toThrow(/UTF-8/);
  });

  it('changes only the managed block, retaining all surrounding user content exactly', () => {
    const prefix = '# My practice 🍌\r\n\r\nPersonal paragraph.\n';
    const suffix = '\n\n## My notes\nKeep these.\n';
    const original = `${prefix}${README_START}\nOld stats\n${README_END}${suffix}`;
    const section = progressReadmeSection(state(), [problem], new Date('2026-10-08T12:00:00Z'));
    expect(updateReadme(original, section)).toBe(`${prefix}${section}${suffix}`);
    expect(section).toContain('Striver 180: 1 / 1');
    expect(section).toContain('| Binary Search | 1/1 | 0% |');
  });

  it('appends one block without deleting an unmarked README', () => {
    const result = updateReadme('# My existing journey\n', `${README_START}\nStats\n${README_END}`);
    expect(result.startsWith('# My existing journey\n')).toBe(true);
    expect(result.split(README_START)).toHaveLength(2);
  });

  it.each([
    README_START,
    README_END,
    `${README_END}\n${README_START}`,
    `${README_START}${README_START}${README_END}`,
  ])('refuses ambiguous markers instead of destroying content', (readme) => {
    expect(() => updateReadme(readme, 'replacement')).toThrow(/markers/);
  });
});

describe('GitHub validation and transport', () => {
  it('validates authentication, repository and initialized branch using read-only requests', async () => {
    const api = http([
      { path: '/user', body: { login: 'student' } },
      { path: root, body: { archived: false, permissions: { push: true } } },
      { path: `${root}/git/ref/heads/main`, body: { object: { type: 'commit', sha: hash(1) } } },
    ]);
    await new GitHubService(auth, api.fetcher).validate(state().settings.github);
    api.done();
    for (const request of api.requests) {
      expect(request.method).toBe('GET');
      expect(request.init.redirect).toBe('error');
      expect(request.init.headers).toMatchObject({
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      });
    }
  });

  it('rejects unsafe repository/branch configuration before sending credentials', async () => {
    const fetcher = vi.fn();
    const service = new GitHubService(auth, fetcher);
    for (const repository of ['https://evil.test/repo', 'student/../other', 'student/repo.git']) {
      await expect(service.validate({ ...state().settings.github, repository })).rejects.toThrow(
        /repository/,
      );
    }
    for (const branch of [
      '../main',
      'main\nInjected',
      'feature//x',
      'bad.lock',
      '/main',
      'main?token=x',
    ]) {
      await expect(service.validate({ ...state().settings.github, branch })).rejects.toThrow(
        /branch/,
      );
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports missing tokens before making a request', async () => {
    const fetcher = vi.fn();
    await expect(
      new GitHubService({ getToken: async () => null }, fetcher).validate(state().settings.github),
    ).rejects.toThrow(/token/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('provides an actionable error for an empty repository or missing branch', async () => {
    const api = http([
      { path: '/user' },
      { path: root, body: { permissions: { push: true } } },
      { path: `${root}/git/ref/heads/main`, status: 409 },
    ]);
    await expect(
      new GitHubService(auth, api.fetcher).validate(state().settings.github),
    ).rejects.toThrow(/initial commit.*README/);
    api.done();
  });

  it.each([401, 403, 429, 500])(
    'sanitizes HTTP %i errors without exposing response data',
    async (status) => {
      const api = http([
        { path: '/user', status, body: { message: `${token} secret-source-code` } },
      ]);
      const error = await new GitHubService(auth, api.fetcher)
        .validate(state().settings.github)
        .catch((value) => value as Error);
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain(token);
      expect(String(error)).not.toContain('secret-source-code');
    },
  );

  it('sanitizes thrown transport failures', async () => {
    const api = http([{ path: '/user', error: `Failed fetch with ${token}` }]);
    await expect(
      new GitHubService(auth, api.fetcher).validate(state().settings.github),
    ).rejects.toThrow('Could not reach GitHub');
  });

  it('aborts stalled requests after the bounded timeout', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const result = new GitHubService(auth, fetcher).validate(state().settings.github);
    const expectation = expect(result).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(20_001);
    await expectation;
  });
});

describe('atomic GitHub sync', () => {
  it('bundles solution, receipt and optional Unicode README in one commit based on the existing tree', async () => {
    const snapshot = state();
    snapshot.settings.github.updateReadme = true;
    const before = structuredClone(snapshot);
    const api = http(cycle(1, '# अभ्यास 🍌\n\nMy notes stay.\n'));
    const result = await new GitHubService(auth, api.fetcher).sync(attempt(), problem, snapshot, [
      problem,
    ]);
    api.done();
    expect(result.commitUrl).toBe(`https://github.com/student/dsa-journey/commit/${hash(31)}`);
    const tree = api.requests.find((request) => request.path.endsWith('/git/trees'))?.body;
    expect(tree?.base_tree).toBe(hash(11));
    const entries = tree?.tree as { path: string; content: string }[];
    expect(entries.map((entry) => entry.path)).toEqual([
      'binary-search/0875-koko-eating-bananas/solution.py',
      '.dsacommit/attempts/attempt-one.json',
      'README.md',
    ]);
    expect(entries[2]?.content.startsWith('# अभ्यास 🍌\n\nMy notes stay.\n')).toBe(true);
    expect(JSON.parse(entries[1]!.content)).toMatchObject({
      attemptId: 'attempt-one',
      problemId: problem.id,
    });
    expect(
      api.requests.find(
        (request) => request.path.endsWith('/git/commits') && request.method === 'POST',
      )?.body,
    ).toMatchObject({ parents: [hash(1)], tree: hash(21) });
    expect(api.requests.at(-1)?.body).toEqual({ sha: hash(31), force: false });
    expect(snapshot).toEqual(before);
  });

  it('does not read or write a README when the setting is disabled', async () => {
    const api = http(cycle());
    await new GitHubService(auth, api.fetcher).sync(attempt(), problem, state(), [problem]);
    api.done();
    expect(api.requests.some((request) => request.path.includes('readme'))).toBe(false);
    expect(
      api.requests.find((request) => request.path.endsWith('/git/trees'))?.body?.tree as unknown[],
    ).toHaveLength(2);
  });

  it('returns an existing receipt without creating another commit', async () => {
    const api = http([
      { path: `${root}/git/ref/heads/main`, body: { object: { type: 'commit', sha: hash(90) } } },
      {
        path: `${root}/contents/.dsacommit/attempts/attempt-one.json?ref=${hash(90)}`,
        body: receipt(),
      },
    ]);
    expect(
      await new GitHubService(auth, api.fetcher).sync(attempt(), problem, state(), [problem]),
    ).toEqual({ commitUrl: `https://github.com/student/dsa-journey/commit/${hash(90)}` });
    api.done();
    expect(api.requests.every((request) => request.method === 'GET')).toBe(true);
  });

  it('recovers from a crash/lost response after the branch update using the atomic receipt', async () => {
    const initial = http(
      cycle(1, undefined, { error: 'Connection closed after GitHub applied the update' }),
    );
    await expect(
      new GitHubService(auth, initial.fetcher).sync(attempt(), problem, state(), [problem]),
    ).rejects.toThrow(/reach GitHub/);
    const retry = http([
      { path: `${root}/git/ref/heads/main`, body: { object: { type: 'commit', sha: hash(31) } } },
      {
        path: `${root}/contents/.dsacommit/attempts/attempt-one.json?ref=${hash(31)}`,
        body: receipt(),
      },
    ]);
    await new GitHubService(auth, retry.fetcher).sync(attempt(), problem, state(), [problem]);
    retry.done();
    expect(retry.requests).toHaveLength(2);
    expect(retry.requests.every((request) => request.method === 'GET')).toBe(true);
  });

  it('rebases a racing branch update and preserves the new README and base tree', async () => {
    const snapshot = state();
    snapshot.settings.github.updateReadme = true;
    const api = http([
      ...cycle(1, '# Original README\n', { status: 422 }),
      ...cycle(2, '# Concurrent human edit\n'),
    ]);
    await new GitHubService(auth, api.fetcher).sync(attempt(), problem, snapshot, [problem]);
    api.done();
    const trees = api.requests
      .filter((request) => request.path.endsWith('/git/trees'))
      .map((request) => request.body!);
    expect(trees.map((tree) => tree.base_tree)).toEqual([hash(11), hash(12)]);
    expect(
      (trees[1]?.tree as { path: string; content: string }[]).find(
        (entry) => entry.path === 'README.md',
      )?.content,
    ).toContain('# Concurrent human edit\n');
    expect(
      api.requests
        .filter((request) => request.method === 'PATCH')
        .every((request) => request.body?.force === false),
    ).toBe(true);
  });

  it('detects a receipt written by a racing sync after a conflict and stops retrying', async () => {
    const api = http([
      ...cycle(1, undefined, { status: 409 }),
      { path: `${root}/git/ref/heads/main`, body: { object: { type: 'commit', sha: hash(99) } } },
      {
        path: `${root}/contents/.dsacommit/attempts/attempt-one.json?ref=${hash(99)}`,
        body: receipt(),
      },
    ]);
    await new GitHubService(auth, api.fetcher).sync(attempt(), problem, state(), [problem]);
    api.done();
    expect(api.requests.filter((request) => request.method === 'PATCH')).toHaveLength(1);
  });

  it('limits conflict retries to three attempts', async () => {
    const api = http([1, 2, 3].flatMap((number) => cycle(number, undefined, { status: 422 })));
    await expect(
      new GitHubService(auth, api.fetcher).sync(attempt(), problem, state(), [problem]),
    ).rejects.toThrow(/three tries/);
    api.done();
    expect(api.requests.filter((request) => request.method === 'PATCH')).toHaveLength(3);
  });

  it('fails safely on malformed README markers before creating any remote objects', async () => {
    const snapshot = state();
    snapshot.settings.github.updateReadme = true;
    const api = http(cycle(1, `# Mine\n${README_START}\nMissing end`).slice(0, 4));
    await expect(
      new GitHubService(auth, api.fetcher).sync(attempt(), problem, snapshot, [problem]),
    ).rejects.toThrow(/markers/);
    api.done();
    expect(api.requests.every((request) => request.method === 'GET')).toBe(true);
  });

  it('rejects conflicting receipts instead of overwriting or accepting the wrong history', async () => {
    const api = http([
      { path: `${root}/git/ref/heads/main`, body: { object: { type: 'commit', sha: hash(1) } } },
      {
        path: `${root}/contents/.dsacommit/attempts/attempt-one.json?ref=${hash(1)}`,
        body: receipt('another-attempt'),
      },
    ]);
    await expect(
      new GitHubService(auth, api.fetcher).sync(attempt(), problem, state(), [problem]),
    ).rejects.toThrow(/conflicting.*receipt/);
    api.done();
  });

  it.each([
    { status: 'accepted' },
    { confidence: undefined },
    { code: '' },
    { language: undefined },
    { completedAt: undefined },
    { problemId: 'other' },
  ] as Partial<Attempt>[])(
    'refuses incomplete or mismatched attempts without network writes',
    async (override) => {
      const fetcher = vi.fn();
      await expect(
        new GitHubService(auth, fetcher).sync(attempt(override), problem, state(), [problem]),
      ).rejects.toThrow(/Only a completed/);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
});
