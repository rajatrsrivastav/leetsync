import type { PreparationAction } from '../features/preparation/types';
import type { Reflection, Settings, SubmissionResult } from '../types';
export type Command =
  | PreparationAction
  | { type: 'getState' }
  | { type: 'importBackup'; text: string }
  | { type: 'exportRecovery' }
  | { type: 'beginCapture'; requestId: string; slug: string; code: string; language: string }
  | { type: 'identifyCapture'; requestId: string; submissionId: string }
  | { type: 'resolveCapture'; requestId: string; result: SubmissionResult }
  | { type: 'captureRecovery'; requestId: string; error: string }
  | { type: 'retryCapture'; requestId: string }
  | { type: 'recoverCode'; attemptId: string; code: string; language: string; confirmed: boolean }
  | { type: 'prepare'; problemId: string; open?: boolean }
  | {
      type: 'start' | 'pause' | 'hint' | 'editorial' | 'solution' | 'abandon' | 'manualAccept';
      attemptId: string;
      level?: number;
    }
  | { type: 'submission'; attemptId: string; result: SubmissionResult }
  | { type: 'complete'; attemptId: string; reflection: Reflection }
  | { type: 'settings'; settings: Settings; token?: string }
  | { type: 'schedule' | 'resetProgress'; problemId: string }
  | { type: 'retrySync'; attemptId: string }
  | { type: 'validateGithub' }
  | { type: 'disconnectGithub' }
  | { type: 'openDashboard'; section?: string };
