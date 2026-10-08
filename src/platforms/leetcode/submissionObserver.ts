import type { CodeSnapshot, SubmissionResult } from '../../types';
import { captureEditorCode, captureSubmissionCode, readLanguage } from './codeCapture';
import { isVisible, problemSlug, selectors } from './selectors';

type Verdict = SubmissionResult['verdict'];
type ObservedResult = {
  verdict: Verdict | 'pending';
  id?: string;
  idFromResult: boolean;
  element: Element;
  scope: Element;
};
type PendingSubmission = {
  token: string;
  slug: string;
  startedAt: number;
  baseline: ObservedResult | null;
  baselineId?: string;
  knownIds: Set<string>;
  transitioned: boolean;
  code: CodeSnapshot | null;
  language: string;
};

const PENDING_TIMEOUT_MS = 5 * 60_000;
const verdicts: Record<string, Verdict | 'pending'> = {
  accepted: 'accepted',
  'wrong answer': 'wrong_answer',
  'time limit exceeded': 'tle',
  'runtime error': 'runtime_error',
  'compile error': 'compile_error',
  'compilation error': 'compile_error',
  'memory limit exceeded': 'memory_limit',
  'output limit exceeded': 'output_limit',
  'internal error': 'internal_error',
  'unknown error': 'internal_error',
  pending: 'pending',
  judging: 'pending',
  running: 'pending',
};

export function normalizeVerdict(text: string): Verdict | 'pending' | null {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.\u2026]+$/, '')
    .trim();
  return verdicts[normalized] ?? null;
}

function submissionIdFromUrl(url: string, baseUrl: string): string | undefined {
  try {
    const parsed = new URL(url, baseUrl);
    if (!/^(www\.)?leetcode\.com$/.test(parsed.hostname)) return undefined;
    return /\/submissions\/(?:detail\/)?(\d+)(?:\/|$)/.exec(parsed.pathname)?.[1];
  } catch {
    return undefined;
  }
}

function readResult(document: Document, window: Window): ObservedResult | null {
  for (const element of document.querySelectorAll(selectors.result)) {
    if (!isVisible(element)) continue;
    const verdict = normalizeVerdict(element.textContent ?? '');
    if (!verdict) continue;
    const scope = element.closest(selectors.resultContainer) ?? element.parentElement ?? element;
    const explicitId = scope.getAttribute('data-submission-id');
    const linkId = Array.from(scope.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .map((link) => submissionIdFromUrl(link.href, window.location.href))
      .find(Boolean);
    const resultId = explicitId && /^\d+$/.test(explicitId) ? explicitId : linkId;
    const id = resultId ?? submissionIdFromUrl(window.location.href, window.location.href);
    return { verdict, id, idFromResult: !!resultId, element, scope };
  }
  return null;
}

function submitButton(target: Element): Element | null {
  const explicit = target.closest(selectors.submit);
  if (explicit) return explicit;
  const button = target.closest('button');
  return button &&
    /^submit$/i.test((button.getAttribute('aria-label') ?? button.textContent ?? '').trim())
    ? button
    : null;
}

/**
 * Arms only after Submit (or Ctrl/Command+Enter inside the editor). A terminal
 * result must then change, clear/pending first, or carry a new submission ID.
 * Existing history and Run Code output do not create attempts. Reloading while
 * a submission is pending intentionally requires manual completion: replaying
 * an old Accepted page would be more harmful than missing one DOM event.
 */
export function observeLeetCodeSubmissions(
  document: Document,
  window: Window,
  callback: (submission: SubmissionResult) => void,
  log: (message: string) => void = () => {},
  onSubmissionStarted?: (problemSlug: string) => void,
): () => void {
  let pending: PendingSubmission | null = null;
  const emitted = new Set<string>();
  const realIds = new Set<string>();
  let stopped = false;

  const arm = () => {
    const slug = problemSlug(window.location);
    if (!slug) return;
    // A keyboard shortcut can also dispatch a click; that is one submission.
    if (pending && Date.now() - pending.startedAt < 300) return;
    const baseline = readResult(document, window);
    const baselineId =
      baseline?.id ?? submissionIdFromUrl(window.location.href, window.location.href);
    const knownIds = new Set(realIds);
    if (baselineId) knownIds.add(baselineId);
    for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href*="/submissions/"]')) {
      const id = submissionIdFromUrl(link.href, window.location.href);
      if (id) knownIds.add(id);
    }
    for (const element of document.querySelectorAll('[data-submission-id]')) {
      const id = element.getAttribute('data-submission-id');
      if (id && /^\d+$/.test(id)) knownIds.add(id);
    }
    pending = {
      token: window.crypto.randomUUID(),
      slug,
      startedAt: Date.now(),
      baseline,
      baselineId,
      knownIds,
      transitioned: false,
      code: captureEditorCode(document),
      language: readLanguage(document),
    };
    onSubmissionStarted?.(slug);
    log('Submission started; waiting for a new result.');
  };

  const inspect = () => {
    if (!pending || stopped) return;
    if (
      problemSlug(window.location) !== pending.slug ||
      Date.now() - pending.startedAt > PENDING_TIMEOUT_MS
    ) {
      pending = null;
      return;
    }
    const result = readResult(document, window);
    if (!result || result.verdict === 'pending') {
      pending.transitioned = true;
      return;
    }
    // A terminal block explicitly identifying an already visible/history
    // submission is still historical, even after the UI briefly said Pending.
    if (
      result.id &&
      pending.knownIds.has(result.id) &&
      (result.idFromResult || result.id !== pending.baselineId)
    )
      return;
    const hasNewId = !!result.id && result.id !== pending.baselineId;
    const hasChangedVerdict = !!pending.baseline && result.verdict !== pending.baseline.verdict;
    if (!pending.transitioned && !hasNewId && !hasChangedVerdict && pending.baseline) return;

    // An old submission URL may remain visible while a fresh one is judged.
    // Never use that stale ID to label a new submission.
    const id = hasNewId ? `leetcode:submission:${result.id}` : `leetcode:local:${pending.token}`;
    const captured =
      pending.code ?? (hasNewId ? captureSubmissionCode(document, result.scope) : null);
    const submission: SubmissionResult = {
      id,
      verdict: result.verdict,
      observedAt: new Date().toISOString(),
      problemSlug: pending.slug,
      language: captured?.language ?? pending.language,
      ...(result.verdict === 'accepted' && captured ? { code: captured.code } : {}),
    };
    pending = null;
    if (emitted.has(id)) return;
    emitted.add(id);
    if (hasNewId && result.id) realIds.add(result.id);
    log(`Submission result: ${submission.verdict}.`);
    callback(submission);
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof (document.defaultView?.Element ?? Element))) return;
    const button = submitButton(target);
    if (
      button &&
      !button.hasAttribute('disabled') &&
      button.getAttribute('aria-disabled') !== 'true'
    ) {
      arm();
    } else if (target.closest('a[href*="/submissions/"]')) {
      // Explicit browsing of submission history is not a newly judged result.
      pending = null;
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.repeat ||
      event.key !== 'Enter' ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      event.shiftKey
    )
      return;
    const target = event.target;
    if (
      target instanceof (document.defaultView?.Element ?? Element) &&
      target.closest(selectors.editor)
    )
      arm();
  };

  const Observer = document.defaultView?.MutationObserver ?? MutationObserver;
  const observer = new Observer(inspect);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-submission-id', 'hidden', 'aria-hidden'],
  });
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  return () => {
    stopped = true;
    pending = null;
    observer.disconnect();
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  };
}
