import type { RoadmapAction, RoadmapState } from './roadmap/types';
export const SUBJECTS = {
  dsa: 'DSA & coding',
  os: 'Operating Systems',
  dbms: 'DBMS',
  networks: 'Computer Networks',
  oop: 'OOP',
  sql: 'SQL',
  system: 'System Design',
  aptitude: 'Aptitude',
  interviews: 'Interviews',
  company: 'Company Preparation',
} as const;
export type SubjectId = keyof typeof SUBJECTS;
export type Role = 'software' | 'backend' | 'fullstack' | 'analyst';
export type Resource = {
  title: string;
  url: string;
  publisher: string;
  verifiedAt: string;
  verification: 'verified' | 'restricted';
  note?: string;
};
export type Question = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};
export type Lesson = {
  id: string;
  subject: SubjectId;
  title: string;
  summary: string;
  minutes: number;
  level: 'Foundation' | 'Practice' | 'Interview';
  prerequisites: string[];
  roles: Role[];
  concept: string;
  explanation: string[];
  example: string;
  questions: string[];
  practice: string;
  checkpoints: string[];
  resources: Resource[];
  quiz?: Question[];
};
export type PreparationProfile = {
  minutesPerDay: number;
  targetDate?: string;
  role: Role;
  subjects: SubjectId[];
  weakSubjects: SubjectId[];
  goal: string;
  aiContextOptIn: boolean;
};
export type StudySession = {
  id: string;
  lessonId: string;
  startedAt: string;
  runningSince?: string;
  seconds: number;
  status: 'active' | 'paused' | 'completed';
  completedAt?: string;
  confidence?: 'independent' | 'assisted' | 'relearn';
  reflection?: string;
  answers?: Record<string, number>;
  score?: number;
  total?: number;
};
export type LessonProgress = {
  lessonId: string;
  sessionIds: string[];
  lastCompletedAt?: string;
  confidence?: 'independent' | 'assisted' | 'relearn';
  dueAt?: string;
  intervalDays: number;
  independentReviews: number;
};
export type PlanTask = {
  id: string;
  kind: 'dsa' | 'learn' | 'review';
  lessonId?: string;
  problemId?: string;
  title: string;
  subject: SubjectId;
  minutes: number;
  reason: string;
};
export type PreparationPlan = {
  date: string;
  budget: number;
  tasks: PlanTask[];
  generatedAt: string;
};
export type ResourceProgressEntry = {
  id: string;
  resourceId: string;
  topic: string;
  subject: SubjectId;
  completed: boolean;
  minutes: number;
  studiedAt: string;
};
export type ResourceTracking = {
  resources: Record<string, { bookmarked: boolean; lastVisitedAt?: string }>;
  entries: Record<string, ResourceProgressEntry>;
};
export type PreparationState = {
  version: 1;
  profile: PreparationProfile;
  progress: Record<string, LessonProgress>;
  sessions: Record<string, StudySession>;
  plans: Record<string, PreparationPlan>;
  activeSessionId?: string;
  resourceTracking?: ResourceTracking;
  roadmap?: RoadmapState;
};
export type PreparationAction =
  | RoadmapAction
  | { type: 'prepResourceVisit'; resourceId: string }
  | { type: 'prepResourceBookmark'; resourceId: string; bookmarked: boolean }
  | { type: 'prepResourceProgress'; entry: ResourceProgressEntry }
  | { type: 'prepProfile'; profile: PreparationProfile }
  | { type: 'prepPlan'; refresh?: boolean }
  | { type: 'prepStart'; lessonId: string; sessionId: string }
  | { type: 'prepPause'; sessionId: string }
  | { type: 'prepResume'; sessionId: string }
  | { type: 'prepAnswer'; sessionId: string; questionId: string; answer: number }
  | {
      type: 'prepComplete';
      sessionId: string;
      confidence: 'independent' | 'assisted' | 'relearn';
      reflection: string;
    };
