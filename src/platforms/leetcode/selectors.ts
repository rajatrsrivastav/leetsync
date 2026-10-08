/**
 * LeetCode's DOM is not a supported API. Keep all layout assumptions here.
 * Prefer semantic attributes; never search the whole document for "Accepted".
 * Alternative attributes are conservative fallbacks, not a claim that all are
 * present in the current authenticated LeetCode application.
 */
export const selectors = {
  submit:
    '[data-e2e-locator="console-submit-button"], [data-cy="submit-code-btn"], button[aria-label="Submit"]',
  result:
    '[data-e2e-locator="submission-result"], [data-testid="submission-result"], [data-cy="submission-result"]',
  resultContainer:
    '[data-e2e-locator="submission-result-container"], [data-testid="submission-detail"], [data-submission-id], [data-cy="submission-detail"]',
  submissionCode:
    '[data-e2e-locator="submission-code"] pre, pre[data-e2e-locator="submission-code"], [data-testid="submission-code"] pre, pre[data-testid="submission-code"], pre[data-submission-code]',
  fullCodeTextarea:
    'textarea[aria-label="Code editor"], textarea[name="code"], textarea[data-testid="code-editor"]',
  editor:
    '.monaco-editor, .CodeMirror, [data-e2e-locator="code-editor"], [data-testid="code-editor"], textarea[aria-label="Code editor"], textarea[name="code"]',
  virtualEditor: '.monaco-editor, .CodeMirror, .cm-editor, .view-lines, [data-virtualized="true"]',
  language:
    '[data-e2e-locator="language-selector"], [data-cy="lang-select"], [data-testid="language-selector"], button[aria-label="Select language"]',
  title:
    '[data-cy="question-title"], [data-e2e-locator="question-title"], [data-testid="question-title"]',
  difficulty:
    '[data-cy="question-difficulty"], [data-e2e-locator="question-difficulty"], [data-testid="question-difficulty"]',
} as const;

export function isVisible(element: Element): boolean {
  if (element.closest('[hidden], [aria-hidden="true"]')) return false;
  const view = element.ownerDocument.defaultView;
  // getClientRects is deliberately avoided: it is empty in DOM fixtures and
  // can be empty briefly while a newly inserted real result is being laid out.
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = view?.getComputedStyle(node);
    if (style?.display === 'none' || style?.visibility === 'hidden') return false;
  }
  return true;
}

export function problemSlug(
  location: Pick<Location, 'hostname' | 'pathname' | 'protocol'>,
): string | null {
  if (location.protocol !== 'https:' || !/^(www\.)?leetcode\.com$/.test(location.hostname))
    return null;
  return /^\/problems\/([a-z0-9-]+)(?:\/|$)/.exec(location.pathname)?.[1] ?? null;
}
