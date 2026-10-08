import type { DailyActivity } from '../../types';
import { addDateKeyDays, addLocalDays, localDate } from '../../utils/date';

type Activities = Record<string, DailyActivity> | DailyActivity[];

/** A problem counts once per day, even if it was completed repeatedly. */
export function completedCount(activity?: DailyActivity): number {
  return new Set(activity?.problemIds ?? []).size;
}

export function isSuccessfulDay(activity?: DailyActivity): boolean {
  return Boolean(activity && activity.goal > 0 && completedCount(activity) >= activity.goal);
}

/** An unfinished today does not break yesterday's streak before today has ended. */
export function currentStreak(activities: Activities, now = new Date()): number {
  const byDate = new Map(Object.values(activities).map((activity) => [activity.date, activity]));
  let date = localDate(now);
  if (!isSuccessfulDay(byDate.get(date))) date = addDateKeyDays(date, -1);
  let streak = 0;
  while (isSuccessfulDay(byDate.get(date))) {
    streak += 1;
    date = addDateKeyDays(date, -1);
  }
  return streak;
}

/** Local calendar keys for the current Monday–Sunday week. */
export function weekDays(now = new Date()): string[] {
  const monday = addLocalDays(now, -((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, offset) => localDate(addLocalDays(monday, offset)));
}

export function weeklyCompleted(activities: Activities, now = new Date()): number {
  const byDate = new Map(Object.values(activities).map((activity) => [activity.date, activity]));
  return weekDays(now).reduce((sum, day) => sum + completedCount(byDate.get(day)), 0);
}
