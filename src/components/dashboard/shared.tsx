import type { ReactNode } from 'react';

export const progressLabels: Record<string, string> = {
  not_started: 'Not attempted',
  in_progress: 'In progress',
  independent: 'Independent',
  assisted: 'Assisted',
  relearn: 'Relearn',
};

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  note,
  icon,
}: {
  label: string;
  value: number;
  unit: string;
  note: string;
  icon: ReactNode;
}) {
  return (
    <section className="stat panel">
      <div className="label">
        {label}
        {icon}
      </div>
      <div className="number">
        {value}
        <span>{unit}</span>
      </div>
      <p>{note}</p>
    </section>
  );
}
