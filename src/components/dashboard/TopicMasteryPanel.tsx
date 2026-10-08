import { ArrowUpRight } from 'lucide-react';
import type { TopicMastery } from '../../domain/progress';
import { ProgressBar } from '../ui';

export function TopicMasteryPanel({
  topics,
  onViewCurriculum,
}: {
  topics: TopicMastery[];
  onViewCurriculum: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Topic mastery</h3>
        <button className="text-button small" onClick={onViewCurriculum}>
          View curriculum
          <ArrowUpRight size={12} />
        </button>
      </div>
      <MasteryRows topics={topics.slice(0, 8)} />
      {topics.length > 8 && (
        <details className="mastery-note">
          <summary className="quiet">Show {topics.length - 8} more topics</summary>
          <MasteryRows topics={topics.slice(8)} />
        </details>
      )}
      <details className="mastery-note">
        <summary className="quiet">How is mastery measured?</summary>
        <p>
          Independent / assisted / relearn solves begin at 80 / 50 / 20 points. Hints, editorials,
          solutions, failed submissions, and slower solves reduce that score. Independent revisions
          add up to 20 points. Topic scores average all problems, including unattempted ones at
          zero.
        </p>
      </details>
    </section>
  );
}

function MasteryRows({ topics }: { topics: TopicMastery[] }) {
  return topics.map((topic) => (
    <div className="mastery-row" key={topic.topic}>
      <div>
        <span>{topic.topic}</span>
        <span>{topic.mastery}%</span>
      </div>
      <ProgressBar value={topic.mastery} max={100} />
    </div>
  ));
}
