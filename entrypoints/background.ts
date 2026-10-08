import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { StorageService, TOKEN_KEY } from '../src/services/StorageService';
import { DailyQueueService } from '../src/services/DailyQueueService';
import { curriculum } from '../src/domain/curriculum/Striver180CurriculumProvider';
import {
  abandonAttempt,
  completeAttempt,
  manualAccept,
  pauseAttempt,
  prepareAttempt,
  recordSubmission,
  requireAttempt,
  startAttempt,
} from '../src/domain/attempt';
import type { Command } from '../src/services/commands';
import { localDate } from '../src/utils/date';
import type { Settings } from '../src/types';
import { GitHubService } from '../src/services/GitHubService';
import { GitHubSyncService } from '../src/services/GitHubSyncService';

const storage = new StorageService(browser.storage.local);
function validateSettings(s: Settings) {
  if (!s || !Number.isInteger(s.dailyGoal) || s.dailyGoal < 1 || s.dailyGoal > 20)
    throw new Error('Daily target must be between 1 and 20.');
  if (
    !['system', 'dark', 'light'].includes(s.theme) ||
    s.timerBehavior !== 'manual' ||
    typeof s.primaryLanguage !== 'string'
  )
    throw new Error('Invalid settings.');
  for (const key of ['onboardingComplete', 'showPattern', 'revisionScheduling', 'debug'] as const)
    if (typeof s[key] !== 'boolean') throw new Error('Invalid settings.');
  if (!s.github || typeof s.github.repository !== 'string' || typeof s.github.branch !== 'string')
    throw new Error('Invalid GitHub settings.');
  if (s.github.enabled && !/^[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+$/.test(s.github.repository))
    throw new Error('Repository must be owner/repository.');
  if (!s.github.branch.trim() || s.github.branch.length > 250)
    throw new Error('Enter a branch name.');
  for (const key of ['enabled', 'autoCommit', 'includeMetadata', 'updateReadme'] as const)
    if (typeof s.github[key] !== 'boolean') throw new Error('Invalid GitHub setting.');
  if (s.curriculumId !== curriculum.data.id || s.primaryLanguage.length > 80)
    throw new Error('Invalid curriculum or language.');
}
export default defineBackground(() => {
  // Tokens and user code are never readable via storage from a website's isolated content context.
  const secured = browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  const github = new GitHubService({
    getToken: async () => {
      const value = (await browser.storage.local.get(TOKEN_KEY))[TOKEN_KEY];
      return typeof value === 'string' ? value : null;
    },
  });
  const sync = new GitHubSyncService(storage, github, curriculum.getProblems(), () =>
    browser.permissions.contains({ origins: ['https://api.github.com/*'] }),
  );
  const drain = () => {
    void secured
      .then(() => sync.drain())
      .catch(() => {
        /* Persisted outbox will recover on the next alarm. */
      });
  };
  const installAlarm = () => browser.alarms.create('dsacommit-sync', { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'dsacommit-sync') drain();
  });
  browser.runtime.onStartup.addListener(() => {
    void installAlarm();
    drain();
  });
  browser.runtime.onInstalled.addListener(() => {
    void installAlarm();
    drain();
  });
  // Alarms can be cleared across browser sessions. Re-establish one on every worker boot.
  void installAlarm();
  drain();
  async function getState() {
    await secured;
    const state = await storage.read();
    if (!state.queues[localDate()])
      return storage.transaction((s) => {
        s.queues[localDate()] = DailyQueueService.generate(s, curriculum.getProblems());
        return s;
      });
    return state;
  }
  async function execute(command: Command, pageUrl?: string) {
    await secured;
    if (!command || typeof command.type !== 'string') throw new Error('Invalid request.');
    if (command.type === 'getState') return getState();
    if (command.type === 'openDashboard') {
      const url =
        browser.runtime.getURL('/dashboard.html') +
        (command.section ? '#' + command.section : '');
      await browser.tabs.create({ url });
      return getState();
    }
    if (pageUrl) {
      const allowed = [
        'prepare',
        'start',
        'pause',
        'hint',
        'editorial',
        'solution',
        'abandon',
        'manualAccept',
        'submission',
        'complete',
      ];
      if (!allowed.includes(command.type))
        throw new Error('Open extension settings to perform this action.');
      const pageSlug = new URL(pageUrl).pathname.split('/')[2];
      const state = await storage.read();
      const problemId =
        'attemptId' in command
          ? state.attempts[command.attemptId]?.problemId
          : 'problemId' in command
            ? command.problemId
            : undefined;
      const problem = problemId ? curriculum.getProblem(problemId) : undefined;
      // Explicit Next opens an allowlisted curriculum URL. Other actions must belong to this problem.
      if (!(command.type === 'prepare' && command.open) && (!problem || problem.slug !== pageSlug))
        throw new Error('This attempt belongs to a different problem.');
    }
    if (command.type === 'settings') {
      validateSettings(command.settings);
      if (command.token !== undefined) {
        if (typeof command.token !== 'string' || command.token.length > 1000)
          throw new Error('Invalid token.');
        if (command.token.trim())
          await browser.storage.local.set({ [TOKEN_KEY]: command.token.trim() });
      }
    }
    if (command.type === 'validateGithub') {
      if (!(await browser.permissions.contains({ origins: ['https://api.github.com/*'] })))
        throw new Error('Save GitHub configuration first to grant access.');
      await github.validate((await storage.read()).settings.github);
      return getState();
    }
    if (command.type === 'disconnectGithub') {
      await storage.transaction((s) => {
        s.settings.github.enabled = false;
      });
      await browser.storage.local.remove(TOKEN_KEY);
      await browser.permissions.remove({ origins: ['https://api.github.com/*'] });
      return getState();
    }
    const state = await storage.transaction((s) => {
      switch (command.type) {
        case 'prepare': {
          const problem = curriculum.getProblem(command.problemId);
          if (!problem) throw new Error('Unknown curriculum problem.');
          prepareAttempt(s, problem);
          break;
        }
        case 'start':
          startAttempt(s, command.attemptId);
          break;
        case 'pause':
          pauseAttempt(s, command.attemptId);
          break;
        case 'abandon':
          abandonAttempt(s, command.attemptId);
          break;
        case 'manualAccept':
          manualAccept(s, command.attemptId);
          break;
        case 'hint':
        case 'editorial':
        case 'solution': {
          const a = requireAttempt(s, command.attemptId);
          if (!['ready', 'active', 'paused', 'accepted'].includes(a.status))
            throw new Error('This attempt has already ended.');
          if (command.type === 'hint') a.hintsUsed = Math.min(999, a.hintsUsed + 1);
          else if (command.type === 'editorial') a.editorialViewed = true;
          else a.solutionViewed = true;
          break;
        }
        case 'submission': {
          const r = command.result;
          if (
            !r ||
            typeof r.id !== 'string' ||
            r.id.length > 200 ||
            ![
              'accepted',
              'wrong_answer',
              'tle',
              'runtime_error',
              'compile_error',
              'memory_limit',
              'output_limit',
              'internal_error',
              'unknown',
            ].includes(r.verdict)
          )
            throw new Error('Invalid submission.');
          const a = requireAttempt(s, command.attemptId),
            p = curriculum.getProblem(a.problemId);
          if (r.problemSlug && r.problemSlug !== p?.slug)
            throw new Error('Submission belongs to another problem.');
          if (r.code && (typeof r.code !== 'string' || r.code.length > 200_000))
            throw new Error('Code exceeds the capture limit.');
          recordSubmission(s, command.attemptId, r);
          break;
        }
        case 'complete':
          completeAttempt(s, command.attemptId, command.reflection);
          break;
        case 'settings':
          s.settings = command.settings;
          if (!s.activities[localDate()]) delete s.queues[localDate()];
          break;
        case 'retrySync': {
          const a = requireAttempt(s, command.attemptId);
          if (!s.settings.github.enabled) throw new Error('Enable GitHub in Settings first.');
          if (a.status !== 'completed' || !a.code?.trim() || !a.language)
            throw new Error('A completed attempt with source and language is required.');
          const previous = s.syncJobs[a.id];
          if (previous?.status !== 'synced' && previous?.status !== 'syncing')
            s.syncJobs[a.id] = {
              id: a.id,
              attemptId: a.id,
              status: 'pending',
              attempts: 0,
              updatedAt: new Date().toISOString(),
            };
          break;
        }
        case 'schedule': {
          const p = s.progress[command.problemId];
          if (!p?.firstSolvedAt)
            throw new Error('Complete the problem before scheduling a revision.');
          p.revisionDueAt = new Date().toISOString();
          delete s.queues[localDate()];
          break;
        }
        case 'resetProgress': {
          const p = s.progress[command.problemId];
          if (p) {
            for (const a of Object.values(s.attempts).filter((a) => a.problemId === p.problemId))
              abandonAttempt(s, a.id);
            s.progress[p.problemId] = {
              problemId: p.problemId,
              state: 'not_started',
              attemptIds: [...p.attemptIds],
              successfulRevisions: 0,
            };
          }
          delete s.queues[localDate()];
          break;
        }
        default:
          throw new Error('Unknown action.');
      }
      s.queues[localDate()] = DailyQueueService.generate(s, curriculum.getProblems());
      return s;
    });
    if (command.type === 'prepare' && command.open) {
      const problem = curriculum.getProblem(command.problemId)!;
      await browser.tabs.create({
        url: problem.problemUrl,
        active: problem.platform === 'leetcode',
      });
      if (problem.platform !== 'leetcode')
        await browser.tabs.create({
          url:
            browser.runtime.getURL('/dashboard.html') +
            '#problem/' +
            encodeURIComponent(problem.id),
        });
    }
    if (['complete', 'retrySync', 'settings'].includes(command.type)) drain();
    return state;
  }
  browser.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== browser.runtime.id || message?.channel !== 'dsacommit') return;
    const url = sender.url || '';
    const isContent = !url.startsWith(browser.runtime.getURL('/'));
    if (isContent && !/^https:\/\/leetcode\.com\/problems\//.test(url)) {
      respond({ ok: false, error: 'Unsupported page.' });
      return;
    }
    void execute(message.command, isContent ? url : undefined)
      .then((state) => respond({ ok: true, state }))
      .catch((error) =>
        respond({
          ok: false,
          error:
            error instanceof Error ? error.message : 'Action failed. Your saved progress is safe.',
        }),
      );
    return true;
  });
  browser.commands.onCommand.addListener(async (name) => {
    try {
      const state = await getState();
      if (name === 'next-problem') {
        const next = state.queues[localDate()]?.items.find(
          (i) => !state.activities[localDate()]?.problemIds.includes(i.problemId),
        );
        if (next) await execute({ type: 'prepare', problemId: next.problemId, open: true });
      } else if (state.activeAttemptId) {
        const a = state.attempts[state.activeAttemptId]!;
        await execute({
          type: name === 'add-hint' ? 'hint' : a.status === 'active' ? 'pause' : 'start',
          attemptId: a.id,
        });
      }
    } catch {
      /* Keyboard actions have no error surface; the popup retains the recoverable state. */
    }
  });
});
