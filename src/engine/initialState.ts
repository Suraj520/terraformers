import type { MissionState } from './types';
export const initialState: MissionState = {
  chapter:'resource-yard',
  resources:{metal:120,electronics:65,motors:48,sensors:40,power:55,protection:35,research:30},
  modules:[],
  manifests:[
    {launchNumber:1,payloadItemIds:[],payloadMass:0,available:10,required:7,status:'planning'},
    {launchNumber:2,payloadItemIds:[],payloadMass:0,available:10,required:7,status:'planning'},
    {launchNumber:3,payloadItemIds:[],payloadMass:0,available:10,required:6,status:'planning'}
  ],
  facilities:[],mapRevealed:['landing-zone'],log:['Mission initialized. Welcome, Junior Mission Architect.'],missionStatus:'active',
  robotTestPassed:false,modulesAssembled:false,launchesDelivered:[],solarDeployed:false,chargerDeployed:false,maintenanceBuilt:false,
  selectedComponents:{upper:[],lower:[]},navigationStrategy:'camera-inertial',missionName:'A New Dawn'
};
