import { useState } from 'react';
import { Search } from 'lucide-react';
import type { AppState, CurriculumProblem } from '../../types';
import { curriculum } from '../../domain/curriculum/Striver180CurriculumProvider';
import { ProgressRepository } from '../../repositories/ProgressRepository';
import { ExternalLink, ProgressBar } from '../ui';
import { PageHeading, progressLabels } from './shared';

export function Curriculum({
  state,
  onSelect,
}: {
  state: AppState;
  onSelect: (p: CurriculumProblem) => void;
}) {
  const [query, setQuery] = useState('');
  const completed = new ProgressRepository(state).completed().length;
  return (
    <>
      <PageHeading
        eyebrow="THE ROAD AHEAD"
        title="Striver 180"
        description={`${curriculum.getProblems().length} problems. ${curriculum.getModules().length} modules. One deliberate journey.`}
      />
      <section className="panel">
        <div className="flex justify-between small" style={{ marginBottom: 13 }}>
          <span>Overall progress</span>
          <span>
            {completed} / {curriculum.getProblems().length}
          </span>
        </div>
        <ProgressBar value={completed} max={curriculum.getProblems().length} />
        <div className="curriculum-toolbar">
          <Search size={15} className="quiet" />
          <input
            aria-label="Search curriculum"
            placeholder="Search problems, patterns, topics…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ExternalLink href={curriculum.data.sourceUrl}>Original sheet</ExternalLink>
        </div>
        <div className="legend">
          {Object.entries(progressLabels).map(([id, label]) => (
            <span key={id}>
              <i className={`status-dot ${id}`} />
              {label}
            </span>
          ))}
          <span>♻ Revision due</span>
        </div>
        <p className="small">
          Curriculum metadata by TakeUForward · verified {curriculum.data.verifiedAt}. Explanations
          and solutions remain with their original authors.
        </p>
      </section>
      <div style={{ marginTop: 24 }}>
        {curriculum.getModules().map((m, i) => {
          const problems = m.problems.filter((p) =>
            `${p.title} ${p.pattern} ${p.module}`.toLowerCase().includes(query.toLowerCase()),
          );
          if (!problems.length) return null;
          return (
            <details className="curriculum-module" key={m.id} open={query ? true : undefined}>
              <summary>
                {String(i + 1).padStart(2, '0')} · {m.title}
                <small>
                  {m.problems.filter((p) => state.progress[p.id]?.firstSolvedAt).length} /{' '}
                  {m.problems.length}
                </small>
              </summary>
              {problems.map((p) => {
                const progress = state.progress[p.id],
                  due =
                    progress?.revisionDueAt && progress.revisionDueAt <= new Date().toISOString();
                return (
                  <button className="problem-row" key={p.id} onClick={() => onSelect(p)}>
                    <span>{due ? '♻' : <i className={`status-dot ${progress?.state}`} />}</span>
                    <span className="order">{String(p.order).padStart(3, '0')}</span>
                    <span>
                      {p.title}
                      <span className="row-pattern">
                        {p.pattern}
                        {p.platform !== 'leetcode' ? ' · External practice / manual tracking' : ''}
                      </span>
                    </span>
                    <span className="state-label">
                      {progressLabels[progress?.state ?? 'not_started']}
                    </span>
                  </button>
                );
              })}
            </details>
          );
        })}
      </div>
    </>
  );
}
