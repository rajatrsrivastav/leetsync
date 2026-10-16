import { test, expect, chromium, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AppState } from '../../src/types';
import { emptyState } from '../../src/services/StorageService';
import { createBackup } from '../../src/services/BackupService';
import { applyPreparationAction, defaultPreparation } from '../../src/features/preparation/model';
import { preparationLessons } from '../../src/features/preparation/catalog';

type Api = {
  runtime: { sendMessage: (message: unknown) => Promise<{ ok: boolean; state: AppState }> };
};
const stateOf = (page: Page) =>
  page.evaluate(
    async () =>
      (
        await (globalThis as unknown as { chrome: Api }).chrome.runtime.sendMessage({
          channel: 'dsacommit',
          command: { type: 'getState' },
        })
      ).state,
  );

test('tracking dashboard preserves old study, opens resources, records explicit progress and survives restart', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'dsacommit-tracking-'));
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
  context.setDefaultTimeout(15000);
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/dashboard.html`);
    await page.getByRole('button', { name: 'Start Journey' }).click();
    await expect(
      page.getByRole('heading', { name: 'Preparation progress', exact: true }),
    ).toBeVisible();
    const baseline = await stateOf(page);
    // Import a real previous-format quiz session via the packaged backup interface.
    const old = emptyState();
    old.preparation = defaultPreparation();
    const then = new Date(Date.now() - 86_400_000);
    const actions = [
      { type: 'prepStart', lessonId: 'prep-apt-percent', sessionId: 'previous-quiz' },
      { type: 'prepAnswer', sessionId: 'previous-quiz', questionId: 'percent-1', answer: 1 },
      { type: 'prepAnswer', sessionId: 'previous-quiz', questionId: 'percent-2', answer: 2 },
      { type: 'prepAnswer', sessionId: 'previous-quiz', questionId: 'percent-3', answer: 2 },
      {
        type: 'prepComplete',
        sessionId: 'previous-quiz',
        confidence: 'independent',
        reflection: 'Saved before tracking redesign.',
      },
    ] as const;
    for (const action of actions)
      applyPreparationAction(old.preparation, action, preparationLessons, [], then);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Import a DSACommit backup').setInputFiles({
      name: 'old.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(createBackup(old))),
    });
    await page.getByRole('button', { name: 'Merge backup', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Backup merged successfully');
    await page.getByRole('button', { name: 'Campus preparation', exact: true }).click();
    await page.getByText('Previous study history (1 sessions)', { exact: true }).click();
    await expect(page.getByText(/Saved before tracking redesign/)).toBeVisible();
    await expect(page.locator('.prep-quiz')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start study session' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Resources', exact: true }).click();
    await expect(page.locator('.tracking-resource')).toHaveCount(9);
    const card = page.getByRole('article', { name: 'Core CS interview fundamentals' });
    const link = card.getByRole('link', { name: 'Open Resource', exact: true });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await context.route('https://github.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>External resource fixture</h1>' }),
    );
    const popupPromise = context.waitForEvent('page');
    await link.click();
    const external = await popupPromise;
    await external.waitForURL('https://github.com/aashishbharti04/cs-fundamentals-for-interviews');
    await external.close();
    await expect
      .poll(
        async () =>
          !!(await stateOf(page)).preparation?.resourceTracking?.resources['core-cs']
            ?.lastVisitedAt,
      )
      .toBe(true);
    expect((await stateOf(page)).preparation?.resourceTracking?.entries).toEqual({});
    await card.getByRole('button', { name: 'Bookmark Core CS interview fundamentals' }).click();
    await expect(
      card.getByRole('button', { name: 'Bookmark Core CS interview fundamentals' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await context.setOffline(true);
    await card.getByRole('button', { name: 'Mark Progress', exact: true }).click();
    await card.getByLabel('Topic studied', { exact: true }).fill('Process scheduling');
    await card.getByLabel('Study minutes (optional)').fill('25');
    await card.getByRole('button', { name: 'Save progress', exact: true }).click();
    await expect(card.getByRole('status')).toHaveText('Progress saved locally.');
    await expect(card.getByText(/0 topics completed/)).toBeVisible();
    await card.getByRole('button', { name: 'Mark Progress', exact: true }).click();
    await card.getByLabel('I completed this topic').check();
    await card.getByLabel('Study minutes (optional)').fill('5');
    await card.getByRole('button', { name: 'Save progress', exact: true }).click();
    await expect(card.getByText(/1 topics completed/)).toBeVisible();
    const saved = await stateOf(page);
    expect(Object.keys(saved.preparation!.resourceTracking!.entries)).toHaveLength(2);
    expect(saved.preparation?.sessions).toEqual(old.preparation.sessions);
    expect(saved.preparation?.progress).toEqual(old.preparation.progress);
    expect(saved.attempts).toEqual(baseline.attempts);
    expect(saved.activities).toEqual(baseline.activities);
    expect(saved.progress).toEqual(baseline.progress);
    expect(saved.syncJobs).toEqual(baseline.syncJobs);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/tracking-resources.png', fullPage: true });
    await page.getByRole('button', { name: 'Progress', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Process scheduling', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Last 30 days' }).click();
    await expect(page.locator('.tracking-activity > div')).toHaveCount(30);
    await page.screenshot({ path: 'test-results/tracking-progress.png', fullPage: true });
    await context.close();
    context = await launch();
    const restored = await context.newPage();
    await restored.goto(`chrome-extension://${id}/dashboard.html`);
    await expect(
      restored.getByRole('heading', { name: 'Process scheduling', exact: true }),
    ).toBeVisible();
    const after = await stateOf(restored);
    expect(after.preparation).toEqual(saved.preparation);
    await restored.getByRole('button', { name: 'Settings', exact: true }).click();
    const download = restored.waitForEvent('download');
    await restored.getByRole('button', { name: 'Export backup', exact: true }).click();
    const exported = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
    expect(exported.state.preparation).toEqual(saved.preparation);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
