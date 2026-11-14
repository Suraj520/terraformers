import { useEffect, useMemo, useReducer, useState } from 'react';
import { Activity, BatteryCharging, Bot, Check, ChevronRight, CircleHelp, Compass, Cpu, Gauge, Hammer, Map, Package, Play, Rocket, RotateCcw, Save, Shield, Sun, Wrench, Orbit, GraduationCap, Sparkles, FlaskConical, X, BookOpen, CloudSun, RefreshCw, Wind, Thermometer } from 'lucide-react';
import { reducer, componentInfo, type Action } from './engine/reducer';
import { initialState } from './engine/initialState';
import type { Chapter, MissionState, Resource, ModuleKind } from './engine/types';
import PlanetScene from './learning/PlanetScene';
import { heatModel, orbitModel, roverModel, rocketModel, solarModel, structureModel, momentumModel } from './learning/physics-core.mjs';
import { calculateMissionProgress, getUnlockedChapters } from './learning/mission-rules.mjs';

const SAVE_KEY='mars-swarm-save-v1';
type AppChapter = Chapter | 'mars-ready';
const chapters:{id:AppChapter;name:string;sub:string;icon:any}[]=[
 {id:'resource-yard',name:'Resource Yard',sub:'Plan your inventory',icon:Package},
 {id:'vab-lab',name:'VAB Robotics Lab',sub:'Build and test robots',icon:Bot},
 {id:'launch-design',name:'Launch Design',sub:'Plan three payloads',icon:Rocket},
 {id:'mars-arrival',name:'Mars Arrival',sub:'Navigate and assemble',icon:Compass},
 {id:'power-maintenance',name:'Power & Maintenance',sub:'Build the outpost',icon:Sun},
 {id:'mission-report',name:'Mission Report',sub:'Review your mission',icon:Activity},
 {id:'mars-ready',name:'Mars Is Ready',sub:'A new home for humanity',icon:Sparkles}
];
const resourceMeta:Record<Resource,{label:string;icon:string}>={metal:{label:'Metal',icon:'◆'},electronics:{label:'Electronics',icon:'⌁'},motors:{label:'Motors & joints',icon:'⚙'},sensors:{label:'Sensors',icon:'◎'},power:{label:'Power units',icon:'ϟ'},protection:{label:'Thermal & dust protection',icon:'⬡'},research:{label:'Research points',icon:'✳'}};
const resourceAnimationFiles:Record<string,string>={budget:'renders/00_starting_budget/00_starting_budget_frame.mp4',metal:'renders/01_metal/01_metal_frame.mp4',electronics:'renders/02_electronics/02_electronics_frame.mp4',motors:'renders/03_motors_joints/03_motors_joints_frame.mp4',sensors:'renders/04_sensors/04_sensors_frame.mp4',power:'renders/05_power_units/05_power_units_frame.mp4',protection:'renders/06_thermal_dust/06_thermal_dust_frame.mp4',research:'renders/07_research_points/07_research_points_frame.mp4'};
function ResourceAnimation({file,label}:{file:string;label:string}){const [failed,setFailed]=useState(false);return <div className="resource-animation" style={{width:"100%",height:220,marginBottom:14,overflow:"hidden",borderRadius:8,background:"#17232b",display:"flex",alignItems:"center",justifyContent:"center"}}>{failed?<div className="resource-animation-fallback" style={{color:"#a9b9b8",fontSize:12}}>{label}</div>:<video className="resource-animation-video" style={{display:"block",width:"100%",height:"100%",objectFit:"contain"}} autoPlay loop muted playsInline preload="metadata" aria-label={`${label} animation`} onError={()=>setFailed(true)}><source src={`/resource-animations/${file}`} type="video/mp4"/></video>}</div>}
const componentGroups:{kind:ModuleKind;title:string;ids:string[]}[]=[{kind:'upper',title:'RAHU · UPPER MODULE',ids:['camera','computer','radio','arm','toolkit','shield']},{kind:'lower',title:'KETU · LOWER MODULE',ids:['drive','battery','balance','wheels','legs','shield']}];
const vabModuleAnimationFiles:Record<ModuleKind,string>={
 upper:'renders/02_vab_modules/rahu_upper_module/rahu_upper_module_frame.mp4',
 lower:'renders/02_vab_modules/ketu_lower_module/ketu_lower_module_frame.mp4'
};
function ModuleAssemblyAnimation({kind}:{kind:ModuleKind}){
 const [failed,setFailed]=useState(false);
 const label=kind==='upper'?'Rahu assembled upper module':'Ketu assembled lower module';
 return <section className="module-assembly-preview" style={{marginTop:18,padding:16,borderRadius:12,background:'#101d27',border:'1px solid rgba(91,190,207,.28)'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:12}}>
   <div><span className="eyebrow">ALL COMPONENTS SELECTED</span><h4 style={{margin:'5px 0 0',color:'#edf5f5'}}>{kind==='upper'?'RAHU · ASSEMBLED UPPER MODULE':'KETU · ASSEMBLED LOWER MODULE'}</h4></div>
   <span style={{fontSize:11,letterSpacing:'.08em',color:'#67d6c1'}}>ASSEMBLY READY</span>
  </div>
  {failed?<div style={{padding:24,textAlign:'center',color:'#a9b9b8',background:'#17232b',borderRadius:8}}>Animation not found. Check the video path: <code>{vabModuleAnimationFiles[kind]}</code></div>:<video key={kind} style={{display:'block',width:'100%',height:300,objectFit:'contain',background:'#07111a',borderRadius:8}} autoPlay loop muted playsInline controls preload="metadata" aria-label={`${label} assembly animation`} onError={()=>setFailed(true)}><source src={`/resource-animations/${vabModuleAnimationFiles[kind]}`} type="video/mp4"/></video>}
  <p style={{margin:'10px 0 0',fontSize:12,color:'#a9b9b8'}}>The selected components are shown assembled into the complete {kind==='upper'?'upper':'lower'} module.</p>
 </section>;
}

type InSightWeatherSol = {
 AT?: { av?: number; mn?: number; mx?: number };
 PRE?: { av?: number; mn?: number; mx?: number };
 HWS?: { av?: number; mn?: number; mx?: number };
 WD?: { most_common?: { compass_point?: string } };
 First_UTC?: string;
 Last_UTC?: string;
 Season?: string;
};
type InSightWeatherPayload = Record<string, any> & { sol_keys?: string[] };
const WEATHER_CACHE_KEY='mars-swarm-insight-weather-v1';
const WEATHER_CACHE_MS=60*60*1000;
function MarsWeatherPanel(){
 const [weather,setWeather]=useState<{sol:string;data:InSightWeatherSol;cachedAt:number}|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [lastChecked,setLastChecked]=useState<number|null>(null);
 const apiKey=(import.meta as any).env?.VITE_NASA_API_KEY||'DEMO_KEY';
 const loadWeather=async(force=false)=>{
  setError('');
  if(!force){
   try{
    const raw=localStorage.getItem(WEATHER_CACHE_KEY);
    if(raw){const cached=JSON.parse(raw);if(cached?.sol&&cached?.data){setWeather(cached);setLastChecked(cached.cachedAt||null);if(Date.now()-(cached.cachedAt||0)<WEATHER_CACHE_MS){setLoading(false);return;}}}
   }catch{/* Ignore a damaged local cache and request fresh data. */}
  }
  setLoading(true);
  try{
   const url=new URL('https://api.nasa.gov/insight_weather/');
   url.searchParams.set('api_key',apiKey);url.searchParams.set('feedtype','json');url.searchParams.set('ver','1.0');
   const response=await fetch(url.toString(),{headers:{Accept:'application/json'}});
   if(!response.ok)throw new Error(`NASA returned HTTP ${response.status}`);
   const payload:InSightWeatherPayload=await response.json();
   const keys=Array.isArray(payload.sol_keys)?payload.sol_keys:[];
   const available=keys.map(String).filter(k=>payload[k]&&typeof payload[k]==='object');
   if(!available.length)throw new Error('NASA returned no Sol observations. The retired lander may no longer be publishing this feed.');
   const sol=available[available.length-1];
   const record={sol,data:payload[sol] as InSightWeatherSol,cachedAt:Date.now()};
   setWeather(record);setLastChecked(record.cachedAt);
   try{localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify(record));}catch{/* Weather display still works if storage is unavailable. */}
  }catch(e){
   setError(e instanceof Error?e.message:'Unable to load Mars weather.');
  }finally{setLoading(false);}
 };
 useEffect(()=>{void loadWeather();},[]);
 const value=(n:number|undefined,digits=1)=>typeof n==='number'&&Number.isFinite(n)?n.toFixed(digits):'—';
 const date=weather?.data.Last_UTC?new Date(weather.data.Last_UTC).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):null;
 return <section className="mars-weather-panel" aria-label="Mars weather observations" style={{margin:'0 0 20px',padding:'14px 18px',borderRadius:14,border:'1px solid rgba(105,190,210,.28)',background:'linear-gradient(110deg,rgba(12,35,48,.97),rgba(24,30,43,.96))',boxShadow:'0 8px 24px rgba(0,0,0,.16)'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:12}}>
   <div style={{display:'flex',alignItems:'center',gap:10}}><span style={{width:34,height:34,borderRadius:10,display:'grid',placeItems:'center',background:'rgba(239,128,76,.14)',color:'#ffad7c'}}><CloudSun size={19}/></span><div><div style={{fontSize:12,fontWeight:850,letterSpacing:'.12em',color:'#e9f4f5'}}>MARS WEATHER <span style={{color:'#f1ad79'}}>· INSIGHT ARCHIVE</span></div><div style={{fontSize:11,color:'#9fb4bc',marginTop:3}}>Elysium Planitia · Latest available lander observation</div></div></div>
   <button type="button" onClick={()=>void loadWeather(true)} disabled={loading} style={{display:'inline-flex',alignItems:'center',gap:7,padding:'7px 10px',borderRadius:8,border:'1px solid rgba(130,190,205,.3)',background:'rgba(255,255,255,.04)',color:'#dcebed',fontSize:11,cursor:loading?'wait':'pointer'}}><RefreshCw size={13} style={{animation:loading?'mars-weather-spin 1s linear infinite':'none'}}/> {loading?'UPDATING':'REFRESH'}</button>
  </div>
  {weather? <>
   <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:11}}><span style={{fontSize:11,fontWeight:800,color:'#ffd1a8',background:'rgba(239,128,76,.12)',padding:'4px 8px',borderRadius:6}}>SOL {weather.sol}</span><span style={{fontSize:11,color:'#a9bdc3'}}>{date?`Observation date: ${date}`:'Observation date not supplied'}</span><span style={{fontSize:10,color:'#829ba4'}}>· Historical data, not live weather</span></div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(135px,1fr))',gap:9}}>
    <WeatherMetric icon={<Thermometer size={16}/>} label="AIR TEMPERATURE" value={`${value(weather.data.AT?.av)} °C`} detail={weather.data.AT?.mn!==undefined&&weather.data.AT?.mx!==undefined?`Min ${value(weather.data.AT.mn)}° · Max ${value(weather.data.AT.mx)}°`:'Average, if reported'}/>
    <WeatherMetric icon={<Gauge size={16}/>} label="AIR PRESSURE" value={typeof weather.data.PRE?.av==='number'?`${value(weather.data.PRE.av/100,1)} hPa`:'—'} detail={typeof weather.data.PRE?.av==='number'?`${value(weather.data.PRE.av,0)} Pa average`:'No pressure reading'}/>
    <WeatherMetric icon={<Wind size={16}/>} label="WIND SPEED" value={`${value(weather.data.HWS?.av)} m/s`} detail={weather.data.WD?.most_common?.compass_point?`Common direction ${weather.data.WD.most_common.compass_point}`:'Direction not reported'}/>
   </div>
   <div style={{fontSize:10,color:'#839da5',marginTop:10}}>NASA/JPL InSight archive · Values may be missing because of sensor gaps. {lastChecked?`Checked ${new Date(lastChecked).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.`:''} <a href="https://mars.nasa.gov/insight/weather/" target="_blank" rel="noreferrer" style={{color:'#8ed8e4'}}>Weather archive</a></div>
  </>:<div style={{padding:'10px 12px',borderRadius:9,background:'rgba(255,255,255,.035)',color:'#b7c9ce',fontSize:12}}>{loading?'Contacting NASA’s InSight weather archive…':`Weather observations are unavailable. ${error||'The feed returned no usable data.'}`}<div style={{marginTop:6,color:'#8fa7ae'}}>InSight’s mission ended in December 2022, so this panel can show only archived observations—not live Martian weather.</div></div>}
  <style>{`@keyframes mars-weather-spin{to{transform:rotate(360deg)}} .app-shell .mars-weather-panel :is(h1,h2,h3,h4,h5,h6,p,span,b,strong,small,label,li,a,button){background-image:none!important;animation:none!important;-webkit-text-fill-color:initial!important;}`}</style>
 </section>;
}
function WeatherMetric({icon,label,value,detail}:{icon:React.ReactNode;label:string;value:string;detail:string}){
 return <div style={{padding:'10px 11px',borderRadius:9,background:'rgba(4,15,24,.48)',border:'1px solid rgba(255,255,255,.055)',minWidth:0}}><div style={{display:'flex',alignItems:'center',gap:6,color:'#8dd5dc',fontSize:10,fontWeight:800,letterSpacing:'.08em'}}>{icon}{label}</div><div style={{fontSize:19,fontWeight:800,color:'#f2f6f5',marginTop:7,whiteSpace:'nowrap'}}>{value}</div><div style={{fontSize:10,color:'#9eb1b7',marginTop:4}}>{detail}</div></div>;
}

