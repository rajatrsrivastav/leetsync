# DSACommit development

DSACommit uses WXT, React, TypeScript, Tailwind CSS, and Manifest V3. It is a browser extension with no backend. All durable state changes run through the background service worker; GitHub is an optional output adapter.

## Repository map

| Location                                     | Responsibility                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `entrypoints/background.ts`                  | Validate extension commands, serialize mutations, open allowlisted problem URLs, handle shortcuts, and drain sync jobs. |
| `entrypoints/popup/`                         | Onboarding and today's next problem.                                                                                    |
| `entrypoints/dashboard/`                     | Overview, curriculum, attempts, revisions, settings, and export.                                                        |
| `entrypoints/leetcode.content/`              | Shadow-root widget, route tracking, platform event delivery.                                                            |
| `src/components/`                            | Shared attempt panel, reflection, onboarding, and UI primitives.                                                        |
| `src/domain/attempt/`                        | Pure lifecycle transitions, timing, idempotency, and completion.                                                        |
| `src/domain/curriculum/`                     | Generic provider contract, verified snapshot provider, validation, and import helpers.                                  |
| `src/domain/progress/`, `src/domain/streak/` | Explainable mastery and local activity statistics.                                                                      |
| `src/services/`                              | Storage, daily queue, revision schedule, code capture boundary, GitHub REST and durable outbox.                         |
| `src/repositories/`                          | Typed views over attempts, progress, settings, and activity.                                                            |
| `src/platforms/leetcode/`                    | Every LeetCode selector, verdict detector, and code-capture assumption.                                                 |
| `src/data/curricula/`                        | Versioned navigation metadata and provenance.                                                                           |
| `tests/`, `tests/e2e/`                       | Pure logic/DOM unit tests and built-extension browser fixture.                                                          |

The source of manifest configuration is `wxt.config.ts` and the WXT entrypoints. Production output is `.output/chrome-mv3`; development output is `.output/chrome-mv3-dev`.

## State ownership and storage

`browser.storage.local` stores one atomic document under `dsacommit.state`:

```ts
type AppState = {
  schemaVersion: 2;
  preparation?: PreparationState; // additive namespace, independently versioned at 1
  settings: Settings;
  attempts: Record<string, Attempt>;
  progress: Record<string, ProblemProgress>;
  activities: Record<string, DailyActivity>;
  queues: Record<string, DailyQueue>;
  syncJobs: Record<string, SyncJob>;
  activeAttemptId?: string;
};
```

The token is stored separately under `dsacommit.github-token`; it is not part of `AppState`, normal responses, or backup export. The worker sets storage access to `TRUSTED_CONTEXTS`. Content scripts communicate through validated extension messages instead of reading the storage area directly. A website cannot invoke the worker through an external messaging declaration.

`StorageService.transaction()` chains work through a promise queue, reads the latest document, applies the transition, and writes once. Completion, activity, revision scheduling, and insertion into the GitHub outbox therefore persist together. Network requests happen outside the transaction. This is a single-worker coordination mechanism, not a general multi-process database transaction.

Popup, dashboard, and widget dispatch typed commands through `src/services/client.ts`. `useAppState` serializes local actions and refreshes on focus, storage changes, and a four-second poll. A persisted timestamp drives elapsed time; UI intervals only repaint the display.

`migrateState` accepts a fresh store and schema 0/1/2 data, fills current defaults, and validates key records. Unknown future schema versions fail visibly rather than being overwritten. Schema 2 adds source provenance, persisted submission verification, and recovery checkpoints. Add migration fixtures before introducing future schemas. See docs/RELIABILITY.md for checkpoint and import behavior. Keep old attempt IDs and curriculum IDs intact.

Export includes saved code and notes and excludes the token. Settings and onboarding expose validated merge-import and recovery export. Avoid deleting browser extension storage to debug a real user's state; use a separate development profile and export first.

## Attempt lifecycle

The actual domain states are:

```text
ready → active ⇄ paused → accepted → completed
  └───────────────→ abandoned

completed → outbox: pending → syncing → synced
                                  └→ failed → retry
```

`accepted` is the persisted reflection state; it is not yet a completed daily problem. `prepareAttempt` creates a ready attempt with `startedAt`, preserves an unfinished attempt for the same problem, and pauses another active timer. `startAttempt` sets `runningSince`; the page load alone does not do this.

Elapsed seconds are accumulated stopped time plus the difference between now and `runningSince` while Active. Pause, Accepted, or abandonment accumulates that interval and removes the running timestamp. No per-second storage write is necessary. An unpaused timer continues across reload, tab closure, service-worker suspension, and browser shutdown. It does not detect idleness. Wall-clock changes are a practical limitation of timestamp-based timing.

