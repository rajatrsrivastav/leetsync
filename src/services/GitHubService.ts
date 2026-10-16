import type { AppState, Attempt, CurriculumProblem, Settings } from '../types';
import { topicMastery } from '../domain/progress';
import { currentStreak } from '../domain/streak';
import { dateKeyFromTimestamp } from '../utils/date';

export interface GitHubAuth {
  getToken(): Promise<string | null>;
}
export const GITHUB_API_VERSION = '2026-03-10';
export const README_START = '<!-- DSACOMMIT:START -->';
export const README_END = '<!-- DSACOMMIT:END -->';
const API = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 20_000;
type GitHubSettings = Settings['github'];
type JsonRecord = Record<string, unknown>;
type TreeEntry = { path: string; mode: '100644' | '100755'; type: 'blob'; content: string };

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

function object(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new GitHubError('GitHub returned an unexpected response. Retry later.');
  return value as JsonRecord;
}
function sha(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value))
    throw new GitHubError('GitHub returned an invalid commit or tree. Retry later.');
  return value;
}
function config(settings: GitHubSettings): {
  repository: string;
  branch: string;
  root: string;
  ref: string;
} {
  const repository = settings.repository.trim();
  const branch = settings.branch.trim();
  if (
    !/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
    /\/(?:\.|\.\.)$/.test(repository) ||
    repository.endsWith('.git')
  ) {
    throw new GitHubError(
      'Enter a GitHub repository as owner/repository, without a URL or .git suffix.',
    );
  }
  if (
    !branch ||
    branch.length > 250 ||
    branch === '@' ||
    /[\x00-\x20\x7f~^:?*\[\\]/.test(branch) ||
    branch.includes('..') ||
    branch.includes('@{') ||
    branch
      .split('/')
      .some((part) => !part || part.startsWith('.') || part.endsWith('.') || part.endsWith('.lock'))
  ) {
    throw new GitHubError('Enter an existing valid Git branch name.');
  }
  return {
    repository,
    branch,
    root: `/repos/${repository}`,
    ref: `heads/${branch.split('/').map(encodeURIComponent).join('/')}`,
  };
}

export function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120)
      .replace(/-+$/g, '') || 'problem'
  );
}
function languageInfo(language?: string): { extension: string; comment: string } {
  const value = (language ?? '').toLowerCase().replace(/\s/g, '');
  const languages: Record<string, [string, string]> = {
    python: ['py', '#'],
    python3: ['py', '#'],
    py: ['py', '#'],
    javascript: ['js', '//'],
    js: ['js', '//'],
    typescript: ['ts', '//'],
    ts: ['ts', '//'],
    java: ['java', '//'],
    cpp: ['cpp', '//'],
    'c++': ['cpp', '//'],
    c: ['c', '//'],
    csharp: ['cs', '//'],
    'c#': ['cs', '//'],
    go: ['go', '//'],
    golang: ['go', '//'],
    rust: ['rs', '//'],
    kotlin: ['kt', '//'],
    swift: ['swift', '//'],
    ruby: ['rb', '#'],
    php: ['php', '//'],
    dart: ['dart', '//'],
    scala: ['scala', '//'],
    bash: ['sh', '#'],
    shell: ['sh', '#'],
    sql: ['sql', '--'],
    mysql: ['sql', '--'],
    postgresql: ['sql', '--'],
  };
  const [extension, comment] = languages[value] ?? ['txt', '#'];
  return { extension: extension!, comment: comment! };
}

/** No invented LeetCode number: use a number only when present in verified metadata. */
export function solutionPath(problem: CurriculumProblem, language?: string): string {
  const verifiedNumber = /^(\d+)\.\s/.exec(problem.title)?.[1];
  const name = slugify(problem.slug || problem.title.replace(/^\d+\.\s*/, '') || problem.id);
  const directory = verifiedNumber ? `${verifiedNumber.padStart(4, '0')}-${name}` : name;
  return `${slugify(problem.module)}/${directory}/solution.${languageInfo(language).extension}`;
}

export function receiptPath(attemptId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(attemptId))
    throw new GitHubError('This attempt has an invalid identifier and cannot be synced.');
  return `.dsacommit/attempts/${attemptId}.json`;
}

