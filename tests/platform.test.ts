// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://leetcode.com/problems/two-sum/"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act as reactAct, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LeetCodeAdapter } from '../src/platforms/leetcode/LeetCodeAdapter';
import { normalizeVerdict } from '../src/platforms/leetcode/submissionObserver';
import { problemSlug } from '../src/platforms/leetcode/selectors';
import { CodeCaptureService } from '../src/services/CodeCaptureService';
import type { SubmissionResult } from '../src/types';
import { AttemptPanel } from '../src/components/AttemptPanel';
import { Reflection } from '../src/components/Reflection';
import { emptyState } from '../src/services/StorageService';
import { curriculum } from '../src/domain/curriculum';
import { completeAttempt, manualAccept, prepareAttempt, startAttempt } from '../src/domain/attempt';
import type { Command } from '../src/services/commands';

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
let stop: (() => void) | undefined;
let adapter: LeetCodeAdapter;
let received: SubmissionResult[];
let reactRoot: Root | undefined;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function result(text: string, id?: string) {
  let panel = document.querySelector<HTMLElement>('[data-testid="submission-detail"]');
  if (!panel) {
    panel = document.createElement('section');
    panel.dataset.testid = 'submission-detail';
    document.body.append(panel);
  }
  if (id) panel.dataset.submissionId = id;
  else panel.removeAttribute('data-submission-id');
  panel.innerHTML = '<span data-e2e-locator="submission-result"></span>';
  panel.querySelector('span')!.textContent = text;
  return panel;
}

function startObserver() {
  stop = adapter.observeSubmission((submission) => received.push(submission));
}
function submit() {
  document.querySelector<HTMLButtonElement>('#submit')!.click();
}

beforeEach(() => {
  window.history.replaceState({}, '', '/problems/two-sum/');
  document.body.innerHTML = `
    <a href="/problems/two-sum/">1. Two Sum</a>
    <span data-cy="question-difficulty">Easy</span>
    <button data-e2e-locator="language-selector">Python3</button>
    <button id="submit" data-e2e-locator="console-submit-button">Submit</button>
    <button id="run">Run</button>
    <textarea aria-label="Code editor">print("submitted")</textarea>
  `;
  adapter = new LeetCodeAdapter();
  received = [];
});

afterEach(async () => {
  stop?.();
  stop = undefined;
  if (reactRoot) await reactAct(() => reactRoot?.unmount());
  reactRoot = undefined;
  vi.restoreAllMocks();
});

