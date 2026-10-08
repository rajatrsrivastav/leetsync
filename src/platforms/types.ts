import type { CodeSnapshot, ProblemMetadata, SubmissionResult } from '../types';

/** Platform DOM and editor details never escape this boundary. */
export interface CodingPlatformAdapter {
  isSupportedPage(): boolean;
  getProblemMetadata(): Promise<ProblemMetadata>;
  getCurrentCode(): Promise<CodeSnapshot | null>;
  observeSubmission(callback: (submission: SubmissionResult) => void): () => void;
}
