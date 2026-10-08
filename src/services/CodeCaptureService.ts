import type { CodingPlatformAdapter } from '../platforms/types';
import type { CodeSnapshot, SubmissionResult } from '../types';

/** Capture failure must never prevent saving the attempt or its reflection. */
export class CodeCaptureService {
  constructor(private readonly adapter: CodingPlatformAdapter) {}

  async captureCurrent(): Promise<CodeSnapshot | null> {
    try {
      return await this.adapter.getCurrentCode();
    } catch {
      return null;
    }
  }

  /** Never replace accepted source with a possibly edited current editor. */
  captureAccepted(submission: SubmissionResult): CodeSnapshot | null {
    if (submission.verdict !== 'accepted' || !submission.code?.trim()) return null;
    return {
      code: submission.code,
      language: submission.language || 'unknown',
      source: 'submission',
    };
  }

  manual(code: string, language: string): CodeSnapshot | null {
    if (!code.trim() || code.length > 200_000) return null;
    return { code, language: language.trim() || 'unknown', source: 'manual' };
  }
}
