import { test, expect, chromium, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AppState } from '../../src/types';
import { emptyState } from '../../src/services/StorageService';
import { createBackup } from '../../src/services/BackupService';
import { applyPreparationAction, defaultPreparation } from '../../src/features/preparation/model';
import { preparationLessons } from '../../src/features/preparation/catalog';
import { roadmapTopics } from '../../src/features/preparation/roadmap/topics';

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

test('daily roadmap assigns, records, resumes drafts, keeps old study, and survives restart', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'dsacommit-roadmap-'));
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
    const first = roadmapTopics[0]!;
    // Today: the DSA queue plus the first roadmap topic, persisted by the worker.
    await expect(page.getByRole('heading', { name: /Continue Striver/ })).toBeVisible();
    const task = page.getByRole('region', { name: 'Extra task' });
    await expect(task.getByRole('heading', { name: first.title, exact: true })).toBeVisible();
    await expect(task.getByText(/EXTRA TASK · Operating Systems · Foundation/)).toBeVisible();
    const study = task.getByRole('link', { name: 'Open exact section' });
    await expect(study).toHaveAttribute('href', first.learn.url);
    await expect(study).toHaveAttribute('target', '_blank');
    await expect(study).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(task.getByRole('link', { name: 'Open practice' })).toHaveAttribute(
      'href',
      first.practice.url,
    );
    await expect(task.getByText(first.practice.prompt)).toBeVisible();
    await expect(page.locator('.roadmap-next')).toContainText(roadmapTopics[1]!.title);
    await expect
      .poll(async () => Object.keys((await stateOf(page)).preparation?.roadmap?.days ?? {}).length)
      .toBe(1);
    const baseline = await stateOf(page);
    // Import a previous-format quiz session; it must remain visible and untouched.
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
        reflection: 'Saved before roadmap redesign.',
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
    // Record a draft offline, then the final outcome.
    await context.setOffline(true);
    await task.getByLabel('Time spent (minutes)').fill('12');
    await task.getByLabel(/Notes/).fill('Half way through the chapter.');
    await expect(task.getByRole('button', { name: 'Mark completed' })).toBeDisabled();
    await task.getByRole('button', { name: 'Save draft' }).click();
    await expect(task.getByRole('status')).toHaveText('Draft saved locally.');
    await page.reload();
    const resumed = page.getByRole('region', { name: 'Extra task' });
    await expect(resumed.getByLabel('Time spent (minutes)')).toHaveValue('12');
    await resumed.getByLabel('Independent', { exact: false }).check();
    await resumed.getByLabel('Completed', { exact: true }).check();
    await resumed.getByLabel('Time spent (minutes)').fill('26');
    await resumed.getByRole('button', { name: 'Mark completed' }).click();
    await expect(resumed.getByRole('status')).toContainText('Completed');
    await expect(resumed.getByRole('status')).toContainText('26 min');
    await expect(page.locator('.roadmap-next')).toContainText(roadmapTopics[1]!.title);
    const saved = await stateOf(page);
    const assignment = Object.values(saved.preparation!.roadmap!.days)[0]!;
    expect(saved.preparation?.roadmap?.responses[assignment.id]).toMatchObject({
      status: 'completed',
      understanding: 'independent',
      practiceResult: 'completed',
      minutes: 26,
      notes: 'Half way through the chapter.',
    });
    expect(saved.preparation?.sessions).toEqual(old.preparation.sessions);
    expect(saved.preparation?.progress).toEqual(old.preparation.progress);
    expect(saved.attempts).toEqual(baseline.attempts);
    expect(saved.activities).toEqual(baseline.activities);
    expect(saved.progress).toEqual(baseline.progress);
    expect(saved.queues).toEqual(baseline.queues);
    expect(saved.syncJobs).toEqual(baseline.syncJobs);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/roadmap-today.png', fullPage: true });
    // Upcoming, progress, and library tabs.
    await page.getByRole('button', { name: 'Upcoming', exact: true }).click();
    await expect(page.locator('.roadmap-upcoming')).toHaveCount(10);
    await expect(page.locator('.roadmap-upcoming').first()).toContainText(roadmapTopics[1]!.title);
    await page.getByRole('button', { name: 'Progress', exact: true }).click();
    await expect(page.getByText(`1 / ${roadmapTopics.length}`)).toBeVisible();
    await expect(page.getByText('Half way through the chapter.')).toBeVisible();
    await page.getByText('Previous study history (1 sessions)', { exact: true }).click();
    await expect(page.getByText(/Saved before roadmap redesign/)).toBeVisible();
    await expect(page.locator('.prep-quiz')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/roadmap-progress.png', fullPage: true });
    await page.getByRole('button', { name: 'Resource Library', exact: true }).click();
    await expect(page.locator('.roadmap-topic')).toHaveCount(8);
    await page.getByRole('button', { name: 'Bookmark ' + roadmapTopics[8]!.title }).click();
    await page.getByRole('button', { name: 'Bookmarked', exact: true }).first().click();
    await expect(page.locator('.roadmap-topic')).toHaveCount(1);
    await expect(page.locator('.tracking-resource')).toHaveCount(10);
    const card = page.getByRole('article', { name: 'Core CS Interview Prep — 500 questions' });
    await card.getByRole('button', { name: 'Mark Progress', exact: true }).click();
    await card.getByLabel('Topic studied', { exact: true }).fill('Process scheduling');
    await card.getByLabel('Study minutes (optional)').fill('25');
    await card.getByRole('button', { name: 'Save progress', exact: true }).click();
    await expect(card.getByRole('status')).toHaveText('Progress saved locally.');
    await page.screenshot({ path: 'test-results/roadmap-library.png', fullPage: true });
    const before = await stateOf(page);
    expect(before.preparation?.roadmap?.bookmarks).toEqual({
      [roadmapTopics[8]!.id]: expect.any(String),
    });
    await context.close();
    context = await launch();
    const restored = await context.newPage();
    await restored.goto(`chrome-extension://${id}/dashboard.html`);
    await expect(
      restored.getByRole('region', { name: 'Extra task' }).getByRole('status'),
    ).toContainText('Completed');
    const after = await stateOf(restored);
    expect(after.preparation).toEqual(before.preparation);
    await restored.getByRole('button', { name: 'Settings', exact: true }).click();
    const download = restored.waitForEvent('download');
    await restored.getByRole('button', { name: 'Export backup', exact: true }).click();
    const exported = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
    expect(exported.state.preparation).toEqual(before.preparation);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
