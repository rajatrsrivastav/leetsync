import type { AppState } from '../../types';
import { addLocalDays, localDate } from '../../utils/date';

export function ActivityCalendar({ state }: { state: AppState }) {
  const now = new Date();
  const start = addLocalDays(now, -(26 * 7 - 1));
  const days = Array.from({ length: 182 }, (_, i) => localDate(addLocalDays(start, i)));
  return (
    <>
      <div className="calendar-labels">
        <span>{start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
        <span>{now.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
      </div>
      <div
        className="calendar"
        role="img"
        aria-label="Daily local DSA activity for the past 26 weeks"
      >
        {days.map((d) => {
          const a = state.activities[d],
            n = a?.problemIds.length ?? 0;
          return (
            <i
              key={d}
              title={`${d}: ${n} meaningful solves`}
              className={n >= (a?.goal ?? state.settings.dailyGoal) ? 'level2' : n ? 'level1' : ''}
            />
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>Built from your local practice.</span>
        <span>Quiet · Some progress · Goal met</span>
      </div>
    </>
  );
}
