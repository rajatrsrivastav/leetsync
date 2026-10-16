import type { ComplexityAnalysis } from '../types';
/** Local observations, not a parser or proof. Never synthesize an asymptotic bound from loop counts. */
export function codeFingerprint(code: string, language: string): string {
  // Identity marker only, not a cryptographic authenticity claim.
  let hash = 2166136261;
  for (const char of `${language}\0${code}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${code.length}:${(hash >>> 0).toString(16)}`;
}
export function analyzeComplexity(code: string, language: string): ComplexityAnalysis {
  const reasoning: string[] = [];
  const variables: string[] = [];
  const parameters = /def\s+\w+\s*\(([^)]*)\)|function\s*\w*\s*\(([^)]*)\)/.exec(code);
  for (const item of (parameters?.[1] ?? parameters?.[2] ?? '').split(',')) {
    const name = item.trim().split(/[:=]/)[0]?.trim();
    if (name && name !== 'self' && /^\w+$/.test(name))
      variables.push(`${name}: define its size and how it can vary independently`);
  }
  const loops = (code.match(/\b(for|while)\b/g) ?? []).length;
  if (loops)
    reasoning.push(
      `Found ${loops} loop keyword(s). Trace iteration bounds and nesting; sequential loops add work, while dependent inner bounds require summation.`,
    );
  if (/\b(sort|sorted)\s*\(/.test(code))
    reasoning.push(
      'A sorting call may be present. Check the language implementation, comparator cost, and temporary memory.',
    );
  if (/\b(append|push|add|insert)\s*\(/.test(code))
    reasoning.push(
      'A collection may grow. Count the maximum live elements and distinguish output space from auxiliary space.',
    );
  reasoning.push(
    'Trace calls and repeated subproblems. Include recursive stack depth and the cost of library operations.',
  );
  return {
    method: 'local-heuristic',
    codeFingerprint: codeFingerprint(code, language),
    reviewed: false,
    variables,
    reasoning,
    uncertainty: [
      'Time and space bounds are undetermined. Keyword matches can occur in comments or strings and do not establish control flow.',
      'This local inspection cannot prove complexity. Define input sizes, worst-case work, and peak live memory; manually review any bounds you enter.',
    ],
  };
}
