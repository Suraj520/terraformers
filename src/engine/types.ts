export type Chapter = 'resource-yard'|'vab-lab'|'launch-design'|'mars-arrival'|'power-maintenance'|'mission-report';
export type Resource = 'metal'|'electronics'|'motors'|'sensors'|'power'|'protection'|'research';
export type ModuleKind = 'upper'|'lower';
export type TestStatus = 'untested'|'passed'|'needs-revision';
export interface RobotModule { id:string; kind:ModuleKind; name:string; components:string[]; mass:number; energy:number; condition:number; testStatus:TestStatus; assembled:boolean; }
export interface LaunchManifest { launchNumber:1|2|3; payloadItemIds:string[]; payloadMass:number; available:number; required:number; status:'planning'|'ready'|'launched'|'delivered'; }
export interface Facility { id:string; type:'solar'|'charger'|'maintenance'; x:number; y:number; condition:number; connected:boolean; }
export interface MissionState {
  chapter:Chapter; resources:Record<Resource,number>; modules:RobotModule[]; manifests:LaunchManifest[];
  facilities:Facility[]; mapRevealed:string[]; log:string[]; missionStatus:'active'|'success'|'incomplete';
  robotTestPassed:boolean; modulesAssembled:boolean; launchesDelivered:number[]; solarDeployed:boolean; chargerDeployed:boolean; maintenanceBuilt:boolean;
  selectedComponents:Record<ModuleKind,string[]>; navigationStrategy:string; missionName:string;
}
