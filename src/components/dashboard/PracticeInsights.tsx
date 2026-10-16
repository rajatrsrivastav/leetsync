import type { AppState, CurriculumProblem } from '../../types';
import { practiceSignals } from '../../services/PracticeSignals';
export function PracticeInsights({
  state,
  problems,
}: {
  state: AppState;
  problems: CurriculumProblem[];
}) {
  const groups = new Map<string, { score: number; count: number; reasons: Set<string> }>();
  for (const p of problems) {
    const signal = practiceSignals(state, p);
    if (!signal.score) continue;
    const key = p.pattern ?? p.module;
    const group = groups.get(key) ?? { score: 0, count: 0, reasons: new Set<string>() };
    group.score += signal.score;
    group.count++;
    signal.reasons.forEach((x) => group.reasons.add(x));
    groups.set(key, group);
  }
  const rows = [...groups].sort((a, b) => b[1].score - a[1].score).slice(0, 4);
  if (!rows.length) return null;
  return (
    <section className="panel">
      <h3>Where to practice next</h3>
      <p className="small">
        Signals from your completed attempts, not a diagnosis of ability. Due revisions use these
        signals; new questions stay in curriculum order.
      </p>
      {rows.map(([name, g]) => (
        <p key={name}>
          <strong>{name}</strong> · {g.count} problem{g.count === 1 ? '' : 's'}
          <br />
          <span className="small">{[...g.reasons].join(' · ')}</span>
        </p>
      ))}
    </section>
  );
}
