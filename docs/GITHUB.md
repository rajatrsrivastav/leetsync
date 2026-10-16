# Optional GitHub sync

DSACommit saves attempts, reflection, daily activity and revision dates locally before GitHub sync starts. GitHub is an optional output. Network errors, expired tokens and branch rules never undo a completed local problem.

## Setup

1. Create a personal GitHub repository and initialize it with a README. DSACommit requires an existing branch with an initial commit.
2. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new). Select only that repository and grant **Contents: Read and write**. GitHub supplies the required metadata read access. Organization policies may require owner approval.
3. In DSACommit Settings, enter `owner/repository`, the existing branch name, and the token. Validate access, then enable sync and optional automatic commits.
4. Complete a real solve or revision, explicitly select confidence, and attach accepted source code and its language. If reliable code capture was unavailable, paste the code in reflection. A completion without source still counts locally and creates no artificial GitHub commit.

The token is kept separately in local extension storage and is used only in authorization headers sent to `https://api.github.com`. It is not written into solution files, receipts, logs or error messages. Local extension storage is not a password vault; use a narrowly scoped token and revoke it in GitHub when no longer needed. No token or repository credential is bundled with this project.

Validation reads the authenticated user, repository and branch. It checks repository access and initialization without creating a test commit. GitHub ultimately enforces token Contents write permission and branch rules on the first real sync. Branch protections requiring a pull request or signed commits can reject direct commits; choose a dedicated writable practice branch.

## Files and commits

The service writes deterministic paths such as:

```text
binary-search/koko-eating-bananas/solution.py
.dsacommit/attempts/<attempt-id>.json
README.md                                  # optional
```

A numeric prefix is included only when that number exists in the curriculum title; curriculum order is never presented as a LeetCode problem number. Python, JavaScript, TypeScript, C, C++, C#, Java, Go, Rust, Kotlin, Swift, Ruby and several other common languages have appropriate extensions. Unrecognized languages use `.txt`.

When metadata is enabled, a language-appropriate line-comment header contains the problem URL, topic, pattern when known, completion date, active time, submission and hint counts, viewed-content flags, confidence, and optional complexity/notes. Multiline metadata is flattened and comment delimiters escaped. Source code is preserved, executable shebangs remain first, and Python/Ruby encoding declarations retain their position. Turning metadata off writes the exact captured source.

Completed attempts create messages such as `feat(dsa): solve Koko Eating Bananas [28m] 🟡`, with the local attempt identifier in a commit trailer. Revisions use `revise`. GitHub assigns the authenticated commit identity and actual commit timestamp; DSACommit does not backdate commits or fabricate activity.

The latest solution at a deterministic path can replace an older solution, while Git history and all local attempts retain prior versions. The receipt records the attempt ID, problem/curriculum IDs, completion timestamp and solution path; it does not contain a token or copy of the code.

## Atomic updates and retry behavior

For each sync, `GitHubService`:

1. Reads the selected branch's current commit.
2. Checks `.dsacommit/attempts/<attempt-id>.json` at that exact commit. An existing matching receipt proves the attempt was already committed and avoids another commit.
3. Reads the current Git tree and, when enabled, the existing README at the same commit.
4. Creates one tree containing the solution, receipt and optional README change, using the current tree's `base_tree` so unrelated files remain intact.
5. Creates a commit with the current commit as its parent and advances the branch with `force: false`.

A concurrent branch update causes a fresh read of the branch, receipt and README, with at most three attempts per sync call. The service never force-pushes. A crash or lost response after a successful remote update is recovered by the receipt on the next background retry. When recovering from a receipt, the returned link may point to the current branch commit containing the receipt rather than the original solve commit.

Creating Git objects and updating the branch are separate REST operations. An interrupted or conflicted attempt can leave unreachable Git objects, but does not expose a partial solution/README update on the branch. Keep the receipt directory in the repository: deleting or rewriting receipts/history removes this remote deduplication evidence.

The background outbox owns retry scheduling and status. `GitHubService` performs network operations without modifying local state. Each HTTP request has a 20-second timeout; transport and API failures are reduced to actionable messages that exclude raw response bodies, source and secrets. Redirects are rejected, so credentials are never forwarded to a different host.

## Managed README section

README updates are optional and are bundled into the solution commit. Existing UTF-8 text, including non-ASCII characters, is preserved outside this block:

```markdown
<!-- DSACOMMIT:START -->

## DSACommit progress

Generated curriculum counts, local streak and topic statistics.
<!-- DSACOMMIT:END -->
```

The service uses the repository's existing Markdown README path when present, and creates `README.md` when absent. Duplicate, reversed or incomplete markers stop the sync before any Git objects are created. Repair the markers or disable README updates and retry. Non-Markdown, non-UTF-8, files reported as symlinks, or README files larger than 1 MB are not rewritten; disable README updates to continue syncing solutions.

## Verification

The automated tests use mocked HTTP responses only; they never contact a real repository. They cover filenames, metadata, shebangs, Unicode decoding, preservation of user README text, HTTP sanitization/timeouts, atomic tree structure, receipts, concurrent branch updates, and recovery from a lost response after a successful update.

For a manual check, use a disposable initialized repository. Complete a problem with source, confirm one commit contains the solution and receipt, and confirm an optional README edit appears in that same commit. Retry the same outbox item and confirm no second commit appears. Then test an invalid token and an offline completion: progress should remain local and a later retry should recover. A live GitHub write cannot be validated without a user-supplied token and repository.

Implementation references: [Git trees and `base_tree`](https://docs.github.com/en/rest/git/trees?apiVersion=2026-03-10), [Git commits](https://docs.github.com/en/rest/git/commits?apiVersion=2026-03-10), [references and non-forced updates](https://docs.github.com/en/rest/git/refs?apiVersion=2026-03-10), and [repository contents](https://docs.github.com/en/rest/repos/contents?apiVersion=2026-03-10). Requests use API version `2026-03-10`.
