# Curriculum provenance and maintenance

DSACommit bundles a verified local snapshot of [Striver's SDE Pattern Sheet](https://takeuforward.org/prep-hub/strivers-180-master-dsa-patterns?page=sheet), maintained by TakeUForward. The October 8, 2026 snapshot contains **all 179 problems in the official order across 17 modules**. “Striver 180” is the familiar name; the source currently reports 179.

Only navigation metadata is included: title, module, pattern, order, destination URL, source URL, platform, stable ID, and verified difficulty when available. No problem statement, editorial, explanation, video, premium content, or solution is copied. The extension does not fetch the sheet at runtime.

## How this snapshot was verified

The public official sheet was opened in a browser and its **More sheet options → Expand all** control used. All 179 rendered problem rows and their module/pattern hierarchy were read from the visible page. The entire normalized metadata array matched the local JSON fingerprint (`d5783ffb`, FNV-1a, before the verified LeetCode redirect described below). This comparison is a transcription check, not a security signature.

The first rows are Arrays → Linear Scan → Majority Element-I, Kadane's Algorithm, Majority Element-II, and Maximum Product Subarray in an Array. Koko eating bananas is order 25, not the illustrative order in the product brief.

Difficulty was verified independently for all **145 LeetCode rows** through [LeetCode's public problem metadata endpoint](https://leetcode.com/api/problems/all/) using exact platform slug matching. Levels 1/2/3 map to Easy/Medium/Hard, checked against the public [Majority Element](https://leetcode.com/problems/majority-element/), [Koko Eating Bananas](https://leetcode.com/problems/koko-eating-bananas/), and [Trapping Rain Water](https://leetcode.com/problems/trapping-rain-water/) pages. TakeUForward's Basic/Core/Pro categories are **not** converted into LeetCode difficulty. The other 34 rows have no standard difficulty recorded.

Detailed provenance and normalization notes are in `src/data/curricula/striver180.sources.json`.

## Destination and tracking limitations

- The 34 rows without a suitable verified LeetCode destination open their official TakeUForward practice page. V1 supports automatic detection only on LeetCode; use dashboard/manual completion for other platforms.
- Some official LeetCode links are paid problems or related variants. DSACommit does not claim that every row is free, and never bypasses access controls. Official sheet titles are preserved even when the LeetCode title differs.
- Undirected cycle detection (order 124) incorrectly points to the directed Course Schedule problem on the source. The local destination is its verified TakeUForward practice URL.
- Kosaraju (130) and Rabin Karp (171) external links point directly to discussion/solution posts. The local destination is their verified TakeUForward practice page so Start does not unexpectedly reveal a solution.
- KMP (173) uses the verified current LeetCode destination `find-the-index-of-the-first-occurrence-in-a-string`; the source's `implement-strstr` link redirects there.
- Power Set (40) and Power Set Bit Manipulation (175) both link to Subsets. Each has its own curriculum ID. Resolve the active attempt's problem ID before falling back to `getBySlug`; `getAllBySlug` exposes every match.

## Provider contract

`Striver180CurriculumProvider` validates and orders metadata once. `getProblems`, `getModules`, `getProblem`, `getBySlug`, and `getNextProblem` use only the local snapshot. Independent, assisted, and relearn are explicit completed outcomes; not started and in progress remain eligible as the next new problem. Revision scheduling is separate.

`CurriculumProvider` is a generic interface. A future provider can supply the same metadata and selection methods without changing queue logic or platform adapters. Stable IDs identify sheet entries independently from destination slugs and ordering.

## JSON import

Use a complete JSON object with the schema shown below. `problems` may contain the full list or a truthfully marked partial dataset. Required problem fields are `id`, `order`, `title`, `module`, `platform`, and `problemUrl`; `slug`, `pattern`, `difficulty`, and `sourceUrl` are optional. Preserve original IDs and source URLs when updating titles, destinations, or ordering.

```json
{
  "id": "striver180",
  "name": "Striver's SDE Pattern Sheet",
  "version": "2026-10-08",
  "sourceUrl": "https://takeuforward.org/prep-hub/strivers-180-master-dsa-patterns",
  "verifiedAt": "2026-10-08",
  "expectedCount": 179,
  "complete": false,
  "problems": [
    {
      "id": "striver180:majority-element-i",
      "order": 1,
      "title": "Majority Element-I",
      "slug": "majority-element",
      "module": "Arrays",
      "pattern": "Linear Scan",
      "difficulty": "Easy",
      "platform": "leetcode",
      "problemUrl": "https://leetcode.com/problems/majority-element/",
      "sourceUrl": "https://takeuforward.org/practice/dsa/majority-element-i"
    }
  ]
}
```

Validate before replacing the bundle:

```sh
pnpm import:curriculum /absolute/path/verified.json --check
pnpm import:curriculum /absolute/path/verified.json
pnpm test
pnpm typecheck
pnpm build
```

For a partial candidate or a review copy, pass `--output /absolute/path/candidate.json`. The importer refuses to overwrite the complete bundle with a smaller/partial dataset or remove existing IDs. A complete dataset must contain all integer orders from 1 through `expectedCount`; partial data retains its actual verified orders, including gaps. Do not renumber a partial list to conceal missing source rows.

## CSV import

CSV headers are case-sensitive. Supported columns:

```csv
id,order,title,slug,module,pattern,difficulty,platform,problemUrl,sourceUrl
striver180:majority-element-i,1,Majority Element-I,majority-element,Arrays,Linear Scan,Easy,leetcode,https://leetcode.com/problems/majority-element/,https://takeuforward.org/practice/dsa/majority-element-i
```

Quoted commas, escaped double quotes, multiline cells, UTF-8 BOM, LF, and CRLF are supported. Keep absent optional fields empty. No editorial/solution columns are accepted. Supply a separate metadata JSON containing the same top-level fields as the JSON example, with `problems` omitted:

```sh
pnpm import:curriculum /absolute/path/verified.csv --metadata /absolute/path/metadata.json --output /absolute/path/candidate.json --check
pnpm import:curriculum /absolute/path/verified.csv --metadata /absolute/path/metadata.json --output /absolute/path/candidate.json
```

The importer checks duplicate IDs/orders, date validity, types, safe HTTPS URLs without credentials, canonical LeetCode problem destinations, and matching slugs. It derives a LeetCode slug only from an explicitly supplied verified URL; it never derives titles, ordering, difficulty, or destinations. Non-navigation JSON properties are discarded. Writes use a temporary file followed by an atomic rename, so parse/validation failures do not truncate the existing snapshot.

## Review checklist for future updates

1. Verify the current public source's exact row order and grouping. Record a new version and verification date.
2. Retain IDs. Never reuse an old ID for another source row. A changed sheet should get an explicit migration rather than silently detaching historical attempts.
3. Verify destination links. Use official practice pages when a platform mapping is missing, misleading, or points to an editorial.
4. Leave unverified optional fields empty. Do not infer difficulty from topic or title.
5. Update the provenance sidecar and inspect the dataset diff. The importer validates structure; it cannot establish factual provenance on its own.
6. Run tests, typecheck, and the production build. Reload the unpacked extension to use the new bundled version. The importer never changes a user's stored progress.