describe('LeetCode submission boundary', () => {
  it('never treats existing history, unrelated Accepted text, or Run output as a submission', async () => {
    result('Accepted', '100');
    startObserver();
    document.body.insertAdjacentHTML('beforeend', '<article>Accepted</article>');
    document.querySelector<HTMLButtonElement>('#run')!.click();
    document.body.insertAdjacentHTML('beforeend', '<div data-testid="run-result">Accepted</div>');
    await settle();
    expect(received).toEqual([]);
  });

  it('ignores a stale Accepted result after Submit until the result actually changes', async () => {
    result('Accepted', '100');
    startObserver();
    submit();
    document.body.append(document.createElement('aside'));
    await settle();
    expect(received).toEqual([]);
    result('Judging...');
    await settle();
    result('Accepted', '101');
    await settle();
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      id: 'leetcode:submission:101',
      verdict: 'accepted',
      problemSlug: 'two-sum',
    });
  });

  it('emits wrong answer followed by Accepted as two submissions and ignores duplicate DOM mutations', async () => {
    startObserver();
    submit();
    result('Wrong Answer', '101');
    await settle();
    result('Wrong Answer', '101');
    await settle();
    submit();
    result('Pending');
    await settle();
    result('Accepted', '102');
    await settle();
    result('Accepted', '102');
    await settle();
    expect(received.map((entry) => entry.verdict)).toEqual(['wrong_answer', 'accepted']);
    expect(new Set(received.map((entry) => entry.id)).size).toBe(2);
  });

  it('allows repeated terminal verdicts only after a new judging transition or submission ID', async () => {
    startObserver();
    submit();
    result('Wrong Answer');
    await settle();
    submit();
    result('Pending');
    await settle();
    result('Wrong Answer');
    await settle();
    expect(received).toHaveLength(2);
    expect(received[0]!.id).not.toEqual(received[1]!.id);
    expect(received.every((entry) => entry.id.startsWith('leetcode:local:'))).toBe(true);
  });

  it('does not replay a previous result when the observer is recreated after reload', async () => {
    startObserver();
    submit();
    result('Accepted', '103');
    await settle();
    stop!();
    startObserver();
    document.body.append(document.createElement('aside'));
    await settle();
    expect(received).toHaveLength(1);
  });

  it('does not re-emit a real submission ID when a stale result is redisplayed after another Submit', async () => {
    startObserver();
    submit();
    result('Accepted', '103');
    await settle();
    submit();
    result('Pending');
    await settle();
    result('Accepted', '103');
    await settle();
    expect(received).toHaveLength(1);
    result('Accepted', '104');
    await settle();
    expect(received.map((item) => item.id)).toEqual([
      'leetcode:submission:103',
      'leetcode:submission:104',
    ]);
  });

  it('binds the session context when Submit is pressed, before the terminal callback', async () => {
    let session = 'original';
    let submittedSession: string | undefined;
    let capturedSession: string | undefined;
    adapter = new LeetCodeAdapter({
      onSubmissionStarted: () => {
        submittedSession = session;
      },
    });
    stop = adapter.observeSubmission(() => {
      capturedSession = submittedSession;
    });
    submit();
    session = 'replacement';
    result('Accepted', '300');
    await settle();
    expect(capturedSession).toBe('original');
  });

  it('uses a newly observed submission URL for a durable submission ID', async () => {
    startObserver();
    submit();
    window.history.replaceState({}, '', '/problems/two-sum/submissions/456/');
    result('Accepted');
    await settle();
    expect(received[0]?.id).toBe('leetcode:submission:456');
  });

  it('does not incorrectly label a fresh result with the previous submission URL', async () => {
    window.history.replaceState({}, '', '/problems/two-sum/submissions/456/');
    result('Wrong Answer');
    startObserver();
    submit();
    result('Pending');
    await settle();
    result('Accepted');
    await settle();
    expect(received[0]?.id).toMatch(/^leetcode:local:/);
  });

  it('remembers a stale submission URL even when its result was not rendered at Submit time', async () => {
    window.history.replaceState({}, '', '/problems/two-sum/submissions/456/');
    startObserver();
    submit();
    result('Accepted');
    await settle();
    expect(received[0]?.id).toMatch(/^leetcode:local:/);
  });

  it('observes keyboard submission inside an editor and ignores unrelated shortcuts', async () => {
    startObserver();
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    );
    result('Accepted', '200');
    await settle();
    expect(received).toEqual([]);
    document
      .querySelector('textarea')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
    result('Accepted', '201');
    await settle();
    expect(received).toHaveLength(1);
  });

  it('ignores disabled Submit controls', async () => {
    startObserver();
    document.querySelector('#submit')!.setAttribute('aria-disabled', 'true');
    submit();
    result('Accepted', '200');
    await settle();
    expect(received).toEqual([]);
  });

  it('invalidates an in-flight submission when navigating to another problem', async () => {
    startObserver();
    submit();
    window.history.replaceState({}, '', '/problems/three-sum/');
    result('Accepted', '200');
    await settle();
    expect(received).toEqual([]);
  });

  it('ignores hidden results and stops observing after cleanup', async () => {
    startObserver();
    submit();
    result('Accepted', '200').hidden = true;
    await settle();
    expect(received).toEqual([]);
    stop!();
    result('Accepted', '201').hidden = false;
    await settle();
    expect(received).toEqual([]);
  });

  it('abandons observation when the user explicitly opens submission history', async () => {
    startObserver();
    submit();
    const history = document.createElement('a');
    history.href = '/problems/two-sum/submissions/100/';
    history.addEventListener('click', (event) => event.preventDefault());
    document.body.append(history);
    history.click();
    result('Accepted', '100');
    await settle();
    expect(received).toEqual([]);
  });

  it('does not accept arbitrary text or a partial verdict match', () => {
    expect(normalizeVerdict('Accepted solutions')).toBeNull();
    expect(normalizeVerdict('Not Accepted')).toBeNull();
    expect(normalizeVerdict('Time Limit Exceeded')).toBe('tle');
    expect(normalizeVerdict('Memory Limit Exceeded')).toBe('memory_limit');
  });
});

