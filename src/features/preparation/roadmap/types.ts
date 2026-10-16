export const ROADMAP_TRACKS = {
  os: 'Operating Systems',
  dbms: 'DBMS & SQL',
  cn: 'Computer Networks',
  oop: 'OOP',
  hld: 'System Design (HLD)',
  lld: 'Low-Level Design',
  aptitude: 'Aptitude',
  interviews: 'Interview preparation',
} as const;
export type RoadmapTrack = keyof typeof ROADMAP_TRACKS;
export type RoadmapLevel = 'Foundation' | 'Intermediate' | 'Advanced';
export type PracticeKind = 'Explain' | 'Code' | 'Design' | 'Practice';
export type RoadmapLink = {
  /** Section or page name shown next to the publisher, e.g. "§ C. Synchronization & Deadlock". */
  label: string;
  url: string;
  /** Publisher or platform name, e.g. "System Design Primer". */
  source: string;
};
export type RoadmapTopic = {
  id: string;
  track: RoadmapTrack;
  /** Position inside the track; stage 1 across all tracks precedes stage 2. */
  stage: number;
  title: string;
  level: RoadmapLevel;
  minutes: number;
  prerequisites: string[];
  /** Resource library entry this topic belongs to. */
  resourceId: string;
  learn: RoadmapLink;
  practice: RoadmapLink & { prompt: string; kind: PracticeKind };
  verifiedAt: string;
};
export type RoadmapAssignment = {
  id: string;
  topicId: string;
  assignedOn: string;
  kind: 'new' | 'review';
};
export type RoadmapUnderstanding = 'not-rated' | 'needs-work' | 'some-support' | 'independent';
export type RoadmapPracticeResult = 'not-attempted' | 'partial' | 'completed';
export type RoadmapResponse = {
  assignmentId: string;
  topicId: string;
  recordedAt: string;
  status: 'draft' | 'completed' | 'revision';
  understanding: RoadmapUnderstanding;
  practiceResult: RoadmapPracticeResult;
  minutes: number;
  notes: string;
};
export type RoadmapState = {
  version: 1;
  /** Local date → the assignment shown on that day. Carried-over assignments keep their id. */
  days: Record<string, RoadmapAssignment>;
  /** Assignment id → the latest recorded response (drafts are replaceable; outcomes are final). */
  responses: Record<string, RoadmapResponse>;
  /** Topic id → ISO timestamp the bookmark was saved. */
  bookmarks?: Record<string, string>;
};
export type RoadmapAction =
  | { type: 'prepRoadmapToday' }
  | { type: 'prepRoadmapRecord'; response: Omit<RoadmapResponse, 'recordedAt'> }
  | { type: 'prepRoadmapBookmark'; topicId: string; bookmarked: boolean };
