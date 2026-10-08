import type { AppState } from '../types';
export class AttemptRepository {
  constructor(private state: AppState) {}
  forProblem(problemId: string) {
    return Object.values(this.state.attempts)
      .filter((a) => a.problemId === problemId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  current() {
    return this.state.activeAttemptId ? this.state.attempts[this.state.activeAttemptId] : undefined;
  }
}
