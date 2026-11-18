/**
 * Season V2: read-only, official-date preview. Never settles a season,
 * sends push, grants a reward or trusts the device clock for accounting.
 */
export const SEASON_V2_ROLLOUT = Object.freeze({
  readOnlyJourneyPreview:true,seasonRollover:false,chapterUnlocks:false,
  seasonRewardGrants:false,seasonMomentum:false,notificationDelivery:false,
});
export type SeasonSummary=Readonly<{id:string;number:number;title:string;
  starts_on:string;ends_on:string;points?:number;
  overall_position?:number|null;local_position?:number|null}>;
export type SeasonPhase='UNVERIFIED'|'NO_ACTIVE_SEASON'|'INVALID_SEASON'|
  'PREPARATION'|'LIVE'|'ENDED_AWAITING_CLOSE';
export type SeasonState=Readonly<{phase:SeasonPhase;label:string;
  season:SeasonSummary|null;daysUntilStart:number|null;
  daysRemaining:number|null;progressPercent:number|null;rewardEligible:false}>;
export const SEASON_CHAPTER_PREVIEWS=Object.freeze([
  Object.freeze({code:'DISCOVER',title:'Discover',detail:'Meet your Character and discover a new story.'}),
  Object.freeze({code:'CREATE',title:'Create',detail:'Post thoughtfully and build real conversations.'}),
  Object.freeze({code:'UNITE',title:'Unite',detail:'Team up to complete meaningful group quests.'}),
  Object.freeze({code:'FINALE',title:'Finale',detail:'Reach the story ending and see verified awards.'}),
]);
export const SEASON_JOURNEY_TRACKS=Object.freeze([
  Object.freeze({id:'explorer',title:'Explorer',detail:'Character discovery, learning, and adventures.'}),
  Object.freeze({id:'creator',title:'Creator',detail:'Original posts, helpful replies and videos.'}),
  Object.freeze({id:'together',title:'Together',detail:'Cooperative missions and community service.'}),
]);
function ordinal(day:string):number {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('Invalid Manila day');
  const d=new Date(day+'T00:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==day)
    throw new Error('Invalid Manila day');
  return d.getTime()/86400000;
}
export function manilaCalendarDay(now:Date=new Date()):string {
  if(!Number.isFinite(now.getTime()))throw new Error('Invalid clock');
  // Visual only; authoritative server account settlements never use this.
  return new Date(now.getTime()+8*3600000).toISOString().slice(0,10);
}
export function deriveBuklodSeasonState(
  season:SeasonSummary|null,day:string,serverSnapshotVerified:boolean,
):SeasonState {
  const today=ordinal(day);
  const result=(phase:SeasonPhase,label:string,verifiedSeason:SeasonSummary|null=season,
    daysUntilStart:number|null=null,daysRemaining:number|null=null,
    progressPercent:number|null=null):SeasonState=>({
    phase,label,season:verifiedSeason,daysUntilStart,daysRemaining,progressPercent,
    rewardEligible:false,
  });
  if(!serverSnapshotVerified)return result('UNVERIFIED','Refresh to verify the Season',null);
  if(!season)return result('NO_ACTIVE_SEASON','No current Season verified',null);
  let start:number,end:number;
  try{start=ordinal(season.starts_on);end=ordinal(season.ends_on);}
  catch{return result('INVALID_SEASON','Season schedule needs verification',null);}
  if(!season.id.trim()||!season.title.trim()||!Number.isSafeInteger(season.number)||
    season.number<=0||end<start)
    return result('INVALID_SEASON','Season schedule needs verification',null);
  if(today<start)
    return result('PREPARATION','Season opening preparation',season,start-today,null,0);
  if(today>end)
    return result('ENDED_AWAITING_CLOSE','Scheduled period ended; results unverified',
      season,0,0,100);
  const length=end-start+1;
  return result('LIVE','Scheduled Season in progress',season,0,end-today+1,
    Math.round((today-start+1)/length*100));
}
export type SeasonNoticeStage=
  'REVEAL_14D'|'CHOOSE_7D'|'PREPARE_3D'|'COUNTDOWN_1D'|
  'OPENING'|'FINAL_WEEK'|'FINAL_DAY'|'AWAITING_RESULTS';
export type SeasonNoticeInput=Readonly<{
  season:SeasonSummary|null;manilaDay:string;serverSnapshotVerified:boolean;
  voluntaryOptIn:boolean;pushAllowed:boolean;quietHours:boolean;
  pendingOfflineOperations:boolean;deliveredKeys:readonly string[];
}>;
export type SeasonNoticePreview=Readonly<{
  stage:SeasonNoticeStage;key:string;title:string;channel:'push'|'in_app';live:false;
}>;
/** Read-only single notice candidate. No delivery/persistence side effects. */
export function previewSeasonNotice(input:SeasonNoticeInput):SeasonNoticePreview|null {
  const state=deriveBuklodSeasonState(input.season,input.manilaDay,
    input.serverSnapshotVerified);
  if(!input.voluntaryOptIn||input.pendingOfflineOperations||!state.season)return null;
  let notice:[SeasonNoticeStage,string]|null=null;
  if(state.phase==='PREPARATION'){
    const plans:Record<number,[SeasonNoticeStage,string]>={
      14:['REVEAL_14D','New Season reveal'],
      7:['CHOOSE_7D','Choose your adventure preview'],
      3:['PREPARE_3D','Three days until Season opening'],
      1:['COUNTDOWN_1D','The Season begins tomorrow'],
    };
    notice=plans[state.daysUntilStart??-1]??null;
  }else if(state.phase==='LIVE'){
    const start=ordinal(state.season.starts_on),today=ordinal(input.manilaDay);
    if(today===start)notice=['OPENING','BUKLOD Season opening'];
    else if(state.daysRemaining===7)notice=['FINAL_WEEK','Season finale in seven days'];
    else if(state.daysRemaining===1)notice=['FINAL_DAY','Last scheduled Season day'];
  }else if(state.phase==='ENDED_AWAITING_CLOSE'&&
    ordinal(input.manilaDay)-ordinal(state.season.ends_on)===1){
    notice=['AWAITING_RESULTS','Season results awaiting verification'];
  }
  if(!notice)return null;
  const key='season-v2:'+state.season.id+':'+notice[0];
  if(input.deliveredKeys.includes(key))return null;
  return {stage:notice[0],key,title:notice[1],
    channel:input.pushAllowed&&!input.quietHours?'push':'in_app',live:false};
}
/** Client never gets a direct finalization/delete capability. */
export function canClientFinalizeOrDeleteSeason():false{return false;}