Submission IDs are recorded once, checked against every historical attempt, and ignored after acceptance/completion. A duplicate event cannot add a second completion. Wrong answers and other terminal failures increment the submission count while leaving the session open. Unknown verdicts do not count. Preparing or starting another problem is blocked until a pending accepted reflection is completed.

Completion requires an explicit confidence: `independent`, `assisted`, or `relearn`. It is idempotent for a completed attempt. Historical attempts remain separate records. Resetting a session marks it Abandoned; resetting curriculum progress preserves attempt history and past daily activity. A new attempt for an already completed problem is a revision.

## Queue, dates, revisions, and mastery

`DailyQueueService.generate()` retains existing daily slots and gives unfinished attempts a place before adding work. New slots prioritize a due revision, with relearn ahead of assisted and independent, then the next ordered unfinished curriculum problem. It selects at most one scheduled revision and reserves a new problem when unfinished material remains. A daily target of one therefore normally favors new material. With no unfinished material, there may be fewer queued items than the goal.

Dates are local calendar keys (`YYYY-MM-DD`) built from local date components, not UTC ISO date slices. Completion is credited on the local date reflection is saved. Each curriculum problem counts once per day; multiple attempts are still preserved. A day stores its target when activity is first recorded, so changing Settings does not rewrite historical success thresholds.

The streak counts consecutive days that reach their stored targets. If today is unfinished, it checks from yesterday so the live streak remains until the day ends. Week views run Monday–Sunday. Day arithmetic uses local calendar operations for daylight-saving transitions.

`RevisionScheduler` schedules an independent first solve after 30 local days, assisted after 7, and relearn after 1. A later independent revision doubles its prior interval with a minimum of 30 days and a maximum of 365. Independent revisions increment `successfulRevisions`; assisted/relearn reset the interval to 7/1 days. Disable scheduling in Settings or use **Revise today** for a completed problem.

Mastery is an evidence score, separate from coverage. `masteryBreakdown` starts from confidence (80 independent, 50 assisted, 20 relearn), subtracts hints (4 each, capped at 20), editorial (8), solution (15), extra submissions (2 each, capped at 10), and a slow-solve penalty (up to 10). Time references are 20/40/60 minutes for Easy/Medium/Hard; there is no fast-solve bonus and no time penalty for unknown difficulty. Independent revision performance adds 5 each, capped at 20. Clamp the result to 0–100. Topic mastery averages the latest completed attempt scores across all topic problems, with zero evidence for unfinished problems. It is not a claim about interview readiness.

## Curriculum integration

The bundle contains the current verified **179 problems in 17 modules**, with 145 LeetCode destinations and 34 official TakeUForward practice destinations. Source title/order/module/pattern metadata was read from the public expanded official sheet on October 8, 2026. Easy/Medium/Hard labels were independently matched to LeetCode public metadata for the 145 LeetCode rows; unmatched rows remain unrated. Basic/Core/Pro labels were not guessed into a different scale.

`CurriculumProvider` exposes `data`, `getModules()`, `getProblems()`, `getNextProblem(progress)`, `getProblem(id)`, and `getBySlug(slug)`. `Striver180CurriculumProvider` implements it; `getAllBySlug` handles repeated platform problems. Stable sheet IDs are separate from ordering and platform slugs. The widget resolves the current attempt first, so Subsets can be practiced in two curriculum patterns without merging their progress.

`scripts/import-striver-curriculum.ts` accepts JSON or CSV plus metadata. It validates IDs, orders, completeness, dates, HTTPS URLs, and LeetCode slugs; protects stable source/ID relationships; and uses atomic replacement. It never fetches or invents data. A full bundle cannot be overwritten by partial data or silently lose existing problem IDs. The import is a build-time maintenance operation, not a user-progress restore.

See [CURRICULUM.md](docs/CURRICULUM.md) and `striver180.sources.json` for exact provenance, URL exceptions, and import examples. No third-party statement, editorial, video, premium content, or solution text is bundled.

## LeetCode boundary

The platform contract is defined in `src/platforms/types.ts`:

```ts
interface CodingPlatformAdapter {
  isSupportedPage(): boolean;
  getProblemMetadata(): Promise<ProblemMetadata>;
  getCurrentCode(): Promise<CodeSnapshot | null>;
  observeSubmission(callback: (submission: SubmissionResult) => void): () => void;
}
```

`LeetCodeAdapter` supplies metadata and a defensive `MutationObserver`. Selectors are confined to `src/platforms/leetcode/`. The observer arms only after the page's Submit control or Ctrl/Command+Enter inside a recognized editor. It correlates a later terminal result with a newly observed submission ID, pending transition, or changed verdict. Initial historical Accepted content, stale submission links, and example Run results must not count.

The widget captures the attempt identity when submission starts and routes the normalized event to that attempt, preventing page navigation from applying a verdict to an unrelated problem. Global persisted submission IDs protect retries and reloads. Page-route changes are observed separately, and the widget is rendered in a WXT-managed shadow root to isolate its styling.

