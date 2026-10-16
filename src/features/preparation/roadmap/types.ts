export const ROADMAP_TRACKS = {
  os: 'OS', dbms: 'DBMS & SQL', cn: 'Computer Networks', oop: 'OOP',
  hld: 'HLD', lld: 'LLD', aptitude: 'Aptitude', interviews: 'Interview preparation',
} as const;
export type RoadmapTrack = keyof typeof ROADMAP_TRACKS;
export type RoadmapTopic = {
  id: string; track: RoadmapTrack; title: string; level: 'Foundation' | 'Intermediate' | 'Advanced';
  minutes: number; prerequisites: string[]; resourceId: string;
  learn: { label: string; url: string };
  practice: { prompt: string; url: string; kind: 'Explain' | 'Code' | 'Design' | 'Practice'; note?: string };
  verifiedAt: string;
};
export type RoadmapAssignment = {
  id: string; topicId: string; assignedOn: string; kind: 'new' | 'review';
};
export type RoadmapResponse = {
  assignmentId: string; topicId: string; recordedAt: string;
  status: 'draft' | 'completed' | 'revision';
  understanding: 'not-rated' | 'needs-work' | 'some-support' | 'independent';
  practiceResult: 'not-attempted' | 'partial' | 'completed';
  minutes: number; notes: string;
};
export type RoadmapState = {
  version: 1;
  days: Record<string, RoadmapAssignment>;
  responses: Record<string, RoadmapResponse>;
};
export type RoadmapAction =
  | { type: 'prepRoadmapToday' }
  | { type: 'prepRoadmapRecord'; response: Omit<RoadmapResponse, 'recordedAt'> };