describe('reliable code capture', () => {
  it('keeps the complete textarea snapshot from Submit, even if the editor is subsequently changed', async () => {
    startObserver();
    submit();
    document.querySelector('textarea')!.value = 'changed_after_submission()';
    result('Accepted', '200');
    await settle();
    expect(received[0]?.code).toBe('print("submitted")');
    expect(received[0]?.language).toBe('Python3');
  });

  it('never mistakes a virtualized Monaco editor or its hidden input for the complete program', async () => {
    document.querySelector('textarea')!.remove();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="monaco-editor"><textarea aria-label="Code editor">last typed character</textarea><div class="view-lines">visible lines only</div></div>',
    );
    expect(await adapter.getCurrentCode()).toBeNull();
    startObserver();
    submit();
    result('Accepted', '200');
    await settle();
    expect(received[0]?.code).toBeUndefined();
    expect(received[0]?.verdict).toBe('accepted');
  });

  it('captures an explicitly labelled nonvirtualized readonly submission block', async () => {
    document.querySelector('textarea')!.remove();
    startObserver();
    submit();
    const panel = result('Accepted', '200');
    panel.insertAdjacentHTML(
      'beforeend',
      '<pre data-testid="submission-code" data-language="Python3">def solve():\n    return 42\n</pre>',
    );
    await settle();
    expect(received[0]?.code).toBe('def solve():\n    return 42\n');
  });

  it('does not take unrelated or explicitly truncated code blocks as submitted source', async () => {
    document.querySelector('textarea')!.remove();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<pre data-testid="submission-code">old code elsewhere</pre>',
    );
    startObserver();
    submit();
    result('Accepted', '200').insertAdjacentHTML(
      'beforeend',
      '<pre data-testid="submission-code" data-truncated="true">partial code</pre>',
    );
    await settle();
    expect(received[0]?.code).toBeUndefined();
  });

  it('makes code capture failure nonfatal and supports manual source entry', async () => {
    vi.spyOn(adapter, 'getCurrentCode').mockRejectedValue(new Error('DOM changed'));
    const service = new CodeCaptureService(adapter);
    expect(await service.captureCurrent()).toBeNull();
    expect(service.captureAccepted({ id: '1', verdict: 'accepted', observedAt: 'now' })).toBeNull();
    expect(service.manual('print(42)', 'Python3')).toMatchObject({
      source: 'manual',
      code: 'print(42)',
    });
    expect(service.manual('   ', 'Python3')).toBeNull();
  });
});

describe('problem metadata', () => {
  it('reads the current problem without requiring presentation class names', async () => {
    expect(adapter.isSupportedPage()).toBe(true);
    expect(await adapter.getProblemMetadata()).toEqual({
      slug: 'two-sum',
      title: '1. Two Sum',
      difficulty: 'Easy',
      url: 'https://leetcode.com/problems/two-sum/',
    });
  });

  it('does not match similarly named domains or unsupported routes', () => {
    expect(
      problemSlug({
        hostname: 'leetcode.com.attacker.test',
        protocol: 'https:',
        pathname: '/problems/two-sum/',
      }),
    ).toBeNull();
    expect(
      problemSlug({ hostname: 'leetcode.com', protocol: 'https:', pathname: '/problemset/' }),
    ).toBeNull();
  });
});

