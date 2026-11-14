/** Integration boundary for a future school-managed backend. No authentication is implemented in this prototype. */
export type PlatformRole = 'student' | 'teacher' | 'school_admin';
export type AgeBand = '9-11' | '12-13' | '14-15';
export type Concept = 'forces' | 'gravity' | 'orbits' | 'energy' | 'thermal' | 'structures' | 'robotics';
export interface LearnerProgress { learnerId: string; classId: string; missionId: string; completedAt?: string; conceptEvidence: Partial<Record<Concept, number>>; misconceptions: string[]; }
export interface MissionAssignment { id: string; classId: string; createdBy: string; missionId: string; ageBand: AgeBand; dueAt?: string; status: 'draft'|'published'|'closed'; }
export interface SessionPrincipal { subject: string; role: PlatformRole; schoolId: string; classIds: string[]; }
export interface ClassroomApi { getClassProgress(classId: string): Promise<LearnerProgress[]>; createAssignment(input: Omit<MissionAssignment,'id'>): Promise<MissionAssignment>; }
/** Enforce authorization on the server for every read/write; never trust a client-supplied role or class ID. */
export const SECURITY_BOUNDARY = 'The browser prototype has no real identity, authorization, roster, or cloud persistence. The future API must derive permissions from a verified session and school tenancy.';
