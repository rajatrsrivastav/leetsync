import { browser } from 'wxt/browser';
import { verifySubmission } from './submissionVerification';
import type { AppState } from '../../types';
/** The MAIN-world bridge is untrusted. Only verified same-origin API source becomes committable code. */
export function installNetworkCapture() {
  let stopped = false,
    running = false;
  let chain = Promise.resolve();
  const activeSlugs = new Set<string>();
  const call = async (command: unknown) => {
    const r = await browser.runtime.sendMessage({ channel: 'dsacommit', command });
    if (!r?.ok) throw new Error(r?.error ?? 'Capture unavailable');
    return r.state as AppState;
  };
  const reconcile = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const state = await call({ type: 'getState' });
      const slug = /^\/problems\/([^/]+)/.exec(location.pathname)?.[1];
      for (const p of Object.values(state.pendingSubmissions ?? {})) {
        if (p.problemSlug !== slug || !['waiting', 'checking'].includes(p.status)) continue;
        activeSlugs.add(p.problemSlug);
        if (!p.submissionId) {
          if (Date.now() - Date.parse(p.submittedAt) > 60_000) {
            await call({
              type: 'captureRecovery',
              requestId: p.requestId,
              error: 'Submission ID was not received. Use the submitted-source recovery panel.',
            });
            activeSlugs.delete(p.problemSlug);
          }
          continue;
        }
        try {
          const result = await verifySubmission(p.submissionId, p.problemSlug, p.submittedAt);
          if (result) {
            await call({ type: 'resolveCapture', requestId: p.requestId, result });
            activeSlugs.delete(p.problemSlug);
          } else if (Date.now() - Date.parse(p.submittedAt) > 10 * 60_000) {
            await call({
              type: 'captureRecovery',
              requestId: p.requestId,
              error: 'Judging has not completed. Retry verification or recover manually.',
            });
            activeSlugs.delete(p.problemSlug);
          }
        } catch {
          await call({
            type: 'captureRecovery',
            requestId: p.requestId,
            error: 'Could not verify this submission. Retry from its problem page when online.',
          });
          activeSlugs.delete(p.problemSlug);
        }
      }
    } catch {
      /* Popup and manual recovery retain the saved request on failure. */
    } finally {
      running = false;
    }
  };
  const listener = (event: MessageEvent) => {
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      event.data?.channel !== 'dsacommit:submission:v2'
    )
      return;
    const d = event.data;
    if (typeof d.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(d.requestId)) return;
    if (
      d.kind === 'start' &&
      typeof d.slug === 'string' &&
      typeof d.code === 'string' &&
      d.code.length <= 200_000 &&
      typeof d.language === 'string'
    ) {
      activeSlugs.add(d.slug);
      chain = chain
        .then(() =>
          call({
            type: 'beginCapture',
            requestId: d.requestId,
            slug: d.slug,
            code: d.code,
            language: d.language,
          }),
        )
        .then(() => {})
        .catch(() => {
          activeSlugs.delete(d.slug);
        });
    } else if (d.kind === 'identified' && /^\d{1,20}$/.test(d.submissionId)) {
      chain = chain
        .then(() =>
          call({ type: 'identifyCapture', requestId: d.requestId, submissionId: d.submissionId }),
        )
        .then(() => reconcile())
        .catch(() => {});
    }
  };
  window.addEventListener('message', listener);
  const timer = setInterval(() => void reconcile(), 4000);
  void reconcile();
  return {
    hasPending: (slug: string) => activeSlugs.has(slug),
    stop: () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('message', listener);
    },
  };
}