describe('attempt and reflection UI contracts', () => {
  it('shows a fresh start after progress reset while retaining the completed attempt history', async () => {
    const state = emptyState();
    const problem = curriculum.getProblems()[0]!;
    const attempt = prepareAttempt(state, problem);
    manualAccept(state, attempt.id);
    completeAttempt(state, attempt.id, { confidence: 'assisted' });
    const send = vi.fn(async (_command: Command) => state);
    const container = document.createElement('div');
    document.body.append(container);
    reactRoot = createRoot(container);
    await reactAct(() =>
      reactRoot!.render(createElement(AttemptPanel, { state, problem, act: send, busy: false })),
    );
    expect(container.textContent).toContain('Problem complete.');

    state.progress[problem.id] = {
      problemId: problem.id,
      state: 'not_started',
      attemptIds: [attempt.id],
      successfulRevisions: 0,
    };
    await reactAct(() =>
      reactRoot!.render(createElement(AttemptPanel, { state, problem, act: send, busy: false })),
    );
    expect(container.textContent).not.toContain('Problem complete.');
    expect(container.querySelector('.attempt-primary')?.textContent).toContain('Start Attempt');
    expect(container.querySelector('output')?.textContent).toBe('00:00');
    expect(state.attempts[attempt.id]).toMatchObject({
      status: 'completed',
      confidence: 'assisted',
    });
    expect(state.progress[problem.id]?.attemptIds).toEqual([attempt.id]);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not start timing on mount and prepares then starts only on explicit user action', async () => {
    const state = emptyState();
    const problem = curriculum.getProblems()[0]!;
    const send = vi.fn(async (command: Command) => {
      if (command.type === 'prepare') prepareAttempt(state, problem);
      if (command.type === 'start') startAttempt(state, command.attemptId);
      return structuredClone(state);
    });
    const container = document.createElement('div');
    document.body.append(container);
    reactRoot = createRoot(container);
    await reactAct(() =>
      reactRoot!.render(createElement(AttemptPanel, { state, problem, act: send, busy: false })),
    );
    expect(send).not.toHaveBeenCalled();
    expect(container.textContent).toContain('00:00');
    await reactAct(async () => {
      container.querySelector<HTMLButtonElement>('.attempt-primary')!.click();
    });
    expect(send.mock.calls.map(([command]) => command.type)).toEqual(['prepare', 'start']);
    expect(Object.values(state.attempts)[0]?.status).toBe('active');
  });

  it('requires explicit confidence and allows local completion without captured code', async () => {
    const state = emptyState();
    const problem = curriculum.getProblems()[0]!;
    const attempt = prepareAttempt(state, problem);
    manualAccept(state, attempt.id);
    const send = vi.fn(async (_command: Command) => state);
    const container = document.createElement('div');
    document.body.append(container);
    reactRoot = createRoot(container);
    await reactAct(() =>
      reactRoot!.render(
        createElement(Reflection, { state, problem, attempt, act: send, busy: false }),
      ),
    );
    expect(container.querySelector('input[type="radio"]:checked')).toBeNull();
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(
      true,
    );
    expect(container.textContent).toContain('Full source was not available reliably');
    await reactAct(() =>
      container.querySelector<HTMLInputElement>('input[value="assisted"]')!.click(),
    );
    // A storage poll replaces objects, not the user's in-progress reflection.
    const polled = structuredClone(state);
    await reactAct(() =>
      reactRoot!.render(
        createElement(Reflection, {
          state: polled,
          problem,
          attempt: polled.attempts[attempt.id],
          act: send,
          busy: false,
        }),
      ),
    );
    expect(container.querySelector<HTMLInputElement>('input[value="assisted"]')?.checked).toBe(
      true,
    );
    await reactAct(async () => {
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(send).toHaveBeenCalledWith({
      type: 'complete',
      attemptId: attempt.id,
      reflection: {
        confidence: 'assisted',
        hintsUsed: 0,
        timeComplexity: '',
        spaceComplexity: '',
        notes: '',
      },
    });
  });
});