// Single-line comments prevent user notes from turning into executable source.
function singleLine(value: unknown): string {
  return String(value ?? '')
    .replace(/[\r\n\u2028\u2029\x00-\x1f\x7f]/g, ' ')
    .replace(/\/\*/g, '/ *')
    .replace(/\*\//g, '* /')
    .replace(/\\/g, '/')
    .trim();
}
function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Untimed';
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

export function solutionContent(
  attempt: Attempt,
  problem: CurriculumProblem,
  includeMetadata: boolean,
): string {
  const code = attempt.code ?? '';
  if (!includeMetadata) return code;
  const { comment } = languageInfo(attempt.language);
  const fields = [
    `Problem: ${singleLine(problem.title)}`,
    `URL: ${singleLine(problem.problemUrl)}`,
    `Topic: ${singleLine(problem.module)}`,
    ...(problem.pattern ? [`Pattern: ${singleLine(problem.pattern)}`] : []),
    `Solved: ${dateKeyFromTimestamp(attempt.completedAt ?? '') ?? 'Unknown'}`,
    `Time: ${duration(attempt.activeSeconds)}`,
    `Submissions: ${attempt.submissionCount}`,
    `Hints: ${attempt.hintsUsed}`,
    `Editorial Viewed: ${attempt.editorialViewed ? 'Yes' : 'No'}`,
    `Solution Viewed: ${attempt.solutionViewed ? 'Yes' : 'No'}`,
    `Confidence: ${singleLine(attempt.confidence)}`,
    `Attempt: ${singleLine(attempt.kind)}`,
    `Complexity: user-reported; local observations are not a proof`,
    ...(attempt.timeComplexity ? [`Time Complexity: ${singleLine(attempt.timeComplexity)}`] : []),
    ...(attempt.spaceComplexity
      ? [`Space Complexity: ${singleLine(attempt.spaceComplexity)}`]
      : []),
    ...(attempt.notes ? [`Notes: ${singleLine(attempt.notes)}`] : []),
  ];
  const header = `${fields.map((line) => `${comment} ${line}`).join('\n')}\n\n`;
  // Keep executable shebangs and Python/Ruby encoding declarations in their required positions.
  const prefix =
    /^(?:#![^\n]*(?:\n|$))?(?:#[^\n]*(?:coding|encoding)\s*[:=][^\n]*(?:\n|$))?/.exec(code)?.[0] ??
    '';
  if (prefix)
    return `${prefix}${prefix.endsWith('\n') ? '' : '\n'}${header}${code.slice(prefix.length)}`;
  if (languageInfo(attempt.language).extension === 'php' && code.startsWith('<?php')) {
    return `<?php\n${header}${code.slice(5).replace(/^\r?\n/, '')}`;
  }
  return `${header}${code}`;
}

export function commitMessage(attempt: Attempt, problem: CurriculumProblem): string {
  const icon =
    attempt.confidence === 'independent' ? '🟢' : attempt.confidence === 'assisted' ? '🟡' : '🔴';
  const time =
    attempt.activeSeconds > 0
      ? `${Math.max(1, Math.round(attempt.activeSeconds / 60))}m`
      : 'untimed';
  return `feat(dsa): ${attempt.kind === 'revision' ? 'revise' : 'solve'} ${singleLine(problem.title).slice(0, 120)} [${time}] ${icon}\n\nDSACommit-Attempt: ${singleLine(attempt.id)}`;
}

function markdown(value: string): string {
  return singleLine(value).replace(/[\\`*_{}[\]()#+.!|<>]/g, '\\$&');
}

export function progressReadmeSection(
  state: AppState,
  problems: CurriculumProblem[],
  now = new Date(),
): string {
  const topics = topicMastery(state, problems);
  const completed = topics.reduce((sum, topic) => sum + topic.completed, 0);
  const title =
    state.settings.curriculumId === 'striver180'
      ? 'Striver 180'
      : markdown(state.settings.curriculumId);
  const rows = topics.map(
    (topic) =>
      `| ${markdown(topic.topic)} | ${topic.completed}/${topic.total} | ${topic.completed ? Math.round((topic.independent / topic.completed) * 100) : 0}% |`,
  );
  return [
    README_START,
    '## DSACommit progress',
    '',
    `${title}: ${completed} / ${problems.length}`,
    '',
    `🔥 Current streak: ${currentStreak(state.activities, now)} days`,
    '',
    '| Topic | Solved | Independent |',
    '| :--- | ---: | ---: |',
    ...rows,
    README_END,
  ].join('\n');
}

/** Replaces only our one marked section; malformed or duplicate markers are never guessed. */
export function updateReadme(existing: string, section: string): string {
  const starts = existing.split(README_START).length - 1;
  const ends = existing.split(README_END).length - 1;
  if (!starts && !ends)
    return `${existing || '# DSA Journey\n'}${existing.endsWith('\n') || !existing ? '\n' : '\n\n'}${section}\n`;
  const start = existing.indexOf(README_START);
  const end = existing.indexOf(README_END);
  if (starts !== 1 || ends !== 1 || end < start)
    throw new GitHubError(
      'README has incomplete or duplicate DSACommit markers. Fix the markers or disable README updates, then retry.',
    );
  return `${existing.slice(0, start)}${section}${existing.slice(end + README_END.length)}`;
}

/** Browser-native UTF-8 decoding; atob alone corrupts non-ASCII README text. */
export function decodeBase64Utf8(content: string): string {
  try {
    const binary = atob(content.replace(/\s/g, ''));
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    );
  } catch {
    throw new GitHubError(
      'GitHub returned a file that is not valid UTF-8. Disable README updates if it is your README.',
    );
  }
}
function fileContent(raw: unknown): { path: string; content: string } {
  const file = object(raw);
  if (
    file.type !== 'file' ||
    file.encoding !== 'base64' ||
    typeof file.content !== 'string' ||
    typeof file.path !== 'string' ||
    file.content.length > 1_500_000 ||
    (typeof file.size === 'number' && file.size > 1_000_000)
  ) {
    throw new GitHubError(
      'GitHub could not provide a small UTF-8 file. Disable README updates if your README exceeds 1 MB.',
    );
  }
  return { path: file.path, content: decodeBase64Utf8(file.content) };
}

export class GitHubService {
  constructor(
    private auth: GitHubAuth,
    private fetcher: typeof fetch = fetch,
  ) {}

  private async token(): Promise<string> {
    let token: string | null;
    try {
      token = await this.auth.getToken();
    } catch {
      throw new GitHubError('Could not read GitHub authentication. Save your token again.');
    }
    if (!token?.trim()) throw new GitHubError('Add a fine-grained GitHub token in Settings.');
    if (!/^[A-Za-z0-9_.-]{1,1000}$/.test(token.trim()))
      throw new GitHubError('The GitHub token has an invalid format. Paste it again.');
    return token.trim();
  }

  private async request(
    path: string,
    token: string,
    method = 'GET',
    body?: unknown,
    allowMissing = false,
  ): Promise<unknown> {
    // Every URL is constructed locally. Never follow API-supplied URLs or redirects with credentials.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetcher(`${API}${path}`, {
        method,
        redirect: 'error',
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      if (allowMissing && response.status === 404) return null;
      if (!response.ok) {
        const messages: Record<number, string> = {
          401: 'GitHub authentication failed. Replace the expired or invalid token.',
          403: 'GitHub denied access. Check Contents read/write permission, repository access, branch rules, and rate limits.',
          404: 'GitHub repository or branch was not found. Check the name and the token’s selected repositories.',
          409: 'GitHub reported a conflict. Ensure the repository has an initial commit, then retry.',
          422: 'GitHub rejected the update. Check branch protections and try again.',
          429: 'GitHub is rate limiting requests. Retry later.',
        };
        throw new GitHubError(
          messages[response.status] ??
            'GitHub is temporarily unavailable. Your local progress is saved; retry later.',
          response.status,
        );
      }
      try {
        return await response.json();
      } catch {
        throw new GitHubError('GitHub returned an unreadable response. Retry later.');
      }
    } catch (error) {
      if (error instanceof GitHubError) throw error;
      throw new GitHubError(
        controller.signal.aborted
          ? 'GitHub request timed out. Your local progress is saved; retry later.'
          : 'Could not reach GitHub. Check your connection and retry. Your local progress is saved.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async head(root: string, ref: string, token: string): Promise<string> {
    try {
      const response = object(await this.request(`${root}/git/ref/${ref}`, token));
      const target = object(response.object);
      if (target.type !== 'commit')
        throw new GitHubError('The selected GitHub branch does not point to a commit.');
      return sha(target.sha);
    } catch (error) {
      if (error instanceof GitHubError && (error.status === 404 || error.status === 409)) {
        throw new GitHubError(
          'The selected branch needs an initial commit. Create the repository with a README, verify the branch name, and retry.',
          error.status,
        );
      }
      throw error;
    }
  }

  /** Read-only checks. Final write permission is enforced by GitHub when syncing. */
  async validate(settings: GitHubSettings): Promise<void> {
    const { root, ref } = config(settings);
    const token = await this.token();
    await this.request('/user', token);
    const repository = object(await this.request(root, token));
    if (repository.archived || repository.disabled)
      throw new GitHubError(
        'This repository is archived or disabled. Choose a writable repository.',
      );
    if (repository.permissions && object(repository.permissions).push === false)
      throw new GitHubError('You do not have write access to this repository.');
    await this.head(root, ref, token);
  }

  async sync(
    attempt: Attempt,
    problem: CurriculumProblem,
    state: AppState,
    problems: CurriculumProblem[],
  ): Promise<{ commitUrl: string }> {
    if (!['server-verified', 'user-confirmed'].includes(attempt.codeProvenance ?? ''))
      throw new GitHubError('Confirm the exact accepted source and language before syncing.');
    if (
      attempt.status !== 'completed' ||
      !attempt.completedAt ||
      !Number.isFinite(new Date(attempt.completedAt).getTime()) ||
      !attempt.confidence ||
      !['independent', 'assisted', 'relearn'].includes(attempt.confidence) ||
      !attempt.code?.trim() ||
      !attempt.language ||
      attempt.problemId !== problem.id
    ) {
      throw new GitHubError(
        'Only a completed problem with explicit confidence, source code, and language can be synced.',
      );
    }
    if (!state.settings.github.enabled)
      throw new GitHubError('Enable GitHub integration in Settings before syncing.');
    const { repository, root, ref } = config(state.settings.github);
    const receipt = receiptPath(attempt.id);
    const token = await this.token();
    const path = solutionPath(problem, attempt.language);
    for (let retry = 0; retry < 3; retry += 1) {
      const parent = await this.head(root, ref, token);
      const receiptRaw = await this.request(
        `${root}/contents/${receipt}?ref=${parent}`,
        token,
        'GET',
        undefined,
        true,
      );
      if (receiptRaw !== null) {
        let saved: JsonRecord;
        try {
          saved = object(JSON.parse(fileContent(receiptRaw).content));
        } catch {
          throw new GitHubError(
            'The existing DSACommit receipt is invalid. Restore it before retrying; no files were changed.',
          );
        }
        if (
          saved.schemaVersion !== 1 ||
          saved.attemptId !== attempt.id ||
          saved.problemId !== problem.id ||
          saved.curriculumId !== attempt.curriculumId
        ) {
          throw new GitHubError(
            'A conflicting DSACommit receipt already exists. No files were changed.',
          );
        }
        // The exact commit may predate HEAD; this link still proves the atomic receipt is present.
        return { commitUrl: `https://github.com/${repository}/commit/${parent}` };
      }
      const base = object(await this.request(`${root}/git/commits/${parent}`, token));
      const baseTree = sha(object(base.tree).sha);
      const entries: TreeEntry[] = [
        {
          path,
          type: 'blob',
          mode: attempt.code.startsWith('#!') ? '100755' : '100644',
          content: solutionContent(attempt, problem, state.settings.github.includeMetadata),
        },
        {
          path: receipt,
          type: 'blob',
          mode: '100644',
          content: `${JSON.stringify(
            {
              schemaVersion: 1,
              attemptId: attempt.id,
              problemId: problem.id,
              curriculumId: attempt.curriculumId,
              completedAt: attempt.completedAt,
              solutionPath: path,
              codeProvenance: attempt.codeProvenance,
              submissionId: attempt.verifiedSubmissionId,
              timeComplexity: attempt.timeComplexity,
              spaceComplexity: attempt.spaceComplexity,
              complexityAnalysis: attempt.complexityAnalysis,
              learning: attempt.learning,
            },
            null,
            2,
          )}\n`,
        },
      ];
      if (state.settings.github.updateReadme) {
        const raw = await this.request(
          `${root}/readme?ref=${parent}`,
          token,
          'GET',
          undefined,
          true,
        );
        const existing = raw === null ? { path: 'README.md', content: '' } : fileContent(raw);
        if (
          !/^(?:[A-Za-z0-9_.-]+\/)*readme(?:\.md|\.markdown)?$/i.test(existing.path) ||
          existing.path.split('/').some((part) => part === '.' || part === '..')
        ) {
          throw new GitHubError(
            'Your existing README is not a supported Markdown file. Disable README updates to sync the solution.',
          );
        }
        entries.push({
          path: existing.path,
          type: 'blob',
          mode: '100644',
          content: updateReadme(
            existing.content,
            progressReadmeSection(state, problems, new Date(attempt.completedAt)),
          ),
        });
      }
      const tree = object(
        await this.request(`${root}/git/trees`, token, 'POST', {
          base_tree: baseTree,
          tree: entries,
        }),
      );
      const commit = object(
        await this.request(`${root}/git/commits`, token, 'POST', {
          message: commitMessage(attempt, problem),
          tree: sha(tree.sha),
          parents: [parent],
        }),
      );
      const commitSha = sha(commit.sha);
      try {
        await this.request(`${root}/git/refs/${ref}`, token, 'PATCH', {
          sha: commitSha,
          force: false,
        });
        return { commitUrl: `https://github.com/${repository}/commit/${commitSha}` };
      } catch (error) {
        if (!(error instanceof GitHubError) || ![409, 422].includes(error.status ?? 0)) throw error;
        // Re-read HEAD, receipt and README; preserve concurrent commits rather than forcing the branch.
        if (retry === 2)
          throw new GitHubError(
            'GitHub could not advance the branch after three tries. Check branch protections or retry after other pushes finish.',
          );
      }
    }
    throw new GitHubError('GitHub sync did not complete. Retry later.');
  }
}
