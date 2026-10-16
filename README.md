# DSACommit

A local-first **campus placement preparation companion** for Chrome and Edge, built with React, TypeScript, and WXT. A focused progress dashboard and curated external resources sit alongside the existing Striver tracker, Accepted capture, timers, streaks, revisions, and optional GitHub sync.

**Check progress → open a resource → study → record progress → continue.** No account, backend, telemetry, or AI service is required. Existing DSA data is preserved.

## Preparation tracking workspace

The main dashboard focuses on **how much you have prepared, what is pending, and where to continue**. It contains no embedded lessons or MCQ interfaces.

- **Progress:** daily DSA goal and streak, solved / 179, independent/assisted/relearn attempt counts, average time across timed completed solves, revision backlog, topic mastery, and the last 7/30 days of preparation activity.
- **Subject tracking:** explicitly recorded completed/in-progress topics across Core CS, System Design, aptitude, interviews, and other preparation subjects. Previous study topics remain visible separately. External resources have no invented completion percentage.
- **Resources:** nine curated destinations with Open Resource, Mark Progress, Resume Learning, and bookmarks. Links open the original site in a new tab. Resume opens the resource with your last studied topic shown on its card; the extension does not inspect external browsing or infer a deep-link position.
- **Manual study records:** topic, subject, explicit completion, and optional minutes. Repeated records contribute study time, while topic counts use the latest status for the same resource/subject/topic. Opening a link records only a visit; it never completes a topic, solves a DSA problem, or extends a DSA streak.

