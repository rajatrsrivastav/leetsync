import type { AppState } from '../types';
import { localDate } from '../utils/date';
export class DailyActivityRepository {
  constructor(private state: AppState) {}
  today(now = new Date()) {
    return this.state.activities[localDate(now)];
  }
  count(now = new Date()) {
    return this.today(now)?.problemIds.length ?? 0;
  }
}
