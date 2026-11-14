import type { MissionState, Chapter } from '../engine/types';
export function getUnlockedChapters(state: MissionState): Record<Chapter, boolean>;
export function calculateMissionProgress(state: MissionState): number;
export function calculateTeacherMetrics(students: {missions:number;mastery:number;status:string}[]): {learners:number;missions:number;averageMastery:number;needsHelp:number};
