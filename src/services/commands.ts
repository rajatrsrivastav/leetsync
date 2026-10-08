import type { Reflection, Settings, SubmissionResult } from '../types';
export type Command =
  | { type: 'getState' }
  | { type: 'prepare'; problemId: string; open?: boolean }
  | {
      type: 'start' | 'pause' | 'hint' | 'editorial' | 'solution' | 'abandon' | 'manualAccept';
      attemptId: string;
    }
  | { type: 'submission'; attemptId: string; result: SubmissionResult }
  | { type: 'complete'; attemptId: string; reflection: Reflection }
  | { type: 'settings'; settings: Settings; token?: string }
  | { type: 'schedule' | 'resetProgress'; problemId: string }
  | { type: 'retrySync'; attemptId: string }
  | { type: 'validateGithub' }
  | { type: 'disconnectGithub' }
  | { type: 'openDashboard'; section?: string };
