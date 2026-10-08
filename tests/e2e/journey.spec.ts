import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AppState } from '../../src/types';

type ChromeApi = {
  runtime: { sendMessage: (message: unknown) => Promise<{ ok: boolean; state: AppState }> };
};
const stateOf = (page: Page) =>
  page.evaluate(async () => {
    const api = (globalThis as unknown as { chrome: ChromeApi }).chrome;
    return (await api.runtime.sendMessage({ channel: 'dsacommit', command: { type: 'getState' } }))
      .state;
  });
async function fixture(context: BrowserContext) {
  await context.route('https://leetcode.com/**', (route) =>
    route.request().resourceType() !== 'document'
      ? route.fulfill({ contentType: 'application/javascript', body: '' })
      : route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><html><head><title>LeetCode test fixture</title></head><body><h1 data-cy="question-title">Practice problem</h1><p>This is an automated adapter fixture, not the live LeetCode website.</p><span data-testid="language-selector" data-language="python3">Python3</span><textarea aria-label="Code editor">class Solution:\n    pass</textarea><button aria-label="Submit">Submit</button><div data-submission-id=""><span data-testid="submission-result"></span></div><script>let n=0;document.querySelector('button').onclick=()=>{n++;const r=document.querySelector('[data-testid="submission-result"]');r.textContent='Judging';setTimeout(()=>{r.parentElement.dataset.submissionId=String((location.pathname.includes('majority-element')?100:200)+n);r.textContent=(location.pathname.includes('majority-element')&&n===1)?'Wrong Answer':'Accepted'},150)};</script></body></html>`,
        }),
  );
}

test('fresh install → two meaningful solves → browser restart', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'dsacommit-e2e-'));
  const extension = path.resolve('.output/chrome-mv3');
  const launch = () =>
    chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
    });
  let context = await launch();
  context.setDefaultTimeout(15_000);
  context.on('page', (page) => {
    page.on('pageerror', (error) => console.error('PAGE ERROR:', error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') console.error('PAGE CONSOLE:', message.text());
    });
  });
  try {
    await fixture(context);
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await expect(popup.getByRole('spinbutton')).toHaveValue('2');
    await popup.getByRole('button', { name: 'Start Journey' }).click();
    await expect(popup.getByRole('heading', { name: 'Majority Element-I' })).toBeVisible();
    const firstOpened = context.waitForEvent('page');
    await popup.getByRole('button', { name: 'Start Problem', exact: true }).click();
    const first = await firstOpened;
    await first.waitForURL('https://leetcode.com/problems/majority-element/');
    await first.goto('https://leetcode.com/problems/majority-element/');
    await first.getByRole('button', { name: 'Start Attempt', exact: true }).click();
    await expect(first.getByText('ACTIVE TIME', { exact: true })).toBeVisible();
    const before = await stateOf(popup);
    const attemptId = before.activeAttemptId!;
    await expect
      .poll(async () =>
        Number(
          await first
            .getByRole('status', { name: 'Active solve time' })
            .textContent()
            .then((v) => v?.split(':').at(-1)),
        ),
      )
      .toBeGreaterThan(0);
    await first.reload();
    await expect(first.getByText('ACTIVE TIME', { exact: true })).toBeVisible();
    expect((await stateOf(popup)).attempts[attemptId]?.status).toBe('active');
    await first.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(first.getByText('1 submissions', { exact: true })).toBeVisible();
    await first.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(first.getByText('How did this feel?')).toBeVisible();
    let saved = await stateOf(popup);
    expect(saved.attempts[attemptId]?.status).toBe('accepted');
    expect(saved.attempts[attemptId]?.submissionCount).toBe(2);
    expect(saved.attempts[attemptId]?.runningSince).toBeUndefined();
    await expect(
      first.getByRole('button', { name: 'Complete Problem', exact: true }),
    ).toBeDisabled();
    await first.getByLabel('Needed help').check();
    await first.getByLabel(/Hints used/).fill('1');
    await first.getByRole('button', { name: 'Complete Problem', exact: true }).click();
    await expect(first.getByRole('heading', { name: 'Problem complete.' })).toBeVisible();
    saved = await stateOf(popup);
    expect(saved.progress['striver180:majority-element-i']?.state).toBe('assisted');
    expect(saved.progress['striver180:majority-element-i']?.revisionDueAt).toBeTruthy();
    expect(Object.values(saved.activities)[0]?.problemIds).toHaveLength(1);
    // DOM replay cannot generate another completion.
    await first.locator('[data-testid="submission-result"]').evaluate((el) => {
      el.textContent = 'Accepted';
    });
    expect(Object.values((await stateOf(popup)).activities)[0]?.problemIds).toHaveLength(1);
    const secondOpened = context.waitForEvent('page');
    await first.getByRole('button', { name: 'Start Next Problem' }).click();
    const second = await secondOpened;
    await second.waitForURL('https://leetcode.com/problems/maximum-subarray/');
    await second.goto('https://leetcode.com/problems/maximum-subarray/');
    await second.getByRole('button', { name: 'Start Attempt', exact: true }).click();
    await expect(second.getByText('ACTIVE TIME', { exact: true })).toBeVisible();
    await second.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(second.getByText('How did this feel?')).toBeVisible();
    await second.getByLabel('Independent').check();
    await second.getByRole('button', { name: 'Complete Problem', exact: true }).click();
    await expect(second.getByText('Today’s target complete. Nicely done.')).toBeVisible();
    saved = await stateOf(popup);
    expect(Object.values(saved.activities)[0]?.problemIds).toHaveLength(2);
    expect(Object.values(saved.attempts).filter((a) => a.status === 'completed')).toHaveLength(2);
    const dashboard = await context.newPage();
    await dashboard.setViewportSize({ width: 1440, height: 1100 });
    await dashboard.goto(`chrome-extension://${id}/dashboard.html`);
    await expect(dashboard.getByRole('heading', { name: 'Consistency compounds.' })).toBeVisible();
    await dashboard.screenshot({ path: 'test-results/dashboard.png', fullPage: true });
    await context.close();
    context = await launch();
    await fixture(context);
    const restored = await context.newPage();
    await restored.goto(`chrome-extension://${id}/popup.html`);
    await expect(restored.getByText('A LITTLE BETTER, EVERY DAY')).toBeVisible();
    const after = await stateOf(restored);
    expect(after.attempts).toEqual(saved.attempts);
    expect(after.progress).toEqual(saved.progress);
    expect(after.activities).toEqual(saved.activities);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