function App(){
 const [state,dispatch]=useReducer(reducer,initialState,()=>{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as MissionState:initialState;}catch{return initialState;}});
 const [showReset,setShowReset]=useState(false); const [glossary,setGlossary]=useState(false); const [toast,setToast]=useState(''); const [learningPanel,setLearningPanel]=useState<'explore'|'teacher'|null>(null); const [showChapter7,setShowChapter7]=useState(false); const [showNasaResources,setShowNasaResources]=useState(false);
 useEffect(()=>{localStorage.setItem(SAVE_KEY,JSON.stringify(state));},[state]);
 const notify=(message:string)=>{setToast(message);window.setTimeout(()=>setToast(''),2400);};
 const unlocked=useMemo(()=>({...getUnlockedChapters(state),'mars-ready':state.missionStatus==='success'}),[state]);
 const go=(target:AppChapter)=>{if(!unlocked[target]){notify(target==='mars-ready'?'Complete the Mars outpost readiness inspection to unlock Chapter 7.':'Complete the previous mission checks to unlock this chapter.');return;}if(target==='mars-ready'){setShowChapter7(true);return;}setShowChapter7(false);dispatch({type:'NAVIGATE',chapter:target});};
 const act=(action:Action)=>dispatch(action);
 const progress=calculateMissionProgress(state);
 const selectedChapter:AppChapter=showChapter7?'mars-ready':state.chapter;
 const chapter=chapters.find(c=>c.id===selectedChapter)!;
 return <div className="app-shell"><style>{`
/* Seven-colour rainbow typography across the Terraformers interface. */
.app-shell :is(h1,h2,h3,h4,h5,h6,p,span,b,strong,small,label,li,a,button,th,td,dt,dd,legend,summary,figcaption,.eyebrow,.subtle-label,.side-label,.rail-title,.version,.brand-name,.brand-sub,.chapter-copy,.resource-count,.resource-available,.hero-kicker,.log-title,.log-line,.metric-row,.facility-cost,.arrival-step,.network-heading,.mission-log,.toast,.modal-head) {
  background-image: linear-gradient(90deg, #ff0000 0%, #ff7a00 16.66%, #ffe600 33.33%, #20c85a 50%, #168cff 66.66%, #5632c9 83.33%, #a900c8 100%);
  background-size: 300% 100%;
  background-repeat: no-repeat;
  background-position: 0% 50%;
  animation: mars-swarm-rainbow-slide 6s linear infinite;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  color: inherit;
}
@keyframes mars-swarm-rainbow-slide {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}
@media (prefers-reduced-motion: reduce) {
  .app-shell :is(h1,h2,h3,h4,h5,h6,p,span,b,strong,small,label,li,a,button,th,td,dt,dd,legend,summary,figcaption,.eyebrow,.subtle-label,.side-label,.rail-title,.version,.brand-name,.brand-sub,.chapter-copy,.resource-count,.resource-available,.hero-kicker,.log-title,.log-line,.metric-row,.facility-cost,.arrival-step,.network-heading,.mission-log,.toast,.modal-head) {
    animation: none;
  }
}
/* Preserve functional indicators, icons, media and form controls. */
.app-shell svg, .app-shell video, .app-shell canvas, .app-shell input, .app-shell textarea, .app-shell select, .app-shell option {
  background-image: none !important;
  -webkit-text-fill-color: initial !important;
}
.app-shell span:empty {
  background-image: none !important;
  -webkit-text-fill-color: initial !important;
}
`}</style>
  <header className="topbar"><div className="brand"><div className="brand-mark"><Bot size={21}/></div><div><div className="brand-name">MARS<span>SWARM</span></div><div className="brand-sub">JUNIOR ASTRONAUT BUILDER</div></div></div><div className="top-center"><span className="live-dot"/> MISSION ACTIVE <span className="top-divider">/</span> {state.missionName.toUpperCase()} <span className="demo-mode-pill">DEMO · LOCAL ONLY</span></div><div className="top-actions"><button className="hub-btn" onClick={()=>setLearningPanel('explore')} title="3D explorer and physics lab"><Orbit size={15}/> <span>EXPLORE</span></button><button className="hub-btn teacher-hub-btn" onClick={()=>setLearningPanel('teacher')} title="Teacher command centre"><GraduationCap size={15}/> <span>TEACHER</span></button><button className="hub-btn" onClick={()=>setShowNasaResources(true)} title="NASA and space-agency learning resources"><BookOpen size={15}/> <span>NASA DATA</span></button><button className="icon-btn" onClick={()=>setGlossary(true)} title="Glossary"><CircleHelp size={18}/></button><button className="icon-btn" onClick={()=>notify('Progress saved automatically in this browser.')} title="Save status"><Save size={18}/></button><button className="icon-btn" onClick={()=>setShowReset(true)} title="Reset mission"><RotateCcw size={17}/></button></div></header>
  <div style={{padding:"14px 22px 0"}}><MarsWeatherPanel/></div>
  <div className="app-body"><aside className="sidebar"><div className="side-label">MISSION CONTROL</div><div className="chapter-list">{chapters.map((c,i)=>{const Icon=c.icon;const active=selectedChapter===c.id;return <button key={c.id} className={`chapter-link ${active?'active':''} ${unlocked[c.id]?'':'locked'}`} onClick={()=>go(c.id)}><span className="chapter-icon"><Icon size={17}/></span><span className="chapter-copy"><b>{String(i+1).padStart(2,'0')} · {c.name}</b><small>{c.sub}</small></span>{active?<span className="active-arrow"><ChevronRight size={16}/></span>:unlocked[c.id]&&i!==0?<Check size={15} className="done-icon"/>:null}</button>})}</div><div className="sidebar-bottom"><div className="progress-head"><span>MISSION PROGRESS</span><b>{progress}%</b></div><div className="progress-track"><div style={{width:`${progress}%`}}/></div><div className="side-foot"><span className="green-dot"/> LOCAL SAVE ENABLED</div><div className="version">MARS SWARM · BUILD 0.1.0</div></div></aside>
  <main className="main-content"><div className="page-heading"><div><div className="eyebrow">CHAPTER {chapters.findIndex(c=>c.id===selectedChapter)+1} / 7 <span>·</span> {chapter.name.toUpperCase()}</div><h1>{chapter.name}</h1><p>{chapterDescription(selectedChapter)}</p></div><div className="heading-tag"><span className="green-dot"/> SIMULATION READY</div></div>
   {state.chapter==='resource-yard'&&<ResourceYard state={state} act={act}/>}
   {state.chapter==='vab-lab'&&<VAB state={state} act={act}/>}
   {state.chapter==='launch-design'&&<Launch state={state} act={act}/>}
   {state.chapter==='mars-arrival'&&<MarsArrival state={state} act={act}/>}
   {state.chapter==='power-maintenance'&&<Power state={state} act={act}/>}
   {state.chapter==='mission-report'&&!showChapter7&&<Report state={state} act={act}/>}
   {selectedChapter==='mars-ready'&&<MarsReadyChapter onBack={()=>go('mission-report')}/>}
   <div className="mission-log"><div className="log-title"><span><Activity size={15}/> MISSION LOG</span><span>LIVE FEED</span></div><div className="log-entries">{state.log.slice(0,3).map((line,i)=><div className="log-line" key={`${line}-${i}`}><span className="log-time">{String(23-i).padStart(2,'0')}:4{8-i}</span>{line}</div>)}</div></div>
  </main><aside className="right-rail"><div className="rail-card"><div className="rail-title">RESOURCE INVENTORY <Package size={15}/></div><div className="resource-list">{(Object.keys(resourceMeta) as Resource[]).map(r=><div className="resource-row" key={r}><span className="resource-symbol">{resourceMeta[r].icon}</span><span>{resourceMeta[r].label}</span><b>{state.resources[r]}</b></div>)}</div><div className="rail-note">Available resources · Game units</div></div><div className="rail-card status-card"><div className="rail-title">MISSION STATUS <Activity size={15}/></div><StatusRow label="Robot modules" done={state.modules.length>0}/><StatusRow label="VAB integration" done={state.robotTestPassed}/><StatusRow label="Launch campaign" done={state.launchesDelivered.length===3}/><StatusRow label="Mars assembly" done={state.modulesAssembled}/><StatusRow label="Power network" done={state.solarDeployed&&state.chargerDeployed}/><StatusRow label="Maintenance hub" done={state.maintenanceBuilt}/></div><div className="rail-tip"><div className="tip-icon"><Shield size={18}/></div><b>ENGINEERING NOTE</b><p>All launch performance values are fictional game units. This educational simulation is not a real mission design or flight feasibility tool.</p></div></aside></div>
  {toast&&<div className="toast">{toast}</div>}{showReset&&<div className="modal-backdrop"><div className="modal"><h2>Reset mission?</h2><p>This will erase your saved progress in this browser and restore the deterministic starting inventory.</p><div className="modal-actions"><button className="btn-secondary" onClick={()=>setShowReset(false)}>Cancel</button><button className="btn-danger" onClick={()=>{dispatch({type:'RESET'});setShowReset(false);notify('New mission started.');}}>Reset mission</button></div></div></div>}{glossary&&<Glossary onClose={()=>setGlossary(false)}/>} {learningPanel&&<LearningHub mode={learningPanel} onClose={()=>setLearningPanel(null)}/>} {showNasaResources&&<NASAResources onClose={()=>setShowNasaResources(false)}/>}
 </div>
}
type LearningPanelMode='explore'|'teacher';
function LearningHub({mode,onClose}:{mode:LearningPanelMode;onClose:()=>void}){
 const [tab,setTab]=useState<'world'|'physics'>(mode==='teacher'?'world':'world');
 const [planet,setPlanet]=useState('Mars');
 const [experiment,setExperiment]=useState<'launch'|'rover'|'solar'|'orbit'|'heat'|'structure'|'momentum'>('launch');
 const [ageBand,setAgeBand]=useState<'9–11'|'12–13'|'14–15'>('12–13');
 const [orbitSpeed,setOrbitSpeed]=useState(2.5); const [velocity,setVelocity]=useState(4); const [insulation,setInsulation]=useState(75); const [supports,setSupports]=useState(3); const [load,setLoad]=useState(25); const [panelArea,setPanelArea]=useState(2);
 const [mass,setMass]=useState(5); const [thrust,setThrust]=useState(38); const [gravity,setGravity]=useState(3.71);
 const worlds=[{name:'Moon',g:1.62,desc:'Low gravity. A jump can carry an astronaut farther.',color:'moon'},{name:'Mars',g:3.71,desc:'Thin air, dusty ground and about 38% of Earth gravity.',color:'mars'},{name:'Earth',g:9.81,desc:'Our home world and the comparison baseline.',color:'earth'},{name:'Venus',g:8.87,desc:'Heavy atmosphere and extreme surface heat.',color:'venus'},{name:'Jupiter',g:24.79,desc:'A gas giant with enormous gravity; no solid surface to land on.',color:'jupiter'}];
 const selected=worlds.find(w=>w.name===planet)!; const rocket=rocketModel({massKg:mass,thrustN:thrust,gravityMs2:gravity}); const rover=roverModel({massKg:mass,motorForceN:thrust,slopeDegrees:gravity,gravityMs2:selected.g}); const solar=solarModel({sunlightPct:thrust,panelArea,demand:mass*10}); const orbit=orbitModel({speed:orbitSpeed,gravity:selected.g,radius:3}); const heat=heatModel({insulation,outsideTemp:-60,insideTemp:20}); const structure=structureModel({supportCount:supports,load}); const momentum=momentumModel({massKg:mass,velocityMs:velocity}); const weight=rocket.weightN; const net=rocket.netForceN; const lift=rocket.liftsOff;

 return <div className="learning-overlay"><div className="learning-shell"><header className="learning-head"><div className="learning-brand"><div className="learning-brand-icon">{mode==='teacher'?<GraduationCap/>:<Orbit/>}</div><div><span>{mode==='teacher'?'MISSION CONTROL FOR EDUCATORS':'THE SPACE EXPLORER'}</span><h2>{mode==='teacher'?'Teacher Command Centre':'Explore the Solar System'}</h2></div></div><div className="learning-head-actions"><span className="demo-tag">{mode==='teacher'?'DEMO CLASS DATA':'INTERACTIVE LEARNING'}</span><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18}/></button></div></header>
 {mode==='explore'?<><div className="learning-tabs"><button className={tab==='world'?'selected':''} onClick={()=>setTab('world')}><Orbit size={15}/> 3D WORLD</button><button className={tab==='physics'?'selected':''} onClick={()=>setTab('physics')}><FlaskConical size={15}/> PHYSICS PLAYGROUND</button></div>
 {tab==='world'?<div className="explorer-layout"><section className="world-view-card"><div className="world-view-top"><div><span className="mini-eyebrow">PLANETARY FIELD TRIP</span><h3>{planet} <small>· {selected.g.toFixed(2)} m/s² gravity</small></h3></div><span className="live-pill">3D VIEW</span></div><PlanetScene planet={planet}/><div className="world-side-caption">Rover Rahu-01 · A draggable, real-time WebGL scene. Drag to orbit; use + / − to zoom.</div></section><aside className="world-side"><div className="world-side-card"><span className="mini-eyebrow">CHOOSE YOUR DESTINATION</span><div className="planet-picker">{worlds.map(w=><button key={w.name} className={planet===w.name?'active':''} onClick={()=>{setPlanet(w.name);setGravity(w.g);}}><span className={`planet-dot ${w.color}`}/>{w.name}<ChevronRight size={13}/></button>)}</div></div><div className="world-side-card fact-card"><Sparkles size={18}/><b>SPACE FACT</b><p>{selected.desc}</p><div className="age-band-picker"><span>LEARNING LEVEL</span>{(['9–11','12–13','14–15'] as const).map(a=><button className={ageBand===a?'active':''} onClick={()=>setAgeBand(a)} key={a}>{a}</button>)}</div><div className="fact-number">{(selected.g/9.81*100).toFixed(0)}% <small>of Earth's gravity</small></div></div><div className="world-side-card challenge-card"><span className="mini-eyebrow">QUICK CHALLENGE</span><b>Would your rover weigh the same here?</b><p>{ageBand==='9–11'?'Try the same rover on two worlds. Which one makes it feel heavier?':ageBand==='12–13'?'Compare the gravity values and predict how the same rover behaves on each world.':'Explain how changing local gravity affects weight while the rover’s mass stays constant.'}</p><button className="btn-primary full" onClick={()=>setTab('physics')}>Try the experiment <ChevronRight size={14}/></button></div></aside></div>:<div className="physics-layout"><section className="physics-controls"><div className="physics-title"><span className="mini-eyebrow">CHANGE THE INPUTS · SEE WHAT HAPPENS</span><h3>{experiment==='launch'?'Can your rocket lift off?':experiment==='rover'?'Can your rover climb?':experiment==='solar'?'Can sunlight power your base?':experiment==='orbit'?'Can a satellite stay in orbit?':experiment==='heat'?'Can your habitat stay warm?':experiment==='structure'?'Can your structure hold the load?':'How hard is it to stop a moving rover?'}</h3><p>Move the controls. The simulation updates instantly.</p></div><div className="experiment-tabs">{(['launch','rover','solar','orbit','heat','structure','momentum'] as const).map(x=><button className={experiment===x?'active':''} onClick={()=>setExperiment(x)} key={x}>{x==='launch'?'🚀 Rocket':x==='rover'?'🤖 Rover':x==='solar'?'☀️ Solar':x==='orbit'?'🪐 Orbit':x==='heat'?'🌡️ Heat':x==='structure'?'🏗️ Structure':'↗ Momentum'}</button>)}</div>{experiment==='launch'?<><SliderControl label="Rocket mass" value={mass} min={1} max={10} unit="kg (game model)" onChange={setMass}/><SliderControl label="Engine thrust" value={thrust} min={0} max={100} unit="N (game model)" onChange={setThrust}/><SliderControl label="Planet gravity" value={gravity} min={0.5} max={25} step={0.01} unit="m/s²" onChange={setGravity}/><div className="planet-shortcuts">{worlds.map(w=><button onClick={()=>setGravity(w.g)} key={w.name}>{w.name}</button>)}</div></>:experiment==='rover'?<><SliderControl label="Rover mass" value={mass} min={1} max={10} unit="kg (game model)" onChange={setMass}/><SliderControl label="Motor push" value={thrust} min={0} max={100} unit="N (game model)" onChange={setThrust}/><SliderControl label="Slope steepness" value={gravity} min={0.5} max={60} step={1} unit="degrees" onChange={setGravity}/></>:experiment==='solar'?<><SliderControl label="Sunlight" value={thrust} min={0} max={100} unit="%" onChange={setThrust}/><SliderControl label="Panel area" value={panelArea} min={1} max={10} unit="area units" onChange={setPanelArea}/><SliderControl label="Energy needed" value={mass*10} min={10} max={100} unit="energy points" onChange={v=>setMass(Math.max(1,Math.round(v/10)))}/><div className="solar-result"><div className="solar-sun">☀</div><div className="solar-rays"/><div><b>{solar.powered?'Power surplus!':'Not enough sunlight yet'}</b><p>{solar.powered?'Your panels collect enough energy for this activity.':'Try increasing sunlight or reducing energy use.'}</p></div></div></>:experiment==='orbit'?<><SliderControl label="Orbital speed index" value={orbitSpeed} min={0.5} max={6} step={0.1} unit="game units" onChange={setOrbitSpeed}/><p className="experiment-explainer">Try changing speed. Too slow and the satellite falls; in this toy model, a middle band looks orbit-like.</p></>:experiment==='heat'?<><SliderControl label="Insulation" value={insulation} min={0} max={100} unit="%" onChange={setInsulation}/><p className="experiment-explainer">Outside temperature: −60°C · Inside now: 20°C. More insulation slows heat transfer in this simplified model.</p></>:experiment==='structure'?<><SliderControl label="Support legs" value={supports} min={1} max={8} unit="supports" onChange={setSupports}/><SliderControl label="Structure load" value={load} min={5} max={100} unit="game units" onChange={setLoad}/><p className="experiment-explainer">Add supports or reduce the load. This is a simple classroom capacity model.</p></>:<><SliderControl label="Rover mass" value={mass} min={1} max={10} unit="kg (game model)" onChange={setMass}/><SliderControl label="Rover speed" value={velocity} min={0} max={20} unit="m/s (game model)" onChange={setVelocity}/><p className="experiment-explainer">Momentum = mass × velocity. A heavier or faster rover is harder to stop in this simple model.</p></>}
 <div className="science-note"><BookOpen size={15}/><span><b>Think like a scientist:</b> Change just one control at a time. Can you explain why the result changed?</span></div></section><section className="physics-visual"><div className="physics-visual-head"><span className="mini-eyebrow">LIVE SIMULATION</span><span className="live-pill">{experiment==='solar'?'ENERGY MODEL':experiment==='momentum'?'MOMENTUM MODEL':experiment==='orbit'?'ORBIT MODEL':experiment==='heat'?'HEAT MODEL':experiment==='structure'?'STRUCTURE MODEL':'FORCE MODEL'}</span></div>
 {experiment==='solar'?<div className="solar-stage"><div className="solar-sun-big">☀</div><div className="solar-panel-3d"><span/><span/><span/><span/></div><div className="solar-battery">▰ ▰ ▰<small>ENERGY STORE</small></div><div className="solar-beams">✦　 ✦　 ✦</div></div>:experiment==='orbit'?<div className="concept-visual orbit-visual"><div className="orbit-track"/><div className="orbit-world">{planet==='Mars'?'♂':'●'}</div><div className="orbit-satellite" style={{animationDuration:`${Math.max(1,7/orbitSpeed)}s`}}>◈</div><b>{orbit.status==='orbit-like'?'STABLE-LOOKING PATH':orbit.status==='falling'?'FALLING TOWARD WORLD':'MOVING AWAY'}</b></div>:experiment==='heat'?<div className="concept-visual heat-visual"><div className="heat-habitat"><span>HABITAT</span><b>{heat.nextTemp.toFixed(1)}°C</b></div><div className="heat-outside">−60°C OUTSIDE</div><div className="heat-insulation" style={{opacity:0.25+insulation/140}}/></div>:experiment==='structure'?<div className="concept-visual structure-visual"><div className="structure-roof"/><div className="structure-posts">{Array.from({length:supports},(_,i)=><i key={i}/>)}</div><div className="structure-load" style={{width:`${Math.min(100,load)}%`}}/></div>:experiment==='momentum'?<div className="concept-visual rover-visual"><div className="rover-mini">🤖</div><b>STOPPING CHALLENGE · {momentum.momentum.toFixed(1)} kg·m/s</b></div>:experiment==='rover'?<div className="concept-visual rover-visual"><div className="rover-mini">🤖</div><b>{rover.canClimb?'CLIMBING':'NEEDS MORE MOTOR FORCE'}</b></div>:<div className="launch-stage"><div className="launch-cloud cloud-one"/><div className="launch-cloud cloud-two"/><div className={`demo-rocket ${lift?'rocket-lift':''}`} style={{transform:`translate(-50%, ${lift?-Math.min(115,net*1.6):0}px)`}}><div className="rocket-nose"/><div className="rocket-fins"/><div className="rocket-window"/><div className="rocket-flame"/></div><div className="launch-ground"/><div className="launch-status">{lift?'LIFTOFF!':'NOT ENOUGH THRUST'}</div></div>}
 <div className="physics-metrics"><div><span>{experiment==='solar'?'ENERGY COLLECTED':experiment==='orbit'?'SPEED INDEX':experiment==='heat'?'INSULATION':experiment==='structure'?'SUPPORTS':experiment==='rover'?'MOTOR FORCE':'ENGINE THRUST'}</span><b>{experiment==='solar'?solar.collected.toFixed(0):experiment==='orbit'?orbitSpeed:experiment==='heat'?insulation:experiment==='structure'?supports:experiment==='momentum'?mass:thrust} <small>{experiment==='solar'?'pts':experiment==='orbit'?'index':experiment==='heat'?'%':experiment==='structure'?'legs':experiment==='momentum'?'kg':'N'}</small></b></div><div><span>{experiment==='solar'?'ENERGY NEEDED':experiment==='orbit'?'CIRCULAR SPEED INDEX':experiment==='heat'?'TEMP CHANGE':experiment==='structure'?'MODEL CAPACITY':experiment==='rover'?'UPHILL FORCE':'WEIGHT (MODEL)'}</span><b>{experiment==='solar'?mass*10:experiment==='orbit'?orbit.circularSpeedIndex.toFixed(1):experiment==='heat'?heat.transfer.toFixed(1):experiment==='structure'?structure.capacity:experiment==='momentum'?velocity:experiment==='rover'?rover.uphillForce.toFixed(1):weight.toFixed(1)} <small>{experiment==='solar'?'pts':experiment==='orbit'?'index':experiment==='heat'?'°C':experiment==='structure'?'units':experiment==='momentum'?'m/s':'N'}</small></b></div><div><span>RESULT</span><b>{experiment==='solar'?(solar.powered?'READY':'LOW'):experiment==='orbit'?orbit.status:experiment==='heat'?heat.nextTemp.toFixed(1)+'°C':experiment==='structure'?(structure.safe?'SAFE':'OVERLOAD'):experiment==='momentum'?momentum.momentum.toFixed(1)+' kg·m/s':experiment==='rover'?(rover.canClimb?'CLIMB':'STUCK'):(lift?'LIFTOFF':'HOLD')}</b></div></div>
 <div className={`physics-verdict ${(experiment==='solar'?solar.powered:experiment==='orbit'?orbit.status==='orbit-like':experiment==='structure'?structure.safe:experiment==='momentum'?momentum.momentum<35:experiment==='rover'?rover.canClimb:experiment==='heat'?insulation>=50:lift)?'good':'warn'}`}>{experiment==='solar'?(solar.powered?'Your solar array can meet the energy demand.':'Your base needs more energy than it collects.'):experiment==='orbit'?`The toy model predicts a ${orbit.status} path. Real orbits need much more precise physics.`:experiment==='heat'?`The habitat temperature changes by ${heat.transfer.toFixed(1)}°C in this model. Better insulation slows the change.`:experiment==='structure'?(structure.safe?'The support capacity is enough for this load.':'The load is above the model capacity. Add supports or reduce the load.'):experiment==='momentum'?`The rover has ${momentum.momentum.toFixed(1)} kg·m/s of momentum in this model. More mass or speed means more momentum to change.`:experiment==='rover'?(rover.canClimb?'Motor force is greater than the uphill force.':'The rover needs more motor force for this slope.'):(lift?'Thrust is greater than weight in this simplified model.':'The rocket needs more thrust to lift off in this simplified model.')}</div></section></div>}
 <div className="learning-footnote">Learning model only. Values are simplified for ages 9–15 and are not engineering, launch, navigation or planetary-surface predictions.</div></>:<div className="teacher-dashboard">
 <section className="teacher-panel" style={{marginBottom:22,padding:24,background:'linear-gradient(135deg,rgba(18,43,57,.98),rgba(13,25,37,.98))',border:'1px solid rgba(93,190,207,.28)',borderRadius:16}}>
  <span className="mini-eyebrow">THE CULTURAL INSPIRATION BEHIND THE MISSION</span>
  <h3 style={{margin:'8px 0 10px',fontSize:25,color:'#f1f7f7'}}>RAHU + KETU: TWO HALVES, ONE JOURNEY</h3>
  <p style={{maxWidth:980,lineHeight:1.7,color:'#c5d4d7',margin:'0 0 18px'}}>Terraformers borrows the names Rahu and Ketu from Hindu mythology and Jyotisha (traditional Indian astrology). In the project story, two separately delivered robot modules must find one another and reunite on Mars—an imaginative engineering parallel to the myth of Rahu and Ketu’s separation.</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:14,marginBottom:18}}>
   <article style={{padding:16,borderRadius:12,background:'rgba(5,17,27,.62)',border:'1px solid rgba(255,255,255,.08)'}}>
    <div style={{fontSize:12,letterSpacing:'.12em',color:'#69d7d0',fontWeight:800}}>RAHU · THE HEAD</div>
    <h4 style={{margin:'7px 0',color:'#f0f6f6'}}>Perception and decisions</h4>
    <p style={{margin:0,color:'#bdcbcf',lineHeight:1.6,fontSize:13}}>In our fictional mission, Rahu is the upper robot module: cameras, computing, radio communication, and a manipulator arm. It observes the environment, interprets information, communicates, and helps make decisions.</p>
   </article>
   <article style={{padding:16,borderRadius:12,background:'rgba(5,17,27,.62)',border:'1px solid rgba(255,255,255,.08)'}}>
    <div style={{fontSize:12,letterSpacing:'.12em',color:'#ff9a65',fontWeight:800}}>KETU · THE BODY</div>
    <h4 style={{margin:'7px 0',color:'#f0f6f6'}}>Movement and energy</h4>
    <p style={{margin:0,color:'#bdcbcf',lineHeight:1.6,fontSize:13}}>Ketu is the lower robot module: drive systems, wheels or legs, balance sensors, and batteries. It provides mobility, stability, and stored energy so the system can move across the Martian surface.</p>
   </article>
  </div>
  <div style={{padding:16,borderRadius:12,background:'rgba(7,19,29,.72)',borderLeft:'3px solid #e7a64b',marginBottom:18}}>
   <h4 style={{margin:'0 0 7px',color:'#f4d39b'}}>The Hindu myth: how Rahu and Ketu became separate</h4>
   <p style={{margin:0,color:'#d0dadd',lineHeight:1.7,fontSize:13}}>In a well-known account associated with the Samudra Manthana—the churning of the cosmic ocean—an asura named Svarbhanu disguises himself to receive amrita, the nectar of immortality. Surya (the Sun) and Chandra (the Moon) reveal the disguise. Vishnu, in the form of Mohini, cuts Svarbhanu in two with the Sudarshana Chakra after he has tasted the nectar. The immortal head becomes Rahu and the body becomes Ketu. In the story, they pursue the Sun and Moon; this is one traditional mythic explanation for eclipses.</p>
  </div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:14,marginBottom:18}}>
   <article style={{padding:15,borderRadius:12,background:'rgba(5,17,27,.55)'}}>
    <h4 style={{margin:'0 0 7px',color:'#f0f6f6'}}>What they mean in Jyotisha</h4>
    <p style={{margin:0,color:'#bdcbcf',fontSize:13,lineHeight:1.65}}>In Jyotisha, Rahu and Ketu are called chhaya grahas—“shadow planets”—but they are not physical planets. Astronomically, they correspond to the lunar nodes: the two points where the Moon’s orbital path crosses the ecliptic. They lie opposite one another. Astrological traditions interpret Rahu through themes such as desire, ambition, unfamiliar experiences, and worldly fascination; Ketu through detachment, release, introspection, and spiritual inquiry. Interpretations differ between traditions.</p>
   </article>
   <article style={{padding:15,borderRadius:12,background:'rgba(5,17,27,.55)'}}>
    <h4 style={{margin:'0 0 7px',color:'#f0f6f6'}}>A respectful science note</h4>
    <p style={{margin:0,color:'#bdcbcf',fontSize:13,lineHeight:1.65}}>Some people use Rahu and Ketu’s placements in a natal birth chart as a framework for reflecting on life themes and personal choices. These are cultural and astrological beliefs, not scientifically demonstrated forces that determine a person’s character, destiny, or life events. The game presents the tradition respectfully while keeping mythology, astrology, and astronomy distinct.</p>
   </article>
  </div>
  <div style={{height:1,background:'rgba(255,255,255,.12)',margin:'18px 0'}}/>
  <span className="mini-eyebrow">HOW THE MYTH INSPIRED OUR MARS SWARM STORY</span>
  <h4 style={{margin:'7px 0 14px',color:'#f1f7f7'}}>From separation to a self-sustaining outpost</h4>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10}}>
   {[
    {n:'01',t:'Separate launches',d:'Rahu’s upper module and Ketu’s lower module travel as separate payloads to Mars.'},
    {n:'02',t:'Autonomous rendezvous',d:'The two modules navigate, locate one another, and assemble into a capable robotic system.'},
    {n:'03',t:'Build the power base',d:'The swarm deploys solar arrays, connects power electronics, and establishes charging bays so robots can recharge in sequence.'},
    {n:'04',t:'Maintain the swarm',d:'Robots construct maintenance facilities, inspect one another, replace parts, and keep essential equipment operational.'},
    {n:'05',t:'Grow food and prepare',d:'The outpost develops controlled-environment agriculture, water recovery, life support, habitats, and safety systems.'},
    {n:'06',t:'Invite humans when ready',d:'Only after sustained testing of power, food, water, shelter, communications, and emergency systems does the story progress to human arrival.'}
   ].map(step=><article key={step.n} style={{padding:13,borderRadius:11,background:'rgba(5,17,27,.62)',border:'1px solid rgba(255,255,255,.08)'}}>
    <span style={{fontSize:11,color:'#67d6c1',fontWeight:800,letterSpacing:'.12em'}}>MISSION STEP {step.n}</span>
    <h5 style={{margin:'6px 0',color:'#f0f6f6',fontSize:14}}>{step.t}</h5>
    <p style={{margin:0,color:'#bdcbcf',fontSize:12,lineHeight:1.55}}>{step.d}</p>
   </article>)}
  </div>
  <p style={{margin:'16px 0 0',fontSize:12,lineHeight:1.6,color:'#91a7ad'}}>The Rahu–Ketu connection is a creative naming and storytelling inspiration for this educational game. The real mission sequence is an imagined future scenario, not a claim that the myth describes robotics or space exploration.</p>
 </section>
 </div>}
 </div></div>;
}
function SliderControl({label,value,min,max,step=1,unit,onChange}:{label:string;value:number;min:number;max:number;step?:number;unit:string;onChange:(v:number)=>void}){return <label className="physics-slider"><span><b>{label}</b><small>{value.toFixed(step<1?2:0)} {unit}</small></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>}

