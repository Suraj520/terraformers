import type { MissionState, Chapter, Resource, ModuleKind, RobotModule, Facility } from './types';
import { initialState } from './initialState';

export type Action =
 | {type:'NAVIGATE';chapter:Chapter}
 | {type:'ALLOCATE';resource:Resource;amount:number}
 | {type:'ADD_COMPONENT';kind:ModuleKind;component:string}
 | {type:'REMOVE_COMPONENT';kind:ModuleKind;component:string}
 | {type:'BUILD_MODULES'}
 | {type:'TEST_ROBOT'}
 | {type:'LAUNCH';number:1|2|3}
 | {type:'ASSEMBLE_MARS'}
 | {type:'SET_STRATEGY';strategy:string}
 | {type:'DEPLOY';facility:Facility}
 | {type:'COMPLETE_MISSION'}
 | {type:'RESET'};

const costs:Record<string,Partial<Record<Resource,number>>> = {
 camera:{electronics:8,sensors:5},computer:{electronics:12},radio:{electronics:7},arm:{metal:12,motors:6},
 drive:{metal:15,motors:12},battery:{power:12,electronics:5},balance:{sensors:7,electronics:3},
 wheels:{metal:8,motors:8},legs:{metal:14,motors:12},toolkit:{metal:8,electronics:4},shield:{protection:10,metal:5}
};
export const componentInfo:Record<string,{name:string;mass:number;energy:number;description:string}> = {
 camera:{name:'Vision camera',mass:2,energy:2,description:'Identifies landmarks and targets.'},computer:{name:'Mission computer',mass:3,energy:2,description:'Coordinates robot tasks.'},radio:{name:'Communications',mass:2,energy:1,description:'Shares status between modules.'},arm:{name:'Manipulator arm',mass:4,energy:2,description:'Handles construction tasks.'},drive:{name:'Drive assembly',mass:5,energy:3,description:'Provides ground mobility.'},battery:{name:'Battery pack',mass:4,energy:0,description:'Stores operational energy.'},balance:{name:'Balance sensors',mass:2,energy:1,description:'Helps maintain stability.'},wheels:{name:'Wheel kit',mass:3,energy:2,description:'Efficient travel on smooth terrain.'},legs:{name:'Leg kit',mass:5,energy:3,description:'Handles uneven terrain.'},toolkit:{name:'Service toolkit',mass:3,energy:1,description:'Supports inspection and repair.'},shield:{name:'Dust protection',mass:3,energy:0,description:'Reduces fictional dust wear.'}
};
const log=(s:MissionState,message:string):MissionState=>({...s,log:[message,...s.log].slice(0,80)});
const sumCost=(ids:string[])=>ids.reduce((acc,id)=>{for(const [r,n] of Object.entries(costs[id]||{})) acc[r as Resource]=(acc[r as Resource]||0)+n!;return acc;},{} as Partial<Record<Resource,number>>);
const canAfford=(s:MissionState,ids:string[])=>Object.entries(sumCost(ids)).every(([r,n])=>s.resources[r as Resource]>=n!);
const spend=(s:MissionState,ids:string[])=>{const c=sumCost(ids);const resources={...s.resources};for(const [r,n] of Object.entries(c))resources[r as Resource]-=n!;return resources;};

