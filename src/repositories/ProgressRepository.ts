import type { AppState } from '../types';
import { isDueOnOrBefore } from '../utils/date';
export class ProgressRepository {
  constructor(private state: AppState) {}
  completed() {
    return Object.values(this.state.progress).filter((p) => !!p.firstSolvedAt);
  }
  due(now = new Date()) {
    return this.completed()
      .filter((p) => isDueOnOrBefore(p.revisionDueAt, now))
      .sort((a, b) => a.revisionDueAt!.localeCompare(b.revisionDueAt!));
  }
}
