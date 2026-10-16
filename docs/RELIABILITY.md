# Reliability and verification

## Storage and recovery

Schema 2 migrates existing local records in place. The service worker is the sole writer. Each serialized mutation atomically replaces one authoritative `chrome.storage.local` document containing attempts, timers, activity/streak inputs, progress, settings, queues and the GitHub outbox. A previous-state checkpoint is written first. A quota/write error leaves authoritative data intact and is surfaced; it never triggers a reset. Startup/update handlers do not clear data. Unknown future schemas fail closed.

When validation detects corruption, a valid checkpoint can recover the previous state. A prominent notice warns that the most recent mutation may be missing. The first unreadable original is retained separately. Export recovery records before troubleshooting. If no valid checkpoint exists, the dashboard still exposes recovery export and explicit backup import. Raw recovery records are diagnostic archives, not directly importable backups.

Settings and onboarding offer versioned JSON backup export/import. Imports validate records, merge missing attempt IDs, preserve existing records and daily goals, pause imported timers, and require explicit retry/confirmation for unsynced source. Tokens are stored separately and excluded from exports. Backups contain private source and notes: store them appropriately.

Data belongs to an extension ID within a browser profile. Reloads and same-ID updates preserve it. Uninstalling, deleting a browser profile, changing an unpacked extension's path/identity, and temporary development profiles can produce a fresh store. A checkpoint in the same profile cannot survive deletion of that profile. Export files are the cross-profile recovery mechanism. Storage has a browser-enforced quota; this implementation does not claim unlimited or indestructible storage.

## Submission capture

A narrow MAIN-world script observes LeetCode POST submission requests made through fetch/XHR. It copies submitted source/language and the returned submission ID, never headers/cookies. The isolated script persists the pending request through the worker and checks the authenticated same-origin judge endpoint. Accepted source comes from submission details, with matching ID, problem, language, request code, Accepted status, and submission timestamp. The page bridge is untrusted; it cannot directly nominate code for upload.

Pending verification resumes when the relevant problem page is open after reload. Network failures retain recovery state and expose retry. If exact source cannot be verified, acceptance can still be recorded, but no source is silently committed. DOM verdict detection remains a fallback and no longer supplies automatically committable source. Manual recovery allows the user to copy and explicitly confirm the exact Accepted source. Confirmation is distinguished from server verification. Existing source is retained as legacy-unverified and requires confirmation before sync.

LeetCode's submission endpoints are not a public stability contract. API/DOM changes can require adapter updates. Browser fixtures do not prove compatibility with a currently authenticated live session.

## Learning and complexity

Guidance reveals progressive recognition, brute-force, invariant, and edge-case questions. Active-attempt panels hide the curriculum pattern label. Revealed levels and hint counts persist. Recorded help prevents a completion from being classified as independent; a later independent revision can demonstrate recall. External editorial/solution viewing remains an explicit user action.

Post-solve reflection collects invariant, brute-force improvement, edge case, next action, and mistake tags. Local complexity inspection is user-triggered after acceptance, has no AI/network dependency, and returns structural observations and input-variable prompts with explicit uncertainty. It does not infer Big-O from keyword counts or claim universal deterministic analysis. Time/space entries are user-reported and editable; inspection is bound to the current source/language and invalidated on edits. Analysis and reflection accompany the GitHub receipt.

Due-revision ranking considers help, relearning, failed independent recall, repeated self-reported mistakes, and slower solves relative to prior timed solves. The dashboard groups these signals by pattern/module. Existing daily queues remain stable, at most one revision is added, and new problems remain in curriculum order. These signals are heuristics, not a validated ability score.

## GitHub recovery

Source provenance gates all uploads. The durable outbox retries offline/API failures; a job binds to the repository/branch on its first claim and retains that destination on retries even if settings change. Atomic Git trees include source and an attempt receipt. An existing matching receipt resolves a retry after a worker interruption without creating a duplicate commit. Stored credentials remain restricted to trusted extension contexts, optional GitHub host access is requested only when enabled, and no credential is included in backup data.

## Verification boundary

Tracking redesign verified October 17, 2026: 258 unit tests, three Chromium journeys, TypeScript, formatting, and Chrome/Edge production builds passed. Progress and resource screens were visually inspected.

The campus preparation namespace is independently versioned and shares the same atomic storage/checkpoint mechanism. Imported preparation and DSA progress can advance only when newly imported completion records support them; colliding local IDs are retained. Imported active timers pause, existing daily goals remain, and imported sync receipts cannot attach to unrelated local attempts. Unknown future preparation versions are never replaced by an older checkpoint.

The tracking redesign retains all previous lesson/quiz data and adds optional resource visits, bookmarks, and immutable study entries to the existing storage document. Opening links does not complete topics or contribute activity. Backup merging preserves local entry IDs and bookmark choices; unknown historical resource IDs remain retained. The browser journey imports a previous-format quiz backup, records visits and offline explicit progress, restarts the browser, verifies unchanged DSA records, and checks exported backup contents.

Automated tests cover migrations, checkpoints/corrupt records, failed writes, idempotent import, exact-source checks, stale/wrong submission rejection, duplicate submission/completion events, offline sync, interrupted worker recovery, remote receipt deduplication, and retry destination stability. Chromium runs the packaged extension through both DOM and network fixtures, two completions, reload, and a persistent-profile browser restart. Chrome and Edge production builds are checked separately.

Live release checks still require a current authenticated LeetCode submission and a designated GitHub repository/branch: compare the submission's complete code/language against saved data, verify the resulting commit/receipt, interrupt sync and retry, then reload/update the same extension ID and compare saved history. Do not describe mocked API tests as live verification.
