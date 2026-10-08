import type { CodingPlatformAdapter } from '../types';
import type { CodeSnapshot, Difficulty, ProblemMetadata, SubmissionResult } from '../../types';
import { captureEditorCode, captureSubmissionCode } from './codeCapture';
import { isVisible, problemSlug, selectors } from './selectors';
import { observeLeetCodeSubmissions } from './submissionObserver';

export type LeetCodeAdapterOptions = {
  document?: Document;
  window?: Window;
  debug?: boolean;
  /** Only lifecycle messages and verdicts are logged, never source or secrets. */
  logger?: (message: string) => void;
  /** Bind platform actions to the session that existed at Submit time. */
  onSubmissionStarted?: (problemSlug: string) => void;
};

export class LeetCodeAdapter implements CodingPlatformAdapter {
  private readonly document: Document;
  private readonly window: Window;
  private readonly log: (message: string) => void;
  private readonly onSubmissionStarted?: (problemSlug: string) => void;

  constructor(options: LeetCodeAdapterOptions = {}) {
    this.document = options.document ?? document;
    this.window = options.window ?? this.document.defaultView ?? window;
    this.log = options.debug
      ? (options.logger ?? ((message) => console.debug(`[DSACommit] ${message}`)))
      : () => {};
    this.onSubmissionStarted = options.onSubmissionStarted;
  }

  isSupportedPage(): boolean {
    return problemSlug(this.window.location) !== null;
  }

  async getProblemMetadata(): Promise<ProblemMetadata> {
    const slug = problemSlug(this.window.location);
    if (!slug) throw new Error('This is not a supported LeetCode problem page.');
    const titleElement = Array.from(this.document.querySelectorAll(selectors.title)).find(
      isVisible,
    );
    const titleLink = Array.from(this.document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
      (anchor) => {
        try {
          const path = new URL(anchor.href, this.window.location.href).pathname;
          return (
            path === `/problems/${slug}/` &&
            /^\d+\.\s/.test(anchor.textContent?.trim() ?? '') &&
            isVisible(anchor)
          );
        } catch {
          return false;
        }
      },
    );
    const title = (
      titleElement?.textContent ??
      titleLink?.textContent ??
      this.document.title.replace(/\s*[-–|]\s*LeetCode.*$/i, '')
    ).trim();
    const difficultyText = Array.from(this.document.querySelectorAll(selectors.difficulty))
      .find(isVisible)
      ?.textContent?.trim();
    const difficulty = ['Easy', 'Medium', 'Hard'].includes(difficultyText ?? '')
      ? (difficultyText as Difficulty)
      : undefined;
    return {
      slug,
      title: title || slug,
      url: `https://leetcode.com/problems/${slug}/`,
      difficulty,
    };
  }

  async getCurrentCode(): Promise<CodeSnapshot | null> {
    if (!this.isSupportedPage()) return null;
    const submissionPage = /\/submissions\/(?:detail\/)?\d+(?:\/|$)/.test(
      this.window.location.pathname,
    );
    return (
      (submissionPage ? captureSubmissionCode(this.document, this.document) : null) ??
      captureEditorCode(this.document)
    );
  }

  observeSubmission(callback: (submission: SubmissionResult) => void): () => void {
    return observeLeetCodeSubmissions(
      this.document,
      this.window,
      callback,
      this.log,
      this.onSubmissionStarted,
    );
  }
}
