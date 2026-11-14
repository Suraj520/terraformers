export function getUnlockedChapters(state) {
  return {
    'resource-yard': true,
    'vab-lab': state.modules.length > 0 || state.resources.research >= 0,
    'launch-design': state.robotTestPassed,
    'mars-arrival': state.launchesDelivered.includes(1) && state.launchesDelivered.includes(2),
    'power-maintenance': state.modulesAssembled,
    'mission-report': state.missionStatus !== 'active'
  };
}
export function calculateMissionProgress(state) {
  const milestones = [state.modules.length > 0, state.robotTestPassed, state.launchesDelivered.includes(1), state.launchesDelivered.includes(2), state.modulesAssembled, state.launchesDelivered.includes(3), state.solarDeployed, state.chargerDeployed, state.maintenanceBuilt];
  return Math.round(milestones.filter(Boolean).length / milestones.length * 100);
}
export function calculateTeacherMetrics(students) {
  const count = students.length;
  return { learners: count, missions: students.reduce((sum,s)=>sum+s.missions,0), averageMastery: count ? Math.round(students.reduce((sum,s)=>sum+s.mastery,0)/count) : 0, needsHelp: students.filter(s=>s.status==='Needs help').length };
}
