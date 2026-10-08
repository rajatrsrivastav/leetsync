import type { CodeSnapshot } from '../../types';
import { isVisible, selectors } from './selectors';

export const MAX_CODE_LENGTH = 200_000;

export function validCode(code: string | null | undefined): code is string {
  return typeof code === 'string' && code.trim().length > 0 && code.length <= MAX_CODE_LENGTH;
}

export function readLanguage(document: Document): string {
  const language = Array.from(document.querySelectorAll(selectors.language)).find(isVisible);
  if (!language) return 'unknown';
  const value =
    language.tagName === 'SELECT'
      ? (language as HTMLSelectElement).selectedOptions[0]?.textContent
      : (language.getAttribute('data-language') ?? language.textContent);
  return value?.trim().replace(/\s+/g, ' ').slice(0, 80) || 'unknown';
}

/** Monaco's hidden input textarea and rendered view-lines contain partial code. */
export function captureEditorCode(document: Document): CodeSnapshot | null {
  for (const element of document.querySelectorAll<HTMLTextAreaElement>(
    selectors.fullCodeTextarea,
  )) {
    if (
      element.closest(selectors.virtualEditor) ||
      !isVisible(element) ||
      element.disabled ||
      element.readOnly
    )
      continue;
    if (validCode(element.value))
      return { code: element.value, language: readLanguage(document), source: 'editor' };
  }
  return null;
}

/** Only a full, nonvirtualized, explicitly labelled submission source block. */
export function captureSubmissionCode(document: Document, scope: ParentNode): CodeSnapshot | null {
  for (const element of scope.querySelectorAll<HTMLElement>(selectors.submissionCode)) {
    if (
      !isVisible(element) ||
      element.closest(selectors.virtualEditor) ||
      element.querySelector(selectors.virtualEditor)
    )
      continue;
    if (
      element.matches('[aria-expanded="false"], [data-truncated="true"]') ||
      element.closest('[data-truncated="true"]')
    )
      continue;
    const code = element.textContent;
    if (validCode(code))
      return {
        code,
        language: element.getAttribute('data-language') || readLanguage(document),
        source: 'submission',
      };
  }
  return null;
}