This conservative observer deliberately loses in-flight correlation if the page reloads during judging. Use manual completion in that case. DOM selectors, result IDs, language labels, and keyboard semantics can change upstream. Unknown or ambiguous states should fail closed and keep the manual path usable. Debug logging is off by default and reports diagnostic events without printing full source or credentials.

`CodeCaptureService` delegates to the adapter. A normal full-source textarea or an explicitly labelled full submission-code block may be captured; Monaco view-lines, hidden inputs, truncated content, and virtualized buffers are rejected. There is no injected main-world script reading undocumented editor internals. Capturing nothing is an expected result. The reflection UI accepts manually pasted accepted code and language, and tracking must remain functional with no code.

## GitHub integration

`GitHubService` receives a `GitHubAuth` interface (`getToken(): Promise<string | null>`) and uses the REST API with `X-GitHub-Api-Version: 2026-03-10`. A future OAuth/GitHub App implementation can replace token retrieval without changing attempts or queues. V1 targets `api.github.com`, not enterprise hosts.

Configuration validation reads the authenticated user, repository, and existing branch without a test write. Sync requires a real Completed attempt with confidence, source, and language. Automatic sync is queued after reflection, not the raw Accepted event. A completion with no code stays local; manually supplied source can be attached in reflection before completion.

The Git Data API builds one tree and commit containing the deterministic solution path, `.dsacommit/attempts/<attempt-id>.json` receipt, and optional README section. It updates the branch without force. A receipt check before retry handles an uncertain network outcome after a successful branch update; a real revision gets its own receipt and commit. Existing unrelated README content is preserved by the bounded DSACommit section. Never substitute curriculum order for a LeetCode problem number or create backdated/fake activity.

`GitHubSyncService` runs network work outside storage transactions. The persistent outbox is saved with the completion. A one-minute alarm and worker startup drain eligible jobs. Failed jobs back off exponentially (1, 2, 4, 8 minutes between the initial five automatic attempts); the delay is capped at 60 minutes in the policy. After five failed attempts, explicit Retry is available. An interrupted Syncing job is recovered on the next worker run and reconciles through its receipt. Disabling GitHub stops new draining; failures never roll back local solves. Detailed behavior and token setup are in [GITHUB.md](docs/GITHUB.md).

## Verification commands and boundaries

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Vitest covers attempt idempotency and timer transitions, stable queue selection, local dates and streaks, revision scheduling, mastery, storage migration, curriculum integrity/import, conservative DOM detection/code capture, GitHub formatting, and mocked sync behavior. Mocks verify expected requests and error handling; they do not establish live API access.

The Playwright journey loads `.output/chrome-mv3` in a temporary Chromium profile. Its intercepted `https://leetcode.com/**` responses are controlled adapter fixtures. The test exercises the installed extension's popup/content-script/worker loop and persisted restart state without submitting to LeetCode. It is not a live-website test and makes no live GitHub writes. To use an existing compatible Chromium executable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

Authenticated live LeetCode submission detection, live code capture, and live GitHub writes must be checked manually in a test profile with a repository you control. Automated fixture results should be reported separately from these live checks.

## Manual first-journey acceptance checklist

Use a fresh browser profile and an unpacked production build. For the optional sync step, use a writable initialized test repository and a scoped token. Do not submit copied solutions merely to exercise the tracker; use your own real solves.

1. Install the unpacked extension with fresh storage.
2. Open the popup and complete onboarding without GitHub credentials.
3. Confirm the daily target defaults to 2.
4. Confirm the first problem is Majority Element-I with the verified LeetCode link.
5. Click Start Problem.
6. Confirm LeetCode opens `majority-element` and the widget shows the matching title; timer is still idle.
7. Click Start Attempt.
8. Confirm active time advances, Pause freezes it, and Resume continues it.
9. Reload the problem page after the attempt is active and no submission is pending.
10. Confirm the same attempt and elapsed time survive the reload.
11. Submit your own real solution while the attempt is active; exercise a failed verdict with an appropriate test attempt.
12. Confirm the failure increments submissions once and timing continues; Run examples must not count.
13. Correct the solution and submit until LeetCode reports Accepted.
14. Confirm timing stops once and duplicate result mutations do not increment the count.
15. Confirm the reflection panel appears and completion is disabled until confidence is selected.
16. Select Needed Help and record one hint; optionally add complexity, notes, and accepted source/language.
17. Click Complete Problem once, then verify repeated actions do not create a second completion.
18. Confirm today's progress is 1/2.
19. Open the dashboard curriculum and confirm the problem is Assisted and its attempt remains visible.
20. Confirm its revision is scheduled seven local calendar days ahead.
21. If GitHub is configured, confirm a single real commit contains source plus receipt (and README only when enabled). Check local completion remains saved if sync fails.
22. Click Start Next Problem.
23. Confirm the next destination is Maximum Subarray, displayed as the official sheet title Kadane's Algorithm.
24. Deliberately start, solve, and reflect on the second problem.
25. Confirm today shows 2/2 and the contribution calendar shows local activity.
26. Confirm the current streak increments for reaching the daily goal.
27. Close and restart the browser.
28. Confirm attempts, confidence, notes/code, 2/2 activity, revision dates, and sync status persist.

