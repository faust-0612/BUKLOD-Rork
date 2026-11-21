/**
 * Genesis World Workshop — self-contained, user-scoped OFFLINE PLAY.
 *
 * No Supabase / BP / QMP / Diamond / inventory ownership authority exists here.
 * These locally gathered materials and construction stages are NEVER real assets.
 * Real multiplayer construction must use authenticated, idempotent server receipts.
 */
export type WorkshopTrack='lot'|'house'|'cluster';
export type WorkshopMaterial='timber'|'stone'|'supplies';
export type WorkshopStyle='classic'|'tropical'|'nature';
export type WorkshopSky='dawn'|'day'|'twilight';
export type WorkshopDecor='garden'|'lanterns'|'pond';
export type WorkshopCosmetic={style:WorkshopStyle;sky:WorkshopSky;decor:WorkshopDecor};
export type WorkshopProgress={level:number;stage:number;mastery:number};
export type WorkshopGather={material:WorkshopMaterial;run:number;step:number;mistakes:number};
export type WorkshopState={
 schema:1;
 tracks:Record<WorkshopTrack,WorkshopProgress>;
 stock:Record<WorkshopMaterial,number>;
 cosmetics:{home:WorkshopCosmetic;village:WorkshopCosmetic};
 rounds:number;
 gathering:WorkshopGather|null;
};
const materials:readonly WorkshopMaterial[]=['timber','stone','supplies'];
const tracks:readonly WorkshopTrack[]=['lot','house','cluster'];
const MAX_STOCK=1000000;
const defaultCosmetic:WorkshopCosmetic={style:'classic',sky:'day',decor:'garden'};
const freshProgress=():WorkshopProgress=>({level:0,stage:0,mastery:0});
export function newWorkshop():WorkshopState {
 return {schema:1,tracks:{lot:freshProgress(),house:freshProgress(),cluster:freshProgress()},
  stock:{timber:0,stone:0,supplies:0},
  cosmetics:{home:{...defaultCosmetic},village:{...defaultCosmetic}},rounds:0,gathering:null};
}
const validInt=(x:unknown,max=Number.MAX_SAFE_INTEGER):x is number=>
 typeof x==='number'&&Number.isSafeInteger(x)&&x>=0&&x<=max;
