import type { SubmissionResult } from '../../types';
const verdicts: Record<number, SubmissionResult['verdict']> = {
  10: 'accepted',
  11: 'wrong_answer',
  12: 'memory_limit',
  13: 'output_limit',
  14: 'tle',
  15: 'runtime_error',
  16: 'internal_error',
  20: 'compile_error',
};
export function normalizeCheck(raw: unknown): SubmissionResult['verdict'] | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return r.state === 'SUCCESS' && typeof r.status_code === 'number'
    ? (verdicts[r.status_code] ?? null)
    : null;
}
export function verifiedSource(
  raw: unknown,
  id: string,
  slug: string,
  submittedAt: string,
): { code: string; language: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as {
    data?: {
      submissionDetails?: {
        id?: unknown;
        code?: unknown;
        statusCode?: unknown;
        timestamp?: unknown;
        lang?: { name?: unknown };
        question?: { titleSlug?: unknown };
      };
    };
  };
  const d = r.data?.submissionDetails;
  if (
    !d ||
    String(d.id) !== id ||
    d.statusCode !== 10 ||
    d.question?.titleSlug !== slug ||
    typeof d.code !== 'string' ||
    !d.code.trim() ||
    d.code.length > 200_000 ||
    typeof d.lang?.name !== 'string' ||
    !d.lang.name
  )
    return null;
  const timestamp = Number(d.timestamp) * 1000;
  if (
    !Number.isFinite(timestamp) ||
    timestamp < Date.parse(submittedAt) - 60_000 ||
    timestamp > Date.now() + 60_000
  )
    return null;
  return { code: d.code, language: d.lang.name };
}
/** Authenticated same-origin requests only; no cookies or session secrets cross the page bridge. */
export async function verifySubmission(
  id: string,
  slug: string,
  submittedAt: string,
  fetcher: typeof fetch = fetch,
): Promise<SubmissionResult | null> {
  if (!/^\d{1,20}$/.test(id)) throw new Error('Invalid submission ID.');
  const response = await fetcher(`https://leetcode.com/submissions/detail/${id}/check/`, {
    credentials: 'same-origin',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok)
    throw new Error('LeetCode verification is unavailable. Keep this submission for recovery.');
  const verdict = normalizeCheck(await response.json());
  if (!verdict) return null;
  let source: { code: string; language: string } | null = null;
  if (verdict === 'accepted') {
    try {
      const csrf =
        typeof document === 'undefined'
          ? undefined
          : /(?:^|;\s*)csrftoken=([^;]*)/.exec(document.cookie)?.[1];
      const details = await fetcher('https://leetcode.com/graphql/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRFToken': decodeURIComponent(csrf) } : {}),
        },
        redirect: 'error',
        body: JSON.stringify({
          query:
            'query DSACommitSubmission($submissionId: Int!) { submissionDetails(submissionId: $submissionId) { id code statusCode timestamp lang { name } question { titleSlug } } }',
          variables: { submissionId: Number(id) },
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (details.ok) source = verifiedSource(await details.json(), id, slug, submittedAt);
    } catch {
      /* Acceptance can be saved without a reliable code capture. */
    }
  }
  return {
    id: `leetcode:submission:${id}`,
    verdict,
    problemSlug: slug,
    observedAt: new Date().toISOString(),
    submittedAt,
    ...(source ? { ...source, codeProvenance: 'server-verified' as const } : {}),
  };
}
