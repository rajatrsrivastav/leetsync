import { applyPreparationAction, defaultPreparation } from '../src/features/preparation/model';
import { preparationLessons } from '../src/features/preparation/catalog';
import { preparationDsaTasks } from '../src/features/preparation/integration';
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
import { mergeBackup, parseBackup } from '../src/services/BackupService';
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
        browser.runtime.getURL('/dashboard.html') + (command.section ? '#' + command.section : '');
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
        'beginCapture',
        'identifyCapture',
        'resolveCapture',
        'captureRecovery',
        'retryCapture',
        'recoverCode',
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
            : 'requestId' in command
              ? state.pendingSubmissions?.[command.requestId]?.attemptId
                ? state.attempts[state.pendingSubmissions[command.requestId]!.attemptId]?.problemId
                : undefined
              : undefined;
      const problem = problemId ? curriculum.getProblem(problemId) : undefined;
      // Explicit Next opens an allowlisted curriculum URL. Other actions must belong to this problem.
      if (
        command.type === 'beginCapture'
          ? command.slug !== pageSlug
          : !(command.type === 'prepare' && command.open) && (!problem || problem.slug !== pageSlug)
      )
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
    if (command.type === 'importBackup') parseBackup(command.text);
    const state = await storage.transaction((s) => {
      switch (command.type) {
        case 'prepRoadmapToday':
        case 'prepRoadmapRecord':
        case 'prepResourceVisit':
        case 'prepResourceBookmark':
        case 'prepResourceProgress':
        case 'prepProfile':
        case 'prepPlan':
        case 'prepStart':
        case 'prepPause':
        case 'prepResume':
        case 'prepAnswer':
        case 'prepComplete': {
          s.preparation ??= defaultPreparation();
          applyPreparationAction(
            s.preparation,
            command,
            preparationLessons,
            preparationDsaTasks(s),
          );
          break;
        }
        case 'beginCapture': {
          if (
            !/^[a-f0-9-]{36}$/.test(command.requestId) ||
            typeof command.code !== 'string' ||
            command.code.length > 200_000 ||
            typeof command.language !== 'string' ||
            command.language.length > 80
          )
            throw new Error('Invalid capture request.');
          const a = Object.values(s.attempts)
            .filter(
              (a) =>
                ['active', 'paused'].includes(a.status) &&
                curriculum.getProblem(a.problemId)?.slug === command.slug,
            )
            .sort(
              (a, b) =>
                Number(b.id === s.activeAttemptId) - Number(a.id === s.activeAttemptId) ||
                b.startedAt.localeCompare(a.startedAt),
            )[0];
          if (!a) throw new Error('Start an attempt before submitting.');
          s.pendingSubmissions ??= {};
          s.pendingSubmissions[command.requestId] ??= {
            requestId: command.requestId,
            attemptId: a.id,
            problemSlug: command.slug,
            submittedAt: new Date().toISOString(),
            requestCode: command.code,
            requestLanguage: command.language,
            status: 'waiting',
          };
          break;
        }
        case 'identifyCapture': {
          const p = s.pendingSubmissions?.[command.requestId];
          if (!p || !/^\d{1,20}$/.test(command.submissionId))
            throw new Error('Unknown captured submission.');
          if (p.submissionId && p.submissionId !== command.submissionId)
            throw new Error('Submission identity cannot change.');
          p.submissionId = command.submissionId;
          p.status = 'checking';
          break;
        }
        case 'resolveCapture': {
          const p = s.pendingSubmissions?.[command.requestId];
          if (
            !p ||
            !p.submissionId ||
            command.result.id !== `leetcode:submission:${p.submissionId}` ||
            command.result.problemSlug !== p.problemSlug
          )
            throw new Error('Submission mismatch.');
          const a = requireAttempt(s, p.attemptId);
          const result = command.result;
          if (
            result.code !== p.requestCode ||
            String(result.language).toLowerCase().replace(/\s/g, '').replace('c++', 'cpp') !==
              String(p.requestLanguage).toLowerCase().replace(/\s/g, '').replace('c++', 'cpp')
          ) {
            delete result.code;
            delete result.codeProvenance;
          }
          recordSubmission(s, a.id, result);
          if (
            result.verdict === 'accepted' &&
            ['accepted', 'completed'].includes(a.status) &&
            result.codeProvenance === 'server-verified' &&
            result.code &&
            result.language &&
            (!a.code || a.codeProvenance !== 'user-confirmed') &&
            !['syncing', 'synced'].includes(s.syncJobs[a.id]?.status ?? '')
          ) {
            a.code = result.code;
            a.language = result.language;
            a.codeProvenance = 'server-verified';
            a.verifiedSubmissionId = p.submissionId;
          }
          if (
            a.status === 'completed' &&
            a.codeProvenance === 'server-verified' &&
            s.settings.github.enabled &&
            s.settings.github.autoCommit
          )
            s.syncJobs[a.id] ??= {
              id: a.id,
              attemptId: a.id,
              status: 'pending',
              attempts: 0,
              updatedAt: new Date().toISOString(),
            };
          if (a.codeProvenance === 'server-verified') delete p.requestCode;
          p.status = 'resolved';
          delete p.lastError;
          break;
        }
        case 'captureRecovery': {
          const p = s.pendingSubmissions?.[command.requestId];
          if (p && p.status !== 'resolved') {
            p.status = 'recovery';
            p.lastError = command.error.slice(0, 300);
          }
          break;
        }
        case 'retryCapture': {
          const p = s.pendingSubmissions?.[command.requestId];
          if (!p?.submissionId)
            throw new Error('Submission ID unavailable. Recover the source manually.');
          p.status = 'checking';
          delete p.lastError;
          break;
        }
        case 'recoverCode': {
          const a = requireAttempt(s, command.attemptId);
          if (
            !['accepted', 'completed'].includes(a.status) ||
            !command.confirmed ||
            typeof command.code !== 'string' ||
            typeof command.language !== 'string' ||
            !command.code.trim() ||
            command.code.length > 200_000 ||
            !command.language.trim()
          )
            throw new Error('Confirm the exact accepted source and language first.');
          if (s.syncJobs[a.id]?.status === 'synced' || s.syncJobs[a.id]?.status === 'syncing')
            throw new Error('Already synced or syncing source is immutable.');
          a.code = command.code;
          a.language = command.language;
          a.codeProvenance = 'user-confirmed';
          delete a.complexityAnalysis;
          break;
        }
        case 'importBackup': {
          const merged = mergeBackup(s, parseBackup(command.text));
          Object.assign(s, merged);
          break;
        }
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
          if (command.type === 'hint') {
            if (command.level && ![1, 2, 3].includes(command.level))
              throw new Error('Invalid hint level.');
            if (command.level && (a.hintLevels ?? []).includes(command.level)) break;
            a.hintsUsed = Math.min(999, a.hintsUsed + 1);
            if (command.level) a.hintLevels = [...(a.hintLevels ?? []), command.level];
          } else if (command.type === 'editorial') a.editorialViewed = true;
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
          delete r.code;
          delete r.language;
          delete r.codeProvenance;
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
          if (
            a.status !== 'completed' ||
            !a.code?.trim() ||
            !a.language ||
            !['server-verified', 'user-confirmed'].includes(a.codeProvenance ?? '')
          )
            throw new Error('A completed attempt with source and language is required.');
          const previous = s.syncJobs[a.id];
          if (previous?.status !== 'synced' && previous?.status !== 'syncing')
            s.syncJobs[a.id] = {
              id: a.id,
              destination: previous?.destination,
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
    }, command.type === 'importBackup');
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
    if (['complete', 'retrySync', 'settings', 'resolveCapture'].includes(command.type)) drain();
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
    if (!isContent && message.command?.type === 'exportRecovery') {
      void storage
        .exportRecovery()
        .then((recovery) => respond({ ok: true, recovery }))
        .catch(() => respond({ ok: false, error: 'Recovery export failed.' }));
      return true;
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
