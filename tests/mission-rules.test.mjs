import test from 'node:test';
import assert from 'node:assert/strict';
import { getUnlockedChapters, calculateMissionProgress, calculateTeacherMetrics } from '../src/learning/mission-rules.mjs';
const base={modules:[],resources:{research:0},robotTestPassed:false,launchesDelivered:[],modulesAssembled:false,missionStatus:'active',solarDeployed:false,chargerDeployed:false,maintenanceBuilt:false};
test('mission chapters unlock only after their required checks',()=>{
  const initial=getUnlockedChapters(base); assert.equal(initial['resource-yard'],true);assert.equal(initial['launch-design'],false);assert.equal(initial['mars-arrival'],false);
  const launched={...base,robotTestPassed:true,launchesDelivered:[1,2]};const next=getUnlockedChapters(launched);assert.equal(next['launch-design'],true);assert.equal(next['mars-arrival'],true);assert.equal(next['power-maintenance'],false);
});
test('mission progress is a percentage of nine milestones',()=>{
  assert.equal(calculateMissionProgress(base),0);
  assert.equal(calculateMissionProgress({...base,modules:[{id:'r1'}],robotTestPassed:true,launchesDelivered:[1,2]}),44);
});
test('teacher metrics summarize learner data and handle an empty class',()=>{
  const metrics=calculateTeacherMetrics([{missions:2,mastery:80,status:'On track'},{missions:1,mastery:40,status:'Needs help'}]);
  assert.deepEqual(metrics,{learners:2,missions:3,averageMastery:60,needsHelp:1});
  assert.deepEqual(calculateTeacherMetrics([]),{learners:0,missions:0,averageMastery:0,needsHelp:0});
});
