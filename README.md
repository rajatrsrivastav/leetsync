# DSACommit

A local-first **campus placement preparation companion** for Chrome and Edge, built with React, TypeScript, and WXT. A focused progress dashboard and curated external resources sit alongside the existing Striver tracker, Accepted capture, timers, streaks, revisions, and optional GitHub sync.

**Check progress → open a resource → study → record progress → continue.** No account, backend, telemetry, or AI service is required. Existing DSA data is preserved.

## Daily preparation roadmap

The Campus preparation dashboard is an **actionable daily plan**, not a resource directory. Each day shows your unchanged **two Striver DSA problems** plus **one focused extra task** drawn from a 64-topic roadmap that rotates through Operating Systems, DBMS & SQL, Computer Networks, OOP, System Design (HLD), Low-Level Design, aptitude, and interview preparation, eight topics per track from Foundation to Advanced.

Every extra task has four parts:

1. **Study** — one topic for 20–30 minutes with a deep link to the exact section, chapter, or page of a verified source (for example OSTEP chapter PDFs, Core CS Interview Prep sections, System Design Primer anchors, AlgoMaster articles, PostgreSQL docs, IndiaBIX formula pages, Tech Interview Handbook sections).
2. **Practice** — one matching exercise with a direct link: LeetCode concurrency/SQL/design problems, HackerRank SQL challenges, System Design Primer and AlgoMaster design exercises (URL shortener, load balancer, key-value store, web crawler), Awesome Low-Level Design machine-coding problems (Tic Tac Toe, Parking Lot, Vending Machine, LRU Cache, Pub/Sub, Elevator, Splitwise), refactoring katas, aptitude question sets, and interview-practice prompts. Theory topics use explanation prompts checked against real interview questions; no unrelated problems are forced.
3. **Complete** — record understanding (independent / with some support / needs work), practice result, minutes, and notes. **Mark completed** schedules a spaced review (7, 14, 28… days, 3 days after a supported completion); **Need revision** brings the topic back tomorrow. Drafts save partial progress.
4. **Next** — the following topic is shown; the **Upcoming** tab projects the next ten tasks and due reviews.

Layout: **Today / Upcoming / Progress / Resource Library**. Progress shows DSA stats, per-track completion, study activity, and history. The library keeps the ten curated sources plus a browsable topic roadmap with bookmarks.

- Daily assignments, outcomes, drafts, bookmarks, and reviews persist in local storage and backups. An unfinished task is resumed on later days under its original id; nothing is auto-completed.
- Opening a link records nothing. The extension guides you to the original source and expects independent practice; it bundles no lessons, quizzes, answers, or AI-generated content.
- All DSA workflows and historical data (attempts, queues, streaks, revisions, GitHub sync, previous lesson sessions and quiz results, manual resource entries) are unchanged.

| Area                  | Resource                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| DSA                   | [Striver's sheet](https://takeuforward.org/prep-hub/strivers-180-master-dsa-patterns)                                                       |
| DSA concepts/patterns | [Awesome LeetCode Resources](https://github.com/ashishps1/awesome-leetcode-resources)                                                       |
| Core CS questions     | [Core CS Interview Prep](https://github.com/kratos0718/core-cs-interview-prep) — OS, DBMS, SQL, networks, OOP sections                      |
| Core CS               | [CS Fundamentals for Interviews](https://github.com/aashishbharti04/cs-fundamentals-for-interviews)                                         |
| HLD — Primary         | [Awesome System Design Resources](https://github.com/ashishps1/awesome-system-design-resources)                                             |
| HLD — Additional      | [System Design Primer](https://github.com/donnemartin/system-design-primer)                                                                 |
| LLD/OOD               | [Awesome Low Level Design](https://github.com/ashishps1/awesome-low-level-design)                                                           |
| Aptitude              | [IndiaBIX](https://www.indiabix.com/aptitude/questions-and-answers/)                                                                        |
| Interview preparation | [Tech Interview Handbook](https://www.techinterviewhandbook.org/software-engineering-interview-guide/)                                      |
| Company questions     | [Company-wise questions](https://github.com/snehasishroy/leetcode-companywise-interview-questions) — July 2026 snapshot, not live frequency |

Every roadmap link and source destination was opened on October 17, 2026 (GitHub section anchors were derived from the files' headings on that date). Content and availability may change; the catalog in `src/features/preparation/roadmap/topics.ts` records the verification date.

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
