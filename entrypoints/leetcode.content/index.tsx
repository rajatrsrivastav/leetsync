import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronDown, ChevronUp, Clock3, Code2 } from 'lucide-react';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { installNetworkCapture } from '../../src/platforms/leetcode/networkCapture';
import { LeetCodeAdapter } from '../../src/platforms/leetcode/LeetCodeAdapter';
import { useAppState } from '../../src/hooks/useAppState';
import { curriculum } from '../../src/domain/curriculum';
import { AttemptPanel, displayTime, findProblemAttempt } from '../../src/components/AttemptPanel';
import { elapsedSeconds } from '../../src/domain/attempt';
import { openDashboard } from '../../src/services/client';
import type { AppState } from '../../src/types';
import '../../src/components/attempt.css';

function TrackedProblemWidget({ network }: { network: ReturnType<typeof installNetworkCapture> }) {
  const { state, error, busy, act } = useAppState();
  const [slug, setSlug] = useState<string>();
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const latest = useRef({ state, act, slug });
  latest.current = { state, act, slug };
  const selected = useRef<{ slug: string; problemId: string } | undefined>(undefined);
  const submittedAttempt = useRef<{ id: string; slug: string } | undefined>(undefined);
  const adapter = useMemo(
    () =>
      new LeetCodeAdapter({
        debug: true,
        logger: (message) => {
          if (latest.current.state?.settings.debug) console.debug(`[DSACommit] ${message}`);
        },
        onSubmissionStarted: (problemSlug) => {
          const state = latest.current.state;
          const problem = state
            ? resolveProblem(state, problemSlug, selected.current?.problemId)
            : undefined;
          const attempt = state && problem ? findProblemAttempt(state, problem.id) : undefined;
          submittedAttempt.current =
            attempt && ['active', 'paused'].includes(attempt.status)
              ? { id: attempt.id, slug: problemSlug }
              : undefined;
        },
      }),
    [],
  );

  useEffect(() => {
    let lastUrl = '';
    let disposed = false;
    const inspectRoute = async () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      const inspectedUrl = lastUrl;
      const metadata = adapter.isSupportedPage()
        ? await adapter.getProblemMetadata().catch(() => null)
        : null;
      if (!disposed && location.href === inspectedUrl) setSlug(metadata?.slug);
    };
    void inspectRoute();
    const interval = setInterval(() => void inspectRoute(), 750);
    window.addEventListener('popstate', inspectRoute);
    return () => {
      disposed = true;
      clearInterval(interval);
      window.removeEventListener('popstate', inspectRoute);
    };
  }, [adapter]);

  useEffect(() => {
    let disposed = false;
    let delivery = Promise.resolve();
    // This observer remains attached across state polls and timer renders.
    const stop = adapter.observeSubmission((submission) => {
      if (submission.problemSlug && network.hasPending(submission.problemSlug)) return;
      // DOM evidence can stop the timer, but editor snapshots are never trusted as accepted source.
      delete submission.code;
      delete submission.language;
      const current = latest.current;
      const submitted = submittedAttempt.current;
      submittedAttempt.current = undefined;
      if (
        !current.state ||
        !submitted ||
        !submission.problemSlug ||
        submission.problemSlug !== submitted.slug
      )
        return;
      const attempt = current.state.attempts[submitted.id];
      if (!attempt || !['active', 'paused'].includes(attempt.status)) return;
      const attemptId = attempt.id;
      delivery = delivery
        .then(async () => {
          if (disposed) return;
          const liveAttempt = latest.current.state?.attempts[attemptId];
          if (!liveAttempt || !['active', 'paused'].includes(liveAttempt.status)) return;
          const updated = await latest.current.act({
            type: 'submission',
            attemptId,
            result: submission,
          });
          if (updated) latest.current.state = updated;
        })
        .catch(() => {
          /* act surfaces recoverable failures in the widget. */
        });
    });
    return () => {
      disposed = true;
      stop();
    };
  }, [adapter]);

  const problem = slug
    ? resolveProblem(
        state,
        slug,
        selected.current?.slug === slug ? selected.current.problemId : undefined,
      )
    : undefined;
  if (problem && slug) selected.current = { slug, problemId: problem.id };
  const attempt = state && problem ? findProblemAttempt(state, problem.id) : undefined;
  useEffect(() => {
    if (attempt?.status === 'accepted') setCollapsed(false);
  }, [attempt?.status]);
  if (!problem) return null;
  const expanded = !collapsed;
  return (
    <aside
      className={`dsacommit-surface dsacommit-widget${collapsed ? ' is-collapsed' : ''}`}
      data-theme={state?.settings.theme ?? 'system'}
      aria-label="DSACommit practice companion"
    >
      <header
        className="attempt-widget-header"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.attempt-widget-dashboard-btn')) return;
          setCollapsed((prev) => !prev);
        }}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        title={collapsed ? 'Click to expand' : 'Click to collapse'}
      >
        <span className="attempt-widget-brand">
          <Code2 size={18} aria-hidden="true" />
          DSACommit
        </span>
        {collapsed && attempt && (
          <span className="attempt-widget-collapsed-pill">
            <Clock3 size={11} aria-hidden="true" />
            <span>{displayTime(elapsedSeconds(attempt, now))}</span>
            {attempt.status === 'paused' && (
              <span className="attempt-widget-collapsed-tag">Paused</span>
            )}
            {attempt.status === 'active' && (
              <span className="attempt-widget-collapsed-tag is-active">Active</span>
            )}
            {attempt.status === 'accepted' && (
              <span className="attempt-widget-collapsed-tag is-accepted">Reflect</span>
            )}
          </span>
        )}
        <button
          type="button"
          className="attempt-widget-dashboard-btn"
          onClick={(e) => {
            e.stopPropagation();
            void openDashboard();
          }}
        >
          Dashboard ↗
        </button>
        <button
          type="button"
          className="attempt-widget-toggle"
          aria-label={collapsed ? 'Expand practice widget' : 'Collapse practice widget'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </header>
      {error && (
        <div role="alert" className="attempt-widget-error">
          {error}
        </div>
      )}
      {expanded && (
        <div className="attempt-widget-body">
          {!state ? (
            <div className="attempt-widget-message" role="status">
              Loading your practice session…
            </div>
          ) : !state.settings.onboardingComplete ? (
            <div className="attempt-widget-message">
              <h2>Your daily two start here.</h2>
              <p>Choose your target and language to start tracking this problem.</p>
              <button
                type="button"
                className="attempt-primary"
                onClick={() => void openDashboard()}
              >
                Set up DSACommit
              </button>
            </div>
          ) : (
            <AttemptPanel state={state} problem={problem} act={act} busy={busy} compact />
          )}
        </div>
      )}
    </aside>
  );
}

function resolveProblem(state: AppState | undefined, slug: string, selectedProblemId?: string) {
  const active = state?.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
  const activeProblem = active ? curriculum.getProblem(active.problemId) : undefined;
  if (activeProblem?.slug === slug) return activeProblem;
  const selectedProblem = selectedProblemId ? curriculum.getProblem(selectedProblemId) : undefined;
  return selectedProblem?.slug === slug ? selectedProblem : curriculum.getBySlug(slug);
}

export default defineContentScript({
  matches: ['https://leetcode.com/problems/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_start',
  async main(ctx) {
    const network = installNetworkCapture();
    ctx.onInvalidated(() => network.stop());
    if (!document.body)
      await new Promise<void>((resolve) =>
        document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }),
      );
    const ui = await createShadowRootUi(ctx, {
      name: 'dsacommit-companion',
      position: 'inline',
      anchor: 'body',
      isolateEvents: true,
      onMount(container) {
        const root = createRoot(container);
        root.render(<TrackedProblemWidget network={network} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
    ctx.onInvalidated(() => ui.remove());
  },
});
