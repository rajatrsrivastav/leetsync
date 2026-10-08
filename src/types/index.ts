export type Confidence = 'independent' | 'assisted' | 'relearn';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type CurriculumProblem = {
  id: string;
  order: number;
  title: string;
  slug?: string;
  module: string;
  pattern?: string;
  difficulty?: Difficulty;
  platform: 'leetcode' | 'gfg' | 'other';
  problemUrl: string;
  sourceUrl?: string;
};
export type CurriculumData = {
  id: string;
  name: string;
  version: string;
  sourceUrl: string;
  verifiedAt: string;
  expectedCount: number;
  complete: boolean;
  problems: CurriculumProblem[];
};
export type CurriculumModule = { id: string; title: string; problems: CurriculumProblem[] };
export type AttemptStatus = 'ready' | 'active' | 'paused' | 'accepted' | 'completed' | 'abandoned';
export type Attempt = {
  id: string;
  curriculumId: string;
  problemId: string;
  kind: 'new' | 'revision';
  startedAt: string;
  completedAt?: string;
  acceptedAt?: string;
  activeSeconds: number;
  runningSince?: string;
  status: AttemptStatus;
  submissionCount: number;
  submissionIds: string[];
  hintsUsed: number;
  editorialViewed: boolean;
  solutionViewed: boolean;
  confidence?: Confidence;
  language?: string;
  code?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  notes?: string;
  completionSource?: 'detected' | 'manual';
};
export type ProblemProgress = {
  problemId: string;
  state: 'not_started' | 'in_progress' | Confidence;
  attemptIds: string[];
  firstSolvedAt?: string;
  lastSolvedAt?: string;
  revisionDueAt?: string;
  revisionIntervalDays?: number;
  successfulRevisions: number;
  bestTimeSeconds?: number;
  lastConfidence?: Confidence;
};
export type ProgressState = Record<string, ProblemProgress>;
export type DailyActivity = {
  date: string;
  goal: number;
  attemptIds: string[];
  problemIds: string[];
};
export type QueueItem = { problemId: string; kind: 'new' | 'revision'; reason: string };
export type DailyQueue = { date: string; items: QueueItem[] };
export type Settings = {
  onboardingComplete: boolean;
  dailyGoal: number;
  primaryLanguage: string;
  curriculumId: string;
  timerBehavior: 'manual';
  showPattern: boolean;
  revisionScheduling: boolean;
  debug: boolean;
  theme: 'system' | 'dark' | 'light';
  github: {
    enabled: boolean;
    repository: string;
    branch: string;
    autoCommit: boolean;
    includeMetadata: boolean;
    updateReadme: boolean;
  };
};
export type SyncJob = {
  id: string;
  attemptId: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  lastError?: string;
  commitUrl?: string;
  updatedAt: string;
};
export type AppState = {
  schemaVersion: 1;
  settings: Settings;
  attempts: Record<string, Attempt>;
  progress: ProgressState;
  activities: Record<string, DailyActivity>;
  queues: Record<string, DailyQueue>;
  syncJobs: Record<string, SyncJob>;
  activeAttemptId?: string;
};
export type Reflection = {
  confidence: Confidence;
  timeComplexity?: string;
  spaceComplexity?: string;
  notes?: string;
  code?: string;
  language?: string;
  hintsUsed?: number;
};
export type Guidance = { pattern?: string; questions?: string[]; strongHint?: string };
export type SubmissionResult = {
  id: string;
  verdict:
    | 'accepted'
    | 'wrong_answer'
    | 'tle'
    | 'runtime_error'
    | 'compile_error'
    | 'memory_limit'
    | 'output_limit'
    | 'internal_error'
    | 'unknown';
  observedAt: string;
  code?: string;
  language?: string;
  problemSlug?: string;
};
export type CodeSnapshot = {
  code: string;
  language: string;
  source: 'submission' | 'editor' | 'manual';
};
export type ProblemMetadata = { slug: string; title: string; url: string; difficulty?: Difficulty };