## Additional failure checks

- Open a previously Accepted submission before pressing Submit: no new attempt or completion should be inferred.
- Reload during judging, change problems, or encounter unfamiliar page markup: manually record the real solve and verify reflection still works.
- Start another problem while timing: the previous attempt pauses and remains in history. A pending reflection should block moving on.
- Retry a completion event, submit the same recorded ID in another attempt, and double-click Complete: only one completion and outbox job should exist.
- Reset a problem's progress: the curriculum becomes unfinished, while previous attempts and historical daily activity remain.
- Complete the same problem twice in a day: preserve both attempts, count the curriculum problem only once that day.
- Make one revision overdue while unfinished problems remain: the default queue should include at most one revision and at least one new problem.
- Deny optional GitHub permission, disconnect, use an expired token, go offline, or target a protected branch: preserve local data and show a retryable sync failure.
- Interrupt the worker after a remote branch update: retry should find the per-attempt receipt instead of producing a duplicate commit.
- Open an official-only curriculum row: its practice page and dashboard attempt controls should provide a complete manual workflow.
- Export a backup and verify it contains saved attempts but no `dsacommit.github-token` or token value.
- Inspect `chrome://extensions` service-worker errors and keyboard navigation in popup, dashboard, reflection, and the floating widget. Test both dark and light appearance.

## Preparation roadmap module

`src/features/preparation/PreparationHub.tsx` renders four tabs: Today (DSA queue, the extra task with Study/Practice/Complete steps, and the next topic), Upcoming (projected tasks and due reviews), Progress (metrics, per-track completion, activity, history), and Resource Library (topic browser with bookmarks plus the ten-source catalog in `resources.ts`). External anchors open a new tab with noopener/noreferrer. No lesson reader or MCQ workspace is mounted.

`roadmap/topics.ts` is the catalog: 8 tracks × 8 topics, ordered stage-major so consecutive days rotate tracks, each with a prerequisite on the previous topic in its track, a `learn` deep link, and a `practice` link with kind Explain/Code/Design/Practice and a scoped prompt. Links carry a `verifiedAt` date; replace a dead link rather than deleting a topic id, because recorded outcomes reference ids.

`roadmap/model.ts` owns the engine. `ensureRoadmapDay` returns today's assignment: an existing entry, else the oldest unfinished assignment carried forward under its original id, else a due review (at most one between new topics) or the next unlocked topic. `prepRoadmapRecord` validates outcome rules (`roadmapOutcomeProblem`): drafts are free-form and replaceable; revision requires a rating; completed requires independent/some-support understanding and an attempted practice. Final outcomes are immutable. `roadmapProgress` derives the latest outcome per topic with its due date: revision → next day; first supported completion → 3 days; otherwise 7 × 2^(completions−1) capped at 90 days. `prepRoadmapBookmark` stores topic bookmarks. `upcomingRoadmap` simulates future days on a clone.

Persistence lives in `preparation.roadmap` (version 1: `days`, `responses`, optional `bookmarks`) inside the same atomic document and checkpoint; preparation version 1 is unchanged. `validateRoadmap` fails closed on malformed records and keeps retired topic ids readable. `mergeRoadmap` keeps local assignment ids and outcomes, imports days the local store lacks, and unions bookmarks. `tracking.ts` counts recorded outcomes (not drafts) in daily activity alongside manual resource entries, old study sessions, and DSA solves. The older `prepResourceVisit`, `prepResourceBookmark`, and `prepResourceProgress` actions and legacy lesson actions remain supported. DSA streak, mastery, queue, and revision calculations are untouched.

`tests/roadmap.test.ts` covers catalog integrity (rotation, levels, deep links, exercise kinds), the daily engine (persistence, resume, outcome rules, immutability, review scheduling, prerequisite gating, bookmarks, corrupt data), and backup/migration/activity integration. `tests/e2e/preparation.spec.ts` starts a fresh profile, checks today's task and links, imports a previous-format quiz backup, saves an offline draft, reloads and completes the task, checks Upcoming/Progress/Library, bookmarks a topic, records a resource entry, restarts the browser, and validates exported backup contents and unchanged DSA records. Existing LeetCode DOM/network journeys continue to run independently. Live LeetCode/GitHub verification remains a separate release check.