export function reducer(state:MissionState,action:Action):MissionState {
 switch(action.type){
  case 'RESET': return initialState;
  case 'NAVIGATE': return {...state,chapter:action.chapter};
  case 'ALLOCATE': {const next=state.resources[action.resource]+action.amount;if(next<0)return state;return log({...state,resources:{...state.resources,[action.resource]:next}},`${action.amount>0?'+':''}${action.amount} ${action.resource} allocated.`);}
  case 'ADD_COMPONENT': {const current=state.selectedComponents[action.kind];if(current.includes(action.component)||!canAfford(state,[action.component]))return state;const selectedComponents={...state.selectedComponents,[action.kind]:[...current,action.component]};const modules=state.modules.map(m=>m.kind===action.kind?{...m,components:selectedComponents[action.kind],mass:selectedComponents[action.kind].reduce((a,id)=>a+componentInfo[id].mass,0),testStatus:'untested' as const}:m);return log({...state,selectedComponents,modules,robotTestPassed:false,resources:spend(state,[action.component])},`${componentInfo[action.component].name} added to ${action.kind} module.`);}
  case 'REMOVE_COMPONENT': {const current=state.selectedComponents[action.kind];if(!current.includes(action.component))return state;const refund=sumCost([action.component]);const resources={...state.resources};for(const [r,n] of Object.entries(refund))resources[r as Resource]+=n!;const selectedComponents={...state.selectedComponents,[action.kind]:current.filter(x=>x!==action.component)};const modules=state.modules.map(m=>m.kind===action.kind?{...m,components:selectedComponents[action.kind],mass:selectedComponents[action.kind].reduce((a,id)=>a+componentInfo[id].mass,0),testStatus:'untested' as const}:m);return {...state,resources,selectedComponents,modules,robotTestPassed:false};}
  case 'BUILD_MODULES': {if(state.modules.length)return state;const make=(kind:ModuleKind):RobotModule=>{const ids=state.selectedComponents[kind];return{id:kind==='upper'?'rahu-01':'ketu-01',kind,name:kind==='upper'?'Rahu':'Ketu',components:ids,mass:ids.reduce((a,id)=>a+componentInfo[id].mass,0),energy:100,condition:100,testStatus:'untested',assembled:false};};const modules=[make('upper'),make('lower')];return log({...state,modules,chapter:'vab-lab'},'Rahu and Ketu assembled in separate VAB bays.');}
  case 'TEST_ROBOT': {if(state.modules.length!==2)return state;const upper=state.modules.find(m=>m.kind==='upper')!;const lower=state.modules.find(m=>m.kind==='lower')!;const pass=upper.components.includes('camera')&&upper.components.includes('radio')&&lower.components.includes('drive')&&lower.components.includes('balance')&&lower.components.includes('battery');const testStatus:RobotModule['testStatus']=pass?'passed':'needs-revision';const modules=state.modules.map(m=>({...m,testStatus}));return log({...state,modules,robotTestPassed:pass},pass?'VAB integration test passed: mobility, vision, communications and energy checks complete.':'VAB test needs revision. Check camera, radio, drive, balance sensors and battery.');}
  case 'LAUNCH': {const m=state.manifests.find(x=>x.launchNumber===action.number)!;if(m.status==='delivered')return state;const payloadMass=action.number===1?state.modules.filter(x=>x.kind==='upper').reduce((a,x)=>a+x.mass,0):action.number===2?state.modules.filter(x=>x.kind==='lower').reduce((a,x)=>a+x.mass,0):12;const required=m.required+Math.max(0,Math.ceil(payloadMass/8)-1);const delivered=m.available>=required;const manifests=state.manifests.map(x=>x.launchNumber===action.number?{...x,payloadMass,required,status:delivered?'delivered' as const:'planning' as const}:x);const launchesDelivered=delivered?[...new Set([...state.launchesDelivered,action.number])]:state.launchesDelivered;return log({...state,manifests,launchesDelivered,chapter:action.number===3&&delivered?'power-maintenance':state.chapter},delivered?`Launch ${action.number} payload delivered to Mars (game simulation).`:`Launch ${action.number} needs more game performance margin. Reduce payload or revise the design.`);}
  case 'ASSEMBLE_MARS': {if(!state.launchesDelivered.includes(1)||!state.launchesDelivered.includes(2))return state;return log({...state,modulesAssembled:true,modules:state.modules.map(m=>({...m,assembled:true})),chapter:'power-maintenance'},'Rahu and Ketu located each other, aligned connectors and passed the Mars assembly check.');}
  case 'SET_STRATEGY': return {...state,navigationStrategy:action.strategy};
  case 'DEPLOY': {const f=action.facility;if(state.facilities.some(x=>x.type===f.type))return state;const resources={...state.resources};const cost=f.type==='solar'?{metal:12,electronics:5,power:5}:f.type==='charger'?{metal:8,electronics:8,power:8}:{metal:15,electronics:10,protection:5};for(const [r,n] of Object.entries(cost)){if(resources[r as Resource]<n)return log(state,`Not enough ${r} to deploy ${f.type}.`);resources[r as Resource]-=n;}const facilities=[...state.facilities,f];return log({...state,resources,facilities,solarDeployed:state.solarDeployed||f.type==='solar',chargerDeployed:state.chargerDeployed||f.type==='charger',maintenanceBuilt:state.maintenanceBuilt||f.type==='maintenance'},`${f.type} facility deployed at grid ${f.x}, ${f.y}.`);}
  case 'COMPLETE_MISSION': {const success=state.launchesDelivered.length===3&&state.modulesAssembled&&state.solarDeployed&&state.chargerDeployed&&state.maintenanceBuilt;return log({...state,missionStatus:success?'success':'incomplete',chapter:'mission-report'},success?'Mission readiness inspection passed. Mars outpost operational!':'Mission incomplete: deliver all three launches, assemble the crew and deploy solar, charging and maintenance facilities.');}
  default:return state;
 }
}