function safeProgress(x:any):WorkshopProgress {
 const p=x??{};
 const level=validInt(p.level,10)?p.level:0;
 const mastery=validInt(p.mastery,100000000)?p.mastery:0;
 const stage=validInt(p.stage,4)?p.stage:0;
 return {level,stage,mastery:level===10?mastery:0};
}
function safeCosmetic(x:any):WorkshopCosmetic {
 return {
  style:['classic','tropical','nature'].includes(x?.style)?x.style:'classic',
  sky:['dawn','day','twilight'].includes(x?.sky)?x.sky:'day',
  decor:['garden','lanterns','pond'].includes(x?.decor)?x.decor:'garden',
 };
}
export function restoreWorkshop(raw:unknown):WorkshopState {
 const d=newWorkshop();
 if(!raw||typeof raw!=='object'||(raw as any).schema!==1)return d;
 const x=raw as any;
 for(const track of tracks)d.tracks[track]=safeProgress(x.tracks?.[track]);
 for(const material of materials)d.stock[material]=validInt(x.stock?.[material],MAX_STOCK)?x.stock[material]:0;
 d.cosmetics.home=safeCosmetic(x.cosmetics?.home);
 d.cosmetics.village=safeCosmetic(x.cosmetics?.village);
 d.rounds=validInt(x.rounds,100000000)?x.rounds:0;
 const g=x.gathering;
 if(g&&materials.includes(g.material)&&validInt(g.run,100000000)&&validInt(g.step,2)&&validInt(g.mistakes,1000000)) {
  d.gathering={material:g.material,run:g.run,step:g.step,mistakes:g.mistakes};
 }
 return d;
}
export function buildRequirements(state:WorkshopState,track:WorkshopTrack){
 const p=state.tracks[track];
 const nextLevel=Math.min(10,p.level+1);
 const nextStage=p.stage+1;
 // Beyond ten, Mastery continues with attainable logarithmic effort rather than combat power.
 const masteryScale=p.level===10?Math.floor(5*Math.log2(p.mastery+2)):0;
 const tier=nextLevel+masteryScale;
 const scopeFactor=track==='cluster'?2:track==='house'?1.4:1;
 const amount=(base:number,multi:number)=>Math.max(1,Math.floor(scopeFactor*(base+tier*multi+nextStage*2)));
 const need:{timber:number;stone:number;supplies:number}={
  timber:amount(1,2),stone:amount(1,1),supplies:amount(1,1),
 };
 const available=materials.every(m=>state.stock[m]>=need[m]);
 return {
  target:p.level===10?'Mastery '+(p.mastery+1):'Level '+nextLevel,
  stage:nextStage,need,available,mastery:p.level===10,
  stageName:['Gather supplies','Mark foundations','Raise framework','Build structures','Finish and decorate'][nextStage-1],
 };
}
export function buildWorkshopStage(state:WorkshopState,track:WorkshopTrack):
 {ok:true;state:WorkshopState}|{ok:false;reason:string;state:WorkshopState} {
 if(!tracks.includes(track))return {ok:false,reason:'Unknown building track.',state};
 const quote=buildRequirements(state,track);
 if(!quote.available)return {ok:false,reason:'Collect more local workshop materials first.',state};
 const progress=state.tracks[track];
 if(!validInt(progress.level,10)||!validInt(progress.stage,4))return {ok:false,reason:'Invalid progress.',state};
 const stock={...state.stock};
 for(const m of materials)stock[m]-=quote.need[m];
 const nextProgress:WorkshopProgress=progress.stage===4
  ?progress.level===10?{level:10,stage:0,mastery:progress.mastery+1}
   :{level:progress.level+1,stage:0,mastery:0}
  :{...progress,stage:progress.stage+1};
 return {ok:true,state:{...state,stock,tracks:{...state.tracks,[track]:nextProgress}}};
}
/** Three visual decisions per hunt; a mistake restarts the combo. */
export function startWorkshopGather(state:WorkshopState,material:WorkshopMaterial):WorkshopState{
 if(!materials.includes(material))return state;
 const run=Math.min(100000000,state.rounds+1);
 return {...state,rounds:run,gathering:{material,run,step:0,mistakes:0}};
}
export function gatherTarget(g:WorkshopGather):number{
 return (g.run*7+g.step*5+g.mistakes*3+({timber:1,stone:2,supplies:3}[g.material]))%3;
}
export function chooseWorkshopGather(state:WorkshopState,choice:number):
 {state:WorkshopState;completed:boolean;correct:boolean;earned:number} {
 const g=state.gathering;
 if(!g||!validInt(choice,2))return {state,completed:false,correct:false,earned:0};
 if(choice!==gatherTarget(g)){
  return {state:{...state,gathering:{...g,step:0,mistakes:Math.min(1000000,g.mistakes+1)}},completed:false,correct:false,earned:0};
 }
 if(g.step<2){
  return {state:{...state,gathering:{...g,step:g.step+1}},completed:false,correct:true,earned:0};
 }
 const earned=8+Math.min(12,Math.floor(Math.log2(state.rounds+2)));
 const stock={...state.stock,[g.material]:Math.min(MAX_STOCK,state.stock[g.material]+earned)};
 return {state:{...state,stock,gathering:null},completed:true,correct:true,earned};
}
export function customizeWorkshop(state:WorkshopState,world:'home'|'village',edit:Partial<WorkshopCosmetic>):WorkshopState{
 const next=safeCosmetic({...state.cosmetics[world],...edit});
 return {...state,cosmetics:{...state.cosmetics,[world]:next}};
}
/** Local workshop stages/objects do not unlock server-owned land or paid currency. */
export const WORKSHOP_IS_NONTRANSACTIONAL=true as const;
