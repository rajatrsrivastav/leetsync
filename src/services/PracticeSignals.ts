import type { AppState, CurriculumProblem } from '../types';
/** Evidence-based ranking only; absence of history is never classified as weakness. */
export function practiceSignals(state: AppState, problem: CurriculumProblem) {
  const history = Object.values(state.attempts)
    .filter((a) => a.problemId === problem.id && a.status === 'completed')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const reasons: string[] = [];
  const latest = history[0];
  if (!latest) return { score: 0, reasons };
  let score = 0;
  if (latest.confidence === 'relearn') {
    score += 6;
    reasons.push('Last reflection requested relearning');
  }
  if (latest.hintsUsed || latest.editorialViewed || latest.solutionViewed) {
    score += 3;
    reasons.push('Last solve used help');
  }
  if (latest.kind === 'revision' && latest.confidence !== 'independent') {
    score += 4;
    reasons.push('Recall needed support');
  }
  const timed = history
    .slice(1)
    .map((a) => a.activeSeconds)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (timed.length >= 2 && latest.activeSeconds > timed[Math.floor(timed.length / 2)]! * 1.5) {
    score += 2;
    reasons.push('Slower than your previous timed solves');
  }
  const mistakes = latest.learning?.mistakes ?? [];
  if (mistakes.some((m) => history.slice(1).some((a) => a.learning?.mistakes?.includes(m)))) {
    score += 2;
    reasons.push('A self-reported mistake repeated');
  }
  return { score, reasons };
}