function chapterDescription(c:AppChapter){return ({'resource-yard':'Gather materials and decide how to spend your mission budget.','vab-lab':'Build two modular robot sections, then test them together.','launch-design':'Configure a fictional launch campaign and manage payload trade-offs.','mars-arrival':'Bring the delivered modules together on the Martian surface.','power-maintenance':'Deploy energy infrastructure and establish a repair capability.','mission-report':'Review your outpost readiness and learn from the mission.','mars-ready':'The swarm has prepared a welcoming outpost—and a message for humanity.'})[c];}
function MarsReadyChapter({onBack}:{onBack:()=>void}){
 const [videoFailed,setVideoFailed]=useState(false);
 const videoPath='/resource-animations/renders/07_mars_is_ready/mars_is_ready_for_humans.mp4';
 const rainbow=[['RED','#ff4545'],['ORANGE','#ff9a35'],['YELLOW','#ffe45c'],['GREEN','#48cf78'],['BLUE','#4aa7ff'],['INDIGO','#6258d9'],['VIOLET','#bd65d8']];
 return <>
  <section className="hero-panel" style={{position:'relative',overflow:'hidden',padding:28,background:'linear-gradient(125deg,rgba(22,47,61,.98),rgba(8,18,31,.98))',border:'1px solid rgba(130,170,190,.25)'}}>
   <div style={{position:'absolute',inset:'auto -5% -60% 35%',height:320,borderRadius:'50%',background:'radial-gradient(circle,rgba(94,100,205,.2),transparent 68%)',pointerEvents:'none'}}/>
   <div className="hero-copy" style={{position:'relative',zIndex:1,maxWidth:760}}>
    <div className="hero-kicker">CHAPTER 07 · A NEW BEGINNING</div>
    <h2 style={{fontSize:'clamp(30px,4vw,48px)',lineHeight:1.08,margin:'12px 0'}}>Mars is ready<br/>for Humans.</h2>
    <p style={{fontSize:15,lineHeight:1.75,maxWidth:680}}>Rahu, Ketu and the growing swarm have transformed a landing site into a living outpost. Solar arrays gather energy, charging stations keep the robots moving, maintenance facilities repair the fleet, and new habitats and greenhouses prepare the next chapter. The robots are ready to welcome people—not as visitors to an empty world, but as partners in building a home.</p>
   </div>
  </section>
  <section style={{marginTop:22,padding:16,borderRadius:14,background:'#0b1722',border:'1px solid rgba(91,190,207,.28)'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:12}}><div><span className="eyebrow">THE CHAPTER 07 FILM</span><h3 style={{margin:'5px 0 0',color:'#edf5f5'}}>A welcome from the Terraformers</h3></div><span style={{fontSize:11,color:'#8fb5bb'}}>MARS · THE FUTURE OUTPOST</span></div>
   {videoFailed?<div style={{padding:24,borderRadius:10,background:'#142430',color:'#c5d3d8',textAlign:'center'}}><b>The Chapter 7 film could not be loaded.</b><p style={{fontSize:12,margin:'8px 0'}}>Confirm that this file exists in your Vite public folder: <code>public{videoPath}</code></p></div>:<video key={videoPath} controls autoPlay playsInline preload="auto" onError={()=>setVideoFailed(true)} style={{display:'block',width:'100%',maxHeight:'68vh',objectFit:'contain',background:'#03080e',borderRadius:10}} aria-label="Mars is ready for Humans cinematic animation"><source src={videoPath} type="video/mp4"/>Your browser does not support HTML video.</video>}
   <p style={{margin:'10px 0 0',fontSize:12,color:'#91a7ad'}}>The film plays the completed Chapter 7 scene: the powered outpost, expanding robot colony, agriculture, rain, rainbow and the welcome billboard.</p>
  </section>
  <section style={{marginTop:20,padding:20,borderRadius:14,background:'linear-gradient(135deg,rgba(20,48,62,.96),rgba(10,24,36,.96))',border:'1px solid rgba(91,190,207,.3)'}}>
   <span className="eyebrow">SEVEN COLOURS · ONE PROMISE</span>
   <h3 style={{margin:'7px 0 8px',color:'#edf5f5'}}>The rainbow as a sign of hope</h3>
   <p style={{margin:'0 0 14px',color:'#c4d1d5',lineHeight:1.7}}>In the biblical account in Genesis 9:11–17, Yehova's covenant is associated with the rainbow: a promise that a flood will never again destroy all life. In this story, the seven colours of the rainbow become a symbol of that covenant, of renewal after the storm, and of hope for a shared future on Mars. This is the story's spiritual inspiration, not a scientific explanation of rainbows or a claim that Mars has Earth's weather.</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(92px,1fr))',gap:8}}>{rainbow.map(([name,color],i)=><div key={name} style={{padding:'11px 8px',borderRadius:9,background:'rgba(255,255,255,.045)',border:'1px solid rgba(255,255,255,.08)',textAlign:'center'}}><div style={{height:7,borderRadius:9,background:color,marginBottom:8,boxShadow:`0 0 14px ${color}55`}}/><b style={{fontSize:11,letterSpacing:'.08em',color:'#e6eff1'}}>{String(i+1).padStart(2,'0')} · {name}</b></div>)}</div>
   <blockquote style={{margin:'18px 0 0',padding:'13px 16px',borderLeft:'3px solid #a9a0ee',background:'rgba(255,255,255,.035)',color:'#d9e1e5',lineHeight:1.65}}>“I have set my rainbow in the clouds, and it will be the sign of the covenant between me and the earth.”<footer style={{marginTop:7,fontSize:11,color:'#91a7ad'}}>Genesis 9:13 · wording varies by Bible translation</footer></blockquote>
  </section>
  <section style={{marginTop:20,padding:20,borderRadius:14,background:'#101d27',border:'1px solid rgba(91,190,207,.22)'}}>
   <span className="eyebrow">THE FINAL MESSAGE</span><h3 style={{fontSize:'clamp(24px,3vw,36px)',margin:'8px 0',color:'#edf5f5'}}>MARS IS READY FOR HUMANS</h3>
   <p style={{color:'#b9c9ce',lineHeight:1.7}}>From a handful of autonomous machines to a growing settlement: the swarm has prepared energy, shelter, repair capability, food-growing systems and a welcome. The next chapter is not about robots replacing people. It is about humans and robots building the future together.</p>
   <div className="action-footer"><div><b>Mission accomplished. The next chapter belongs to everyone.</b><span>Return to your mission report whenever you want to review the engineering journey.</span></div><button className="btn-primary" onClick={onBack}>Back to Mission Report <ChevronRight size={16}/></button></div>
  </section>
 </>;
}
function StatusRow({label,done}:{label:string;done:boolean}){return <div className="status-row"><span className={done?'status-check done':'status-check'}>{done?<Check size={11}/>:null}</span><span>{label}</span><b className={done?'status-done':''}>{done?'READY':'PENDING'}</b></div>}
function ResourceYard({state,act}:{state:MissionState;act:(a:Action)=>void}){return <><section className="hero-panel resource-hero"><div className="hero-copy"><div className="hero-kicker">PHASE 01 · PRE-MISSION PLANNING</div><h2>Every great mission<br/>starts with a plan.</h2><p>Your resources are limited. Allocate carefully between robot construction, launch payloads and the infrastructure that will keep your outpost alive.</p><div className="hero-stat"><span>STARTING RESEARCH</span><b>{state.resources.research} <small>RP</small></b></div></div><div className="planet-art"><div className="planet-glow"/><div className="planet"/><div className="planet-ring"/><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-star s1"/><div className="art-star s2"/><div className="art-star s3"/><div className="art-caption">MISSION DESTINATION <b>MARS · SOL 001</b></div></div></section><div className="section-heading"><div><span className="eyebrow">YOUR STARTING INVENTORY</span><h2>Resource allocation</h2></div><span className="subtle-label">FIXED STARTING BUDGET</span></div><div className="resource-cards"><div className="resource-card resource-card-animated" key="budget"><ResourceAnimation file={resourceAnimationFiles.budget} label="Fixed starting budget"/><div className="resource-card-top"><span className="resource-symbol large">◈</span><span className="resource-count">18</span></div><b>Fixed starting budget</b><div className="resource-available">STARTING GAME UNITS</div></div>{(Object.keys(resourceMeta) as Resource[]).map(r=><div className="resource-card resource-card-animated" key={r}><ResourceAnimation file={resourceAnimationFiles[r]} label={resourceMeta[r].label}/><div className="resource-card-top"><span className="resource-symbol large">{resourceMeta[r].icon}</span><span className="resource-count">{state.resources[r]}</span></div><b>{resourceMeta[r].label}</b><div className="resource-available">AVAILABLE FOR MISSION USE</div></div>)}</div><div className="action-footer"><div><b>Ready to enter the robotics lab?</b><span>You'll use your inventory to build Rahu and Ketu.</span></div><button className="btn-primary" onClick={()=>act({type:'NAVIGATE',chapter:'vab-lab'})}>Enter VAB Lab <ChevronRight size={16}/></button></div></>}
function VAB({state,act}:{state:MissionState;act:(a:Action)=>void}){
 return <><div className="vab-banner"><div className="vab-grid"/><div className="vab-banner-text"><span className="hero-kicker">VEHICLE ASSEMBLY BUILDING · EARTH</span><h2>Build. Integrate. Test.</h2><p>Configure the upper and lower modules independently. Components consume resources and change each module's mass and capability.</p></div><div className="vab-building"><div className="vab-roof"/><div className="vab-tower"><div/><div/><div/></div><div className="vab-floor"/></div></div>
  <div className="robot-build-grid">{componentGroups.map(group=>{const selectedIds=state.selectedComponents[group.kind];const allSelected=group.ids.every(id=>selectedIds.includes(id));return <div className="build-card" key={group.kind}>
   <div className="build-card-head"><div><span className="eyebrow">{group.title}</span><h3>{group.kind==='upper'?'Rahu':'Ketu'}</h3></div><div className={`robot-avatar ${group.kind}`}><Bot size={27}/></div></div>
   <p className="build-description">{group.kind==='upper'?'Perception, communication and manipulation.':'Mobility, balance and stored energy.'}</p>
   <div className="component-list">{group.ids.map(id=>{const selected=selectedIds.includes(id);const c=componentInfo[id];return <button key={id} className={`component-option ${selected?'selected':''}`} onClick={()=>act({type:selected?'REMOVE_COMPONENT':'ADD_COMPONENT',kind:group.kind,component:id} as Action)}><span className="component-check">{selected?<Check size={13}/>:<span/>}</span><span className="component-text"><b>{c.name}</b><small>{c.description}</small></span><span className="component-mass">{c.mass} <small>MU</small></span></button>})}</div>
   <div className="build-summary"><span>{selectedIds.length} of {group.ids.length} components selected</span><b>{selectedIds.reduce((n,id)=>n+componentInfo[id].mass,0)} MU</b></div>
   {allSelected&&<ModuleAssemblyAnimation kind={group.kind}/>}
  </div>})}</div>
  <div className="action-footer"><div><b>{state.modules.length?'Modules constructed':'Ready to assemble modules?'}</b><span>{state.modules.length?'Run the integration test to check your design.':'Select components for both modules before construction.'}</span></div><div className="button-row"><button className="btn-secondary" onClick={()=>act({type:'BUILD_MODULES'})} disabled={state.modules.length>0||!state.selectedComponents.upper.length||!state.selectedComponents.lower.length}>Assemble modules</button><button className="btn-primary" onClick={()=>act({type:'TEST_ROBOT'})} disabled={!state.modules.length}>Run VAB test <Play size={15}/></button></div></div>
  {state.modules.length>0&&<div className={`test-result ${state.robotTestPassed?'success':'warning'}`}><div className="result-icon">{state.robotTestPassed?<Check/>:<Activity/>}</div><div><b>{state.robotTestPassed?'Integration test passed':'Design needs revision'}</b><p>{state.robotTestPassed?'Rahu and Ketu passed the mobility, vision, communication and energy checks.':'Review required components: camera, radio, drive, balance sensors and battery. You can reset and redesign only by starting a new mission in this MVP.'}</p></div></div>}
 </>;
}
function Launch({state,act}:{state:MissionState;act:(a:Action)=>void}){
 const [activeLaunch,setActiveLaunch]=useState<number|null>(null);
 const [videoFailed,setVideoFailed]=useState(false);
 const descriptions=['Rahu upper modules','Ketu lower modules','Solar + charging + maintenance kit'];
 const launchVideo=(number:number)=>`/resource-animations/renders/03_launch_design/launch_0${number}/launch_0${number}_frame.mp4`;
 const openLaunchAnimation=(number:number)=>{
  setVideoFailed(false);
  setActiveLaunch(number);
 };
 const executeLaunch=(number:1|2|3)=>{
  // Deliver the payload once, then immediately show its matching launch video.
  act({type:'LAUNCH',number});
  openLaunchAnimation(number);
 };
 return <>
  <div className="launch-hero"><div><span className="hero-kicker">MISSION CAMPAIGN · THREE DELIVERIES</span><h2>Three launches.<br/>One outpost.</h2><p>Split the mission payload across three fictional launches. This scenario teaches payload planning; it is not a recommended real mission architecture.</p></div><div className="rocket-illustration"><Rocket size={84} strokeWidth={1}/><div className="rocket-flame"/></div></div>
  <div className="section-heading"><div><span className="eyebrow">PAYLOAD MANIFESTS</span><h2>Launch campaign</h2></div><span className="subtle-label">FICTIONAL GAME PERFORMANCE</span></div>
  <div className="launch-grid">{state.manifests.map((m,i)=><div className="launch-card" key={m.launchNumber}>
   <div className="launch-card-top"><span>LAUNCH 0{m.launchNumber}</span><span className={`pill ${m.status==='delivered'?'pill-green':''}`}>{m.status==='delivered'?'DELIVERED':'PLANNING'}</span></div>
   <div className="launch-icon"><Rocket size={24}/></div><h3>{descriptions[i]}</h3>
   <p>{i===0?'Deliver the upper modules to the designated Mars landing zone.':i===1?'Deliver the matching mobility modules for autonomous rendezvous.':'Deliver the energy network and maintenance infrastructure.'}</p>
   <div className="metric-row"><span>Payload mass</span><b>{m.payloadMass|| (i===2?12:state.modules.find(x=>x.kind=== (i===0?'upper':'lower'))?.mass||0)} MU</b></div>
   <div className="metric-row"><span>Available game Δv</span><b>{m.available} pts</b></div><div className="metric-row"><span>Required game Δv</span><b>{m.required} pts</b></div>
   <div className="margin-bar"><div style={{width:`${Math.min(100,Math.max(0,(m.available-m.required+3)/6*100))}%`}}/></div><div className="margin-label"><span>MISSION MARGIN</span><b>{m.available-m.required} pts</b></div>
   <button
    type="button"
    className="btn-primary full"
    disabled={m.status!=='delivered'&&(i<2&&!state.robotTestPassed)}
    onClick={()=>m.status==='delivered'?openLaunchAnimation(m.launchNumber):executeLaunch(m.launchNumber)}
    aria-label={m.status==='delivered'?`Play launch ${m.launchNumber} delivery animation`:`Execute launch ${m.launchNumber}`}
   >{m.status==='delivered'?<><Check size={15}/> Payload delivered · Play animation</>:<>Execute launch <ChevronRight size={15}/></>}</button>
  </div>)}</div>
  <div className="callout"><Shield size={17}/><p><b>Educational simulation only.</b> Delta-v points, payload mass and mission requirements use invented game scales and do not calculate real rocket performance.</p></div>
  {activeLaunch!==null&&<div role="dialog" aria-modal="true" aria-label={`Launch ${activeLaunch} animation`} onClick={()=>setActiveLaunch(null)} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(2,8,14,.88)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
   <section onClick={e=>e.stopPropagation()} style={{width:'min(100%,1050px)',background:'#101d27',border:'1px solid rgba(91,190,207,.35)',borderRadius:16,padding:18,boxShadow:'0 24px 80px rgba(0,0,0,.55)'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:14}}><div><span className="eyebrow">PAYLOAD DELIVERED · LAUNCH 0{activeLaunch}</span><h3 style={{margin:'5px 0 0',color:'#edf5f5'}}>{descriptions[activeLaunch-1]} · Flight animation</h3></div><button type="button" className="icon-btn" aria-label="Close launch animation" onClick={()=>setActiveLaunch(null)}><X size={20}/></button></div>
    {videoFailed?<div style={{padding:28,textAlign:'center',background:'#07111a',borderRadius:10,color:'#c5d3d8'}}>Could not load this launch animation. Check that the video exists at <code>{launchVideo(activeLaunch)}</code>.</div>:<video key={activeLaunch} autoPlay controls playsInline preload="auto" onError={()=>setVideoFailed(true)} style={{display:'block',width:'100%',maxHeight:'70vh',objectFit:'contain',background:'#050b11',borderRadius:10}} aria-label={`Launch ${activeLaunch} flight and payload delivery animation`}><source src={launchVideo(activeLaunch)} type="video/mp4"/>Your browser does not support HTML video.</video>}
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}><button type="button" className="btn-secondary" onClick={()=>setActiveLaunch(null)}>Close animation</button></div>
   </section>
  </div>}
 </>;
}
function MarsArrival({state,act}:{state:MissionState;act:(a:Action)=>void}){
 const [showArrivalAnimation,setShowArrivalAnimation]=useState(false);
 const [videoFailed,setVideoFailed]=useState(false);
 const arrivalVideo='/resource-animations/renders/04_mars_arrival/mars_arrival_frame.mp4';
 const canRendezvous=state.launchesDelivered.includes(1)&&state.launchesDelivered.includes(2);
 const beginRendezvous=()=>{
  setVideoFailed(false);
  if(!state.modulesAssembled){
   act({type:'ASSEMBLE_MARS'});
  }
  setShowArrivalAnimation(true);
 };
 return <>
  <div className="mars-scene"><div className="mars-sky"><div className="mars-sun"/><div className="mars-horizon"/><div className="mars-ridge ridge-back"/><div className="mars-ridge ridge-front"/><div className="mars-dune dune-one"/><div className="mars-dune dune-two"/><div className="mars-marker marker-a">LANDING ZONE</div><div className="mars-marker marker-b">RENDEZVOUS</div><div className="map-pin pin-a"><Bot size={15}/></div><div className="map-pin pin-b"><Bot size={15}/></div><div className="route-line"/><div className="mars-label">MARS SURFACE · LOCAL MAP</div></div></div>
  <div className="section-heading"><div><span className="eyebrow">AUTONOMOUS RENDEZVOUS</span><h2>Bring the crew together</h2></div><span className="subtle-label">SIMULATED SLAM</span></div>
  <div className="arrival-grid">
   <div className="arrival-card"><div className="arrival-step">01 / SIGNAL</div><h3>Locate matching modules</h3><p>Rahu and Ketu exchange status signals and estimate their positions using the local map.</p><div className="signal-meter"><span/><span/><span/><span/><span/></div><div className="metric-row"><span>Navigation confidence</span><b>{state.navigationStrategy==='cautious'?'92%':state.navigationStrategy==='camera'?'78%':'88%'}</b></div></div>
   <div className="arrival-card"><div className="arrival-step">02 / STRATEGY</div><h3>Choose navigation support</h3><div className="strategy-list">{[{id:'camera',name:'Camera landmarks',desc:'Lower energy use; depends on visible landmarks.'},{id:'camera-inertial',name:'Camera + inertial sensors',desc:'More reliable position estimates; uses more power.'},{id:'cautious',name:'Slow, cautious approach',desc:'Takes longer; lowers simulated collision risk.'}].map(s=><button className={`strategy-option ${state.navigationStrategy===s.id?'selected':''}`} key={s.id} onClick={()=>act({type:'SET_STRATEGY',strategy:s.id})}><span className="radio-dot"/><span><b>{s.name}</b><small>{s.desc}</small></span></button>)}</div></div>
  </div>
  <div className="action-footer"><div><b>{state.modulesAssembled?'Mars swarm assembled and ready':'Ready for autonomous assembly?'}</b><span>{state.modulesAssembled?'Replay the Mars arrival animation whenever you want.':'Both launch payloads must be delivered before rendezvous.'}</span></div><button className="btn-primary" disabled={!canRendezvous} onClick={beginRendezvous}>{state.modulesAssembled?'Play arrival animation':'Begin rendezvous'} <ChevronRight size={16}/></button></div>
  {state.modulesAssembled&&<div className="test-result success"><div className="result-icon"><Check/></div><div><b>Successful Mars assembly</b><p>Modules detected each other, navigated to the rendezvous point, aligned connectors and passed the systems check. The assembled swarm is ready on Mars.</p></div></div>}
  {showArrivalAnimation&&<div role="dialog" aria-modal="true" aria-label="Mars arrival and robot assembly animation" onClick={()=>setShowArrivalAnimation(false)} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(2,8,14,.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
   <section onClick={e=>e.stopPropagation()} style={{width:'min(100%,1100px)',background:'#101d27',border:'1px solid rgba(91,190,207,.35)',borderRadius:16,padding:18,boxShadow:'0 24px 80px rgba(0,0,0,.55)'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:14}}><div><span className="eyebrow">CHAPTER 04 · MARS ARRIVAL</span><h3 style={{margin:'5px 0 0',color:'#edf5f5'}}>Rahu + Ketu · Autonomous rendezvous and swarm assembly</h3></div><button type="button" className="icon-btn" aria-label="Close Mars arrival animation" onClick={()=>setShowArrivalAnimation(false)}><X size={20}/></button></div>
    {videoFailed?<div style={{padding:28,textAlign:'center',background:'#07111a',borderRadius:10,color:'#c5d3d8'}}>Could not load the Mars arrival animation. Check that the video exists at <code>{arrivalVideo}</code>.</div>:<video key={arrivalVideo} autoPlay controls playsInline preload="auto" onError={()=>setVideoFailed(true)} style={{display:'block',width:'100%',maxHeight:'70vh',objectFit:'contain',background:'#050b11',borderRadius:10}} aria-label="Rahu and Ketu locate each other, travel across Mars, assemble into humanoid robots, and form a ready swarm"><source src={arrivalVideo} type="video/mp4"/>Your browser does not support HTML video.</video>}
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}><button type="button" className="btn-secondary" onClick={()=>setShowArrivalAnimation(false)}>Close animation</button></div>
   </section>
  </div>}
 </>;
}
function Power({state,act}:{state:MissionState;act:(a:Action)=>void}){
 const [activeAnimation,setActiveAnimation]=useState<'solar'|'charger'|'maintenance'|null>(null);
 const [videoFailed,setVideoFailed]=useState(false);
 const types=[
  {type:'solar' as const,name:'Solar array',desc:'Generates power for the outpost.',cost:'12 metal · 5 electronics · 5 power',icon:Sun},
  {type:'charger' as const,name:'Charging station',desc:'Allows robots to replenish stored energy.',cost:'8 metal · 8 electronics · 8 power',icon:BatteryCharging},
  {type:'maintenance' as const,name:'Maintenance centre',desc:'Provides a location for inspection and repairs.',cost:'15 metal · 10 electronics · 5 protection',icon:Wrench}
 ];
 const animationFiles={
  solar:'/resource-animations/renders/05_power_maintenance/solar_array_deployment/solar_array_deployment_frame.mp4',
  charger:'/resource-animations/renders/05_power_maintenance/charging_station/charging_station_frame.mp4',
  maintenance:'/resource-animations/renders/05_power_maintenance/maintenance_station/maintenance_station_frame.mp4'
 };
 const animationTitles={solar:'Solar array deployment',charger:'Charging station operations',maintenance:'Maintenance station operations'};
 const playAnimation=(type:'solar'|'charger'|'maintenance')=>{setVideoFailed(false);setActiveAnimation(type);};
 return <>
  <div className="power-hero"><div><span className="hero-kicker">CHAPTER 05 · OUTPOST INFRASTRUCTURE</span><h2>Keep the mission<br/>running.</h2><p>Deploy a connected power and maintenance network. Reach matters, but resilience keeps your robotic outpost operational.</p></div><div className="power-orb"><Sun size={55}/><span>SOLAR<br/>NETWORK</span></div></div>
  <div className="section-heading"><div><span className="eyebrow">MARS FACILITIES</span><h2>Deploy infrastructure</h2></div><span className="subtle-label">ONE OF EACH FACILITY</span></div>
  <div className="facility-grid">{types.map(t=>{const Icon=t.icon;const done=state.facilities.some(f=>f.type===t.type);return <div className="facility-card" key={t.type}>
   <div className="facility-icon"><Icon size={24}/></div><div className="facility-status">{done?'DEPLOYED':'AVAILABLE'}</div><h3>{t.name}</h3><p>{t.desc}</p><div className="facility-cost">{t.cost}</div>
   <button className={done?'btn-secondary full':'btn-primary full'} disabled={!done&&!state.modulesAssembled} onClick={()=>{if(done){playAnimation(t.type);}else{act({type:'DEPLOY',facility:{id:t.type+'-01',type:t.type,x:t.type==='solar'?4:t.type==='charger'?6:8,y:3,condition:100,connected:true}});}}}>
    {done?<><Play size={14}/> Deployed · Play animation</>:'Deploy facility'}
   </button>
  </div>;})}</div>
  <div className="network-preview"><div className="network-heading"><b>OUTPOST POWER NETWORK</b><span>{state.facilities.length}/3 FACILITIES</span></div><div className="network-map"><div className="network-node landing"><Bot size={19}/><small>ROBOT CREW</small></div><div className="network-connector"/><div className={`network-node ${state.solarDeployed?'active-node':''}`}><Sun size={19}/><small>SOLAR</small></div><div className="network-connector"/><div className={`network-node ${state.chargerDeployed?'active-node':''}`}><BatteryCharging size={19}/><small>CHARGER</small></div><div className="network-connector"/><div className={`network-node ${state.maintenanceBuilt?'active-node':''}`}><Wrench size={19}/><small>REPAIR</small></div></div></div>
  <div className="action-footer"><div><b>Run final readiness inspection</b><span>All three launches, robot assembly and facilities are required.</span></div><button className="btn-primary" onClick={()=>act({type:'COMPLETE_MISSION'})}>Inspect outpost <ChevronRight size={16}/></button></div>
  {activeAnimation&&<div role="dialog" aria-modal="true" aria-label={animationTitles[activeAnimation]} onClick={()=>setActiveAnimation(null)} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(2,8,14,.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
   <section onClick={e=>e.stopPropagation()} style={{width:'min(100%,1100px)',background:'#101d27',border:'1px solid rgba(91,190,207,.35)',borderRadius:16,padding:18,boxShadow:'0 24px 80px rgba(0,0,0,.55)'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:14}}><div><span className="eyebrow">CHAPTER 05 · POWER & MAINTENANCE</span><h3 style={{margin:'5px 0 0',color:'#edf5f5'}}>{animationTitles[activeAnimation]}</h3></div><button type="button" className="icon-btn" aria-label="Close facility animation" onClick={()=>setActiveAnimation(null)}><X size={20}/></button></div>
    {videoFailed?<div style={{padding:28,textAlign:'center',background:'#07111a',borderRadius:10,color:'#c5d3d8'}}>Could not load this Chapter 5 animation. Check that the video exists at <code>{animationFiles[activeAnimation]}</code>.</div>:<video key={activeAnimation} autoPlay controls playsInline preload="auto" onError={()=>setVideoFailed(true)} style={{display:'block',width:'100%',maxHeight:'70vh',objectFit:'contain',background:'#050b11',borderRadius:10}} aria-label={animationTitles[activeAnimation]}><source src={animationFiles[activeAnimation]} type="video/mp4"/>Your browser does not support HTML video.</video>}
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}><button type="button" className="btn-secondary" onClick={()=>setActiveAnimation(null)}>Close animation</button></div>
   </section>
  </div>}
 </>;
}
const missionFilmClips:{chapter:string;title:string;src:string}[]=[
 // Chapter 1 · Resource Yard: budget and resource allocation animations.
 {chapter:'CHAPTER 01 · RESOURCE YARD',title:'Starting mission budget',src:'/resource-animations/renders/00_starting_budget/00_starting_budget_frame.mp4'},
 {chapter:'CHAPTER 01 · RESOURCE YARD',title:'Metal resources',src:'/resource-animations/renders/01_metal/01_metal_frame.mp4'},
 {chapter:'CHAPTER 01 · RESOURCE YARD',title:'Electronics resources',src:'/resource-animations/renders/02_electronics/02_electronics_frame.mp4'},
 {chapter:'CHAPTER 01 · RESOURCE YARD',title:'Motors and joints',src:'/resource-animations/renders/03_motors_joints/03_motors_joints_frame.mp4'},
 {chapter:'CHAPTER 01 · RESOURCE YARD',title:'Sensors',src:'/resource-animations/renders/04_sensors/04_sensors_frame.mp4'},
 {chapter:'CHAPTER 01 · RESOURCE YARD',title:'Power units',src:'/resource-animations/renders/05_power_units/05_power_units_frame.mp4'},
 {chapter:'CHAPTER 01 · RESOURCE YARD',title:'Thermal and dust protection',src:'/resource-animations/renders/06_thermal_dust/06_thermal_dust_frame.mp4'},
 {chapter:'CHAPTER 01 · RESOURCE YARD',title:'Research points',src:'/resource-animations/renders/07_research_points/07_research_points_frame.mp4'},
 // Chapter 2 · VAB Robotics Lab: the two robot modules are assembled.
 {chapter:'CHAPTER 02 · VAB ROBOTICS LAB',title:'Rahu · Upper module assembly',src:'/resource-animations/renders/02_vab_modules/rahu_upper_module/rahu_upper_module_frame.mp4'},
 {chapter:'CHAPTER 02 · VAB ROBOTICS LAB',title:'Ketu · Lower module assembly',src:'/resource-animations/renders/02_vab_modules/ketu_lower_module/ketu_lower_module_frame.mp4'},
 // Chapter 3 · Launch Design: three payload deliveries.
 {chapter:'CHAPTER 03 · LAUNCH DESIGN',title:'Launch 1 · Rahu upper module delivery',src:'/resource-animations/renders/03_launch_design/launch_01/launch_01_frame.mp4'},
 {chapter:'CHAPTER 03 · LAUNCH DESIGN',title:'Launch 2 · Ketu lower module delivery',src:'/resource-animations/renders/03_launch_design/launch_02/launch_02_frame.mp4'},
 {chapter:'CHAPTER 03 · LAUNCH DESIGN',title:'Launch 3 · Outpost infrastructure delivery',src:'/resource-animations/renders/03_launch_design/launch_03/launch_03_frame.mp4'},
 // Chapter 4 · Mars Arrival: autonomous rendezvous and assembly.
 {chapter:'CHAPTER 04 · MARS ARRIVAL',title:'Rahu + Ketu · Mars rendezvous and swarm assembly',src:'/resource-animations/renders/04_mars_arrival/mars_arrival_frame.mp4'},
 // Chapter 5 · Power & Maintenance: deploy the outpost infrastructure.
 {chapter:'CHAPTER 05 · POWER & MAINTENANCE',title:'Solar array deployment',src:'/resource-animations/renders/05_power_maintenance/solar_array_deployment/solar_array_deployment_frame.mp4'},
 {chapter:'CHAPTER 05 · POWER & MAINTENANCE',title:'Charging station operations',src:'/resource-animations/renders/05_power_maintenance/charging_station/charging_station_frame.mp4'},
 {chapter:'CHAPTER 05 · POWER & MAINTENANCE',title:'Maintenance station operations',src:'/resource-animations/renders/05_power_maintenance/maintenance_station/maintenance_station_frame.mp4'}
];
function Report({state,act}:{state:MissionState;act:(a:Action)=>void}){
 const score=[state.robotTestPassed?25:0,state.launchesDelivered.length/3*25,state.modulesAssembled?25:0,(Number(state.solarDeployed)+Number(state.chargerDeployed)+Number(state.maintenanceBuilt))/3*25];
 const total=Math.round(score.reduce((a,b)=>a+b,0));
 const [filmIndex,setFilmIndex]=useState<number|null>(null);
 const [filmError,setFilmError]=useState(false);
 const [filmFinished,setFilmFinished]=useState(false);
 const currentClip=filmIndex===null?null:missionFilmClips[filmIndex];
 const startFilm=()=>{setFilmIndex(0);setFilmError(false);setFilmFinished(false);};
 const advanceFilm=()=>{setFilmError(false);setFilmIndex(index=>index===null?0:index<missionFilmClips.length-1?index+1:null);if(filmIndex!==null&&filmIndex>=missionFilmClips.length-1)setFilmFinished(true);};
 const previousClip=()=>{setFilmError(false);setFilmFinished(false);setFilmIndex(index=>index===null?0:Math.max(0,index-1));};
 const closeFilm=()=>{setFilmIndex(null);setFilmError(false);setFilmFinished(false);};
 return <>
  <div className={`report-hero ${state.missionStatus==='success'?'report-success':''}`}><div className="report-emblem"><Rocket size={35}/></div><div><span className="hero-kicker">MISSION DEBRIEF · FINAL INSPECTION</span><h2>{state.missionStatus==='success'?'Outpost operational.':'Mission report'}</h2><p>{state.missionStatus==='success'?'Your robotic crew has established the essential infrastructure for a future expedition.':'Your mission is not yet fully ready. Review the outstanding requirements and try again.'}</p></div><div className="score-circle"><b>{total}</b><span>MISSION<br/>SCORE</span></div></div>
  <div className="section-heading"><div><span className="eyebrow">PERFORMANCE BREAKDOWN</span><h2>Mission readiness</h2></div></div>
  <div className="score-grid">{[{name:'Design & testing',score:score[0],icon:Bot},{name:'Launch planning',score:score[1],icon:Rocket},{name:'Autonomous assembly',score:score[2],icon:Compass},{name:'Power & maintenance',score:score[3],icon:Sun}].map(x=>{const Icon=x.icon;return <div className="score-card" key={x.name}><Icon size={20}/><span>{x.name}</span><b>{Math.round(x.score)}<small>/25</small></b><div className="score-track"><div style={{width:`${x.score/25*100}%`}}/></div></div>})}</div>
  <div className="report-checklist"><h3>Final readiness checklist</h3>{[['VAB integration test',state.robotTestPassed],['Launch 1 · Rahu delivery',state.launchesDelivered.includes(1)],['Launch 2 · Ketu delivery',state.launchesDelivered.includes(2)],['Mars robot assembly',state.modulesAssembled],['Launch 3 · Infrastructure delivery',state.launchesDelivered.includes(3)],['Solar array deployed',state.solarDeployed],['Charging station deployed',state.chargerDeployed],['Maintenance centre operational',state.maintenanceBuilt]].map(([name,done])=><div className="checklist-row" key={String(name)}><span className={done?'check-ok':'check-pending'}>{done?<Check size={13}/>:<span/>}</span>{name}<b>{done?'COMPLETE':'PENDING'}</b></div>)}</div>
  <section style={{marginTop:24,padding:20,borderRadius:14,background:'linear-gradient(135deg,rgba(20,48,62,.96),rgba(10,24,36,.96))',border:'1px solid rgba(91,190,207,.3)'}}>
   <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
    <div style={{maxWidth:680}}><span className="eyebrow">CHAPTER 06 · COMPLETE MISSION RECAP</span><h3 style={{margin:'7px 0',color:'#edf5f5'}}>The Terraformers story so far</h3><p style={{margin:'0 0 12px',color:'#b9c9ce',lineHeight:1.6}}>Watch every generated animation from Chapters 1–5 in mission order: resource preparation, Rahu and Ketu module assembly, all three launches, Mars rendezvous, and outpost power and maintenance deployment.</p><div style={{fontSize:12,color:'#91a7ad'}}>17 clips · 5 chapters · Plays continuously in sequence</div></div>
    <button type="button" className="btn-primary" onClick={startFilm}><Play size={16}/> Play complete mission film</button>
   </div>
   <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:18}}>{['01 · Resources (8 clips)','02 · Robot assembly (2)','03 · Launches (3)','04 · Mars arrival (1)','05 · Outpost (3)'].map(label=><span key={label} style={{padding:'7px 10px',borderRadius:20,background:'rgba(103,214,193,.1)',border:'1px solid rgba(103,214,193,.2)',fontSize:11,color:'#b9dcd5'}}>{label}</span>)}</div>
  </section>
  <div className="action-footer"><div><b>Ready for another mission?</b><span>Start over with the same deterministic resource budget.</span></div><button className="btn-primary" onClick={()=>act({type:'RESET'})}><RotateCcw size={15}/> Replay mission</button></div>
  {filmIndex!==null&&currentClip&&<div role="dialog" aria-modal="true" aria-label="Complete Terraformers mission film" onClick={closeFilm} style={{position:'fixed',inset:0,zIndex:1100,background:'rgba(2,8,14,.94)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,overflowY:'auto'}}>
   <section onClick={e=>e.stopPropagation()} style={{width:'min(100%,1150px)',background:'#101d27',border:'1px solid rgba(91,190,207,.35)',borderRadius:16,padding:18,boxShadow:'0 24px 80px rgba(0,0,0,.55)'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:14}}><div><span className="eyebrow">{currentClip.chapter}</span><h3 style={{margin:'5px 0 0',color:'#edf5f5'}}>{currentClip.title}</h3><p style={{margin:'5px 0 0',fontSize:12,color:'#91a7ad'}}>Clip {filmIndex+1} of {missionFilmClips.length} · Next clip starts automatically</p></div><button type="button" className="icon-btn" aria-label="Close complete mission film" onClick={closeFilm}><X size={20}/></button></div>
    <div style={{height:5,background:'#263a45',borderRadius:5,overflow:'hidden',marginBottom:14}}><div style={{height:'100%',width:`${((filmIndex+1)/missionFilmClips.length)*100}%`,background:'linear-gradient(90deg,#20c85a,#168cff,#a900c8)',transition:'width .25s'}}/></div>
    {filmError?<div style={{padding:28,textAlign:'center',background:'#07111a',borderRadius:10,color:'#c5d3d8'}}><b>Could not load this clip.</b><p style={{margin:'8px 0',fontSize:12}}>Check that this file exists at <code>{currentClip.src}</code>.</p><button type="button" className="btn-primary" onClick={advanceFilm}>Skip to next clip <ChevronRight size={15}/></button></div>:<video key={filmIndex} autoPlay controls playsInline preload="auto" onEnded={advanceFilm} onError={()=>setFilmError(true)} style={{display:'block',width:'100%',maxHeight:'68vh',objectFit:'contain',background:'#050b11',borderRadius:10}} aria-label={currentClip.title}><source src={currentClip.src} type="video/mp4"/>Your browser does not support HTML video.</video>}
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap',marginTop:14}}><div style={{fontSize:12,color:'#91a7ad'}}>The film advances automatically when each clip ends.</div><div style={{display:'flex',gap:8}}><button type="button" className="btn-secondary" onClick={previousClip} disabled={filmIndex===0}>Previous</button><button type="button" className="btn-primary" onClick={advanceFilm}>{filmIndex===missionFilmClips.length-1?'Finish film':'Next clip'} <ChevronRight size={15}/></button></div></div>
   </section>
  </div>}
  {filmFinished&&<div role="dialog" aria-modal="true" aria-label="Mission film complete" onClick={closeFilm} style={{position:'fixed',inset:0,zIndex:1101,background:'rgba(2,8,14,.92)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><section onClick={e=>e.stopPropagation()} style={{width:'min(100%,560px)',padding:28,borderRadius:16,background:'#101d27',border:'1px solid rgba(91,190,207,.35)',textAlign:'center'}}><div className="report-emblem" style={{margin:'0 auto 14px'}}><Check size={32}/></div><span className="eyebrow">CHAPTER 06 · RECAP COMPLETE</span><h3 style={{color:'#edf5f5'}}>Mission film finished</h3><p style={{color:'#b9c9ce'}}>You have watched all 17 animations covering the mission from resource planning through outpost deployment.</p><div style={{display:'flex',justifyContent:'center',gap:8}}><button className="btn-secondary" onClick={closeFilm}>Close</button><button className="btn-primary" onClick={startFilm}><RotateCcw size={14}/> Watch again</button></div></section></div>}
 </>;
}

const nasaResourceGroups = [
 {title:'NASA DATA & RESOURCES',intro:'Public science datasets and tools that can help ground Terraformers learning activities in real space research.',items:[
  {name:'NASA Open APIs',tag:'API PORTAL',description:'NASA’s central public API portal. Explore programmatic datasets such as Astronomy Picture of the Day (APOD), Mars Rover Photos and the Space Weather Database (DONKI). A free API key can be requested for higher rate limits than the shared demo key.',url:'https://api.nasa.gov/',link:'Explore APIs'},
  {name:'Space Weather Database (DONKI)',tag:'SPACE WEATHER',description:'Regularly updated notifications and data on solar flares, coronal mass ejections and other space-weather events. Useful for investigating radiation risk, communications disruption and mission-risk scenarios for astronauts and spacecraft.',url:'https://ccmc.gsfc.nasa.gov/tools/DONKI/',link:'Open DONKI'},
  {name:'NASA Open Science Data Repository (OSDR)',tag:'SPACE BIOLOGY',description:'NASA’s public archive of space-biology and astronaut-health research, including studies of spaceflight effects on bone density, muscle mass, immune response and sleep across organisms. Search the repository by keyword.',url:'https://osdr.nasa.gov/bio/repo/',link:'Browse OSDR',extraUrl:'https://osdr.nasa.gov/osdr/data/search?term=KEYWORD',extraLink:'Open search API'},
  {name:'RadLab · OSDR Radiation Dosimetry Database',tag:'RADIATION DATA',description:'Radiation-dose measurements recorded by dosimetry instruments aboard the International Space Station and contributed by multiple international space agencies. Explore measured exposure data for shielding and mission-risk learning.',url:'https://visualization.osdr.nasa.gov/radlab/gui/data-api/',link:'Explore RadLab'},
  {name:'Mars Trek',tag:'MARS TERRAIN',description:'Interactive visualization and data-download portal for real Mars imagery, elevation and terrain data compiled from NASA Mars missions, including Curiosity and Perseverance. Useful for exploring and comparing potential outpost locations.',url:'https://trek.nasa.gov/mars/',link:'Open Mars Trek'}
 ]},
 {title:'SPACE AGENCY PARTNER RESOURCES',intro:'Additional educational material from the Canadian Space Agency (CSA).',items:[
  {name:'CSA · Space resources for STEM and youth organizations',tag:'EDUCATOR RESOURCES',description:'Free, bilingual tools and activities for educators and youth organizations, including museums, libraries, camps, after-school clubs and community outreach groups.',url:'https://www.asc-csa.gc.ca/eng/youth-educators/resources-stem-and-youth-organizations.asp',link:'Explore STEM resources'},
  {name:'CSA · Food production on the Moon and in remote areas',tag:'SPACE AGRICULTURE',description:'An educational package about food production in space, astronaut health and nutrition, and how space-food research can benefit people on Earth.',url:'https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/',link:'Explore food-production toolkit'}
 ]}
];
function NASAResources({onClose}:{onClose:()=>void}){
 return <div role="dialog" aria-modal="true" aria-label="NASA data and space agency resources" onClick={onClose} style={{position:'fixed',inset:0,zIndex:1400,background:'rgba(2,8,14,.92)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'min(4vh,28px) 16px',overflowY:'auto'}}>
  <section onClick={e=>e.stopPropagation()} style={{width:'min(100%,1080px)',background:'#0d1a25',border:'1px solid rgba(91,190,207,.35)',borderRadius:16,boxShadow:'0 24px 80px rgba(0,0,0,.6)',overflow:'hidden'}}>
   <header style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,padding:'22px 24px',background:'linear-gradient(120deg,rgba(22,55,70,.98),rgba(10,23,36,.98))',borderBottom:'1px solid rgba(91,190,207,.22)'}}>
    <div><span className="eyebrow">MARS SWARM · LEARNING LIBRARY</span><h2 style={{margin:'6px 0',color:'#edf5f5',fontSize:'clamp(23px,3vw,32px)'}}>NASA Data &amp; Space Agency Resources</h2><p style={{margin:0,color:'#b9c9ce',fontSize:13,lineHeight:1.6,maxWidth:720}}>Explore real datasets and educational tools for space weather, radiation, Mars terrain, astronaut health and growing food beyond Earth.</p></div>
    <button type="button" className="icon-btn" aria-label="Close resources" onClick={onClose}><X size={20}/></button>
   </header>
   <div style={{padding:24}}>
    <div style={{padding:'12px 14px',marginBottom:22,borderRadius:9,background:'rgba(255,255,255,.045)',border:'1px solid rgba(255,255,255,.09)',color:'#c4d1d5',fontSize:12,lineHeight:1.65}}>These are external research and learning links. They are not live data feeds inside the Terraformers simulation; check each provider’s documentation and data-use terms before using its data.</div>
    {nasaResourceGroups.map(group=><section key={group.title} style={{marginBottom:24}}>
     <div style={{marginBottom:12}}><span className="eyebrow">{group.title}</span><p style={{margin:'5px 0 0',color:'#aebfc5',fontSize:13}}>{group.intro}</p></div>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:12}}>
      {group.items.map(item=><article key={item.name} style={{padding:16,borderRadius:12,background:'#132430',border:'1px solid rgba(91,190,207,.2)',display:'flex',flexDirection:'column',minHeight:190}}>
       <div style={{fontSize:10,letterSpacing:'.1em',color:'#7ed8d0',fontWeight:700}}>{item.tag}</div><h3 style={{margin:'8px 0',fontSize:17,lineHeight:1.3,color:'#edf5f5'}}>{item.name}</h3><p style={{margin:'0 0 16px',fontSize:13,lineHeight:1.65,color:'#b9c9ce',flex:1}}>{item.description}</p>
       <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}><a href={item.url} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,color:'#86e0d1',fontSize:12,fontWeight:700,textDecoration:'none'}}>{item.link} <span aria-hidden="true">↗</span></a>{'extraUrl' in item&&item.extraUrl&&<a href={item.extraUrl} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,color:'#a8c7ff',fontSize:12,fontWeight:700,textDecoration:'none'}}>{item.extraLink} <span aria-hidden="true">↗</span></a>}</div>
      </article>)}
     </div>
    </section>)}
    <footer style={{padding:'14px 16px',borderRadius:10,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)',color:'#aebfc5',fontSize:11,lineHeight:1.7}}><b style={{color:'#d8e3e7'}}>Website disclaimer</b><br/>NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website.</footer>
   </div>
   <div style={{display:'flex',justifyContent:'flex-end',padding:'0 24px 22px'}}><button type="button" className="btn-secondary" onClick={onClose}>Close resource library</button></div>
  </section>
 </div>;
}

function Glossary({onClose}:{onClose:()=>void}){const entries=[['VAB','Vehicle Assembly Building: the Earth-based facility where spacecraft and launch vehicles are integrated.'],['Payload','The cargo carried by a launch vehicle.'],['Stage','A section of a launch vehicle that performs part of the mission.'],['Isp','Specific impulse: a measure related to how efficiently a rocket engine uses propellant.'],['Delta-v','A measure of change in velocity. This game uses fictional points.'],['Autonomy','The ability of a system to perform tasks with limited direct control.'],['Sensor','A component that gathers information about the robot or environment.'],['SLAM','Simultaneous Localization and Mapping: estimating position while building or updating a map.']];return <div className="modal-backdrop" onClick={onClose}><div className="modal glossary-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">MISSION REFERENCE</span><h2>Glossary</h2></div><button className="icon-btn" onClick={onClose}>×</button></div>{entries.map(([term,desc])=><div className="glossary-entry" key={term}><b>{term}</b><p>{desc}</p></div>)}</div></div>}
export default App;