| Area                  | Resource                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| DSA                   | [Striver's sheet](https://takeuforward.org/prep-hub/strivers-180-master-dsa-patterns)                                                       |
| DSA concepts/patterns | [Awesome LeetCode Resources](https://github.com/ashishps1/awesome-leetcode-resources)                                                       |
| Core CS               | [CS Fundamentals for Interviews](https://github.com/aashishbharti04/cs-fundamentals-for-interviews)                                         |
| HLD — Primary         | [Awesome System Design Resources](https://github.com/ashishps1/awesome-system-design-resources)                                             |
| HLD — Additional      | [System Design Primer](https://github.com/donnemartin/system-design-primer)                                                                 |
| LLD/OOD               | [Awesome Low Level Design](https://github.com/ashishps1/awesome-low-level-design)                                                           |
| Aptitude              | [IndiaBIX](https://www.indiabix.com/aptitude/)                                                                                              |
| Interview preparation | [Tech Interview Handbook](https://github.com/yangshun/tech-interview-handbook)                                                              |
| Company questions     | [Company-wise questions](https://github.com/snehasishroy/leetcode-companywise-interview-questions) — July 2026 snapshot, not live frequency |

All nine original destinations were checked on October 17, 2026. Content and availability may change.

**Existing data is preserved.** The additive resource-tracking namespace leaves previous lesson sessions, quiz answers/results, reflections, plans, timers, and revision dates intact. Previous study history remains readable and included in backups; an existing active timer can be paused. No old answers are converted into unverified external completions. Bookmarks, resource visits, and study records survive reloads/restarts and backup export/import. The DSA popup, daily two-question queue, Accepted capture, GitHub sync, and revision workflows remain unchanged. No AI provider or external analysis request is added.

## Run locally

Requirements: **Node.js 22.12 or newer** and **pnpm 11.19.0**. Install pnpm through your usual package manager, or enable Corepack if your Node installation provides it.

```sh
pnpm install
pnpm dev
```

WXT starts the development server. Load `.output/chrome-mv3-dev` manually through Chrome's **Load unpacked** control and keep the terminal running while developing. Automatic browser launch is disabled so you can use your chosen browser profile. To target Edge:

```sh
pnpm dev:edge
```

For a production build:

```sh
pnpm build
```

The unpacked extension is in **`.output/chrome-mv3`**. It contains WXT's generated Manifest V3 manifest; no manifest is maintained by hand.

## Load into Chrome or Edge

1. Run `pnpm build`.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this repository's `.output/chrome-mv3` directory.
5. Pin **DSACommit**, open its popup, and choose **Start Journey**. The daily target defaults to 2 and GitHub can be configured later.
6. Choose **Start Problem**. The first verified problem is **Majority Element-I** on LeetCode. Press **Start Attempt** in the floating widget when you are ready to work.

The Chrome production bundle also works in Edge. `pnpm build:edge` produces WXT's Edge-specific bundle under `.output/edge-mv3`. After rebuilding, use Reload on the extension's browser management page and reload any existing LeetCode tabs. Development and production installs may use different extension IDs and separate stored data.

## Existing DSA workflow

- **Popup:** today's queue, one-click problem launch, daily progress, streak, weekly activity, and revision count.
- **LeetCode widget:** explicit Start/Pause/Resume, persisted timer, submission counts, hints, editorial/solution flags, progressive guidance, reflection, and next-problem navigation.
- **Dashboard:** the entire ordered curriculum, previous attempts, local activity calendar, topic mastery, revision queue, manual completion, per-problem reset, settings, and versioned JSON backup export/import.
- **Completion:** Accepted stops the timer. You must choose Independent, Needed Help, or Relearn before the attempt updates daily progress. Notes, complexity, source code, and language can be recorded during reflection.
- **Local durability:** saved attempts survive reloads, closed tabs, browser restarts, and service-worker restarts. Resetting a problem's curriculum status preserves previous attempts and past daily activity.
- **Optional GitHub output:** completed solutions, metadata, optional README progress, visible sync errors, and retries. Local completion is saved before network work begins.

The timer measures time while its state is Active. It **continues across tab closure and browser shutdown** until paused or accepted; there is no automatic idle detection. Pause before stepping away. Merely loading a problem page never starts the timer. Preparing another problem pauses the previous active attempt.

A problem counts once per local calendar day, even if repeated that day. A revision on another day counts toward that day's target. A streak day requires reaching the target saved for that day; an unfinished today does not erase yesterday's streak before midnight. Changing the daily target does not rewrite historical targets.

The default queue includes at most one scheduled revision and reserves a new curriculum problem while unfinished problems remain. Previously selected daily slots and unfinished attempts remain stable. When the entire curriculum is complete, the queue can contain fewer than the configured target.

## Curriculum and guidance

The included snapshot contains **179 verified problems across 17 modules** from [Striver's official SDE Pattern Sheet](https://takeuforward.org/prep-hub/strivers-180-master-dsa-patterns?page=sheet), checked on **October 8, 2026**. “Striver 180” is its familiar name; the current official sheet reports 179.

There are **145 LeetCode links** with difficulty verified against LeetCode's public metadata. The remaining **34 problems** open their official TakeUForward practice pages and use manual completion in the dashboard. Difficulty stays unlisted for those rows. Some LeetCode destinations require a paid account or represent a related variant named differently from the sheet.

Titles, ordering, patterns, and links are metadata only. DSACommit does not copy problem statements, editorials, solutions, videos, or premium content, and does not scrape the sheet during normal use. Progressive guidance consists of original general learning prompts. Revealing a guidance level records a hint; opening external help through the widget records the corresponding viewed flag. Independently opened external help is self-reported.

See [curriculum provenance and JSON/CSV import instructions](docs/CURRICULUM.md). The importer validates metadata and stable IDs; it does not invent missing facts or change saved progress.

## Optional GitHub setup

1. Create a repository such as `username/dsa-journey` and **initialize it with a README**. The configured branch must already have a commit.
2. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) restricted to that repository with **Contents: Read and write**.
3. Open DSACommit's dashboard → Settings. Enable GitHub sync, enter the repository, branch, and token, then **Save configuration** and allow the optional GitHub host permission.
4. Click **Test connection**. This verifies access without creating a test commit.
5. Complete a real solve, attach accepted source and its language, select confidence, and finish reflection. Automatic sync runs only after that completed reflection when enabled.

If code cannot be captured reliably, paste the accepted code during reflection. A completion without source still counts locally and creates no artificial commit. With automatic commits disabled, sync a completed attempt explicitly from its history.

Solutions use deterministic paths such as `binary-search/koko-eating-bananas/solution.py`. The source, a per-attempt receipt, and an optional README progress section are bundled into one commit. The receipt makes retrying safe after a lost network response. Failed jobs retry with backoff and remain available for explicit retry in Settings. Protected branches may reject direct writes; use a branch where your token can commit.

Tokens are stored separately in this browser profile's extension storage, excluded from backups, never bundled or logged, and only sent to `api.github.com` for configured sync. Extension storage is **not an encrypted vault**. Disconnect removes the local token and optional GitHub permission; revoke the token on GitHub to invalidate it everywhere. See [GitHub details](docs/GITHUB.md).

## Privacy and permissions

| Permission/access                   | Purpose                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `storage`                           | Keep attempts, progress, queues, settings, and sync jobs locally.                              |
| `alarms`                            | Wake the service worker to retry configured GitHub sync.                                       |
| `https://leetcode.com/problems/*`   | Inject the practice widget and observe submissions on supported problem pages.                 |
| Optional `https://api.github.com/*` | Send completed solutions to the repository you configure. Requested only when enabling GitHub. |

There is no broad browsing-history access, `<all_urls>` access, telemetry, or backend. Normal study data stays in local extension storage. GitHub receives source and selected attempt metadata only when sync is configured. The versioned curriculum is bundled with the extension.

Settings → **Export local backup** downloads attempts, code, notes, progress, and settings as JSON, excluding the GitHub token. Export before uninstalling or switching browser profiles; browser extension data does not automatically follow you. The versioned import UI merges missing history, preserves existing IDs, pauses imported timers, and includes both preparation and DSA records. Fresh preparation imports disable AI context export until you opt in again.

## Commands and checks

| Command                                    | Purpose                                       |
| ------------------------------------------ | --------------------------------------------- |
| `pnpm dev` / `pnpm dev:edge`               | WXT development mode.                         |
| `pnpm build` / `pnpm build:edge`           | Production unpacked bundle.                   |
| `pnpm zip`                                 | Package the production extension.             |
| `pnpm typecheck`                           | Generate WXT types and check TypeScript.      |
| `pnpm test`                                | Run Vitest business-logic and adapter tests.  |
| `pnpm test:watch`                          | Run Vitest in watch mode.                     |
| `pnpm import:curriculum file.json --check` | Validate a curriculum update without writing. |

Browser fixture test:

```sh
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

The Playwright tests load the actual built extension in a temporary Chromium profile and serve a controlled LeetCode-shaped fixture. They exercise onboarding, both DOM and network submission capture, two DSA solves, an imported previous study backup, external resource navigation, offline manual progress, bookmarks, unchanged DSA history, backup export, and browser restart. They do not sign into LeetCode, submit to its judge, or write to a live GitHub repository. Live authenticated LeetCode behavior and live GitHub writes still require the manual acceptance checklist in [DEVELOPMENT.md](DEVELOPMENT.md).

`Alt+Shift+D` opens DSACommit by default. Assign timer, hint, and next-problem shortcuts in `chrome://extensions/shortcuts` or `edge://extensions/shortcuts`.

## Integration limitations

LeetCode's DOM is an external boundary. Detection is deliberately tied to a newly initiated Submit action; it does not treat a historical Accepted result or a successful example run as a new solve. DOM changes, unsupported controls, or reloading while a submission is being judged can require **Completion not detected? → Record completed solve manually**. Confidence reflection is still required.

Monaco's virtualized editor text is not a reliable full-source capture. DSACommit returns no code rather than committing a partial editor buffer; paste code when prompted. Core progress and streak tracking remain usable without code capture or GitHub.

Architecture, persistence rules, scoring formulas, known boundaries, and the full manual acceptance checklist are in [DEVELOPMENT.md](DEVELOPMENT.md).

Reliability improvements include schema-2 checkpoints, validated backup import, source provenance gates, submission-ID verification, post-solve local complexity observations, structured learning reflections, and adaptive due-revision ranking. See [recovery and verification boundaries](docs/RELIABILITY.md). Reload the existing extension after building; retain its extension ID/profile to retain local history.
