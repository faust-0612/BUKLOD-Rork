/**
 * BUKLOD Season 2 — "Rise Together / Ang Panibagong Yugto".
 * Editorial content and preview only. Not a published Season schedule.
 * No backend grant, QMP change, BP deduction, token or notification.
 */
import type {BuklodCharacterWorldId} from './buklodCharacterWorldCatalog';

export const BUKLOD_SEASON2_CAMPAIGN=Object.freeze({
  slug:'rise-together',
  title:'Rise Together',
  subtitle:'Ang Panibagong Yugto',
  ownerOpeningTargetManilaDay:'2026-12-06',
  officialOpeningPublished:false,
  officialEndManilaDay:null,
  recommendedWeeks:12,
  seasonRuleVersion:'season-2-design-r1-off',
  redemptionLive:false,
  missionAwardsLive:false,
  chapterPublishingLive:false,
  cooperativeAwardsLive:false,
  inactivityDeductionsLive:false,
});
export type BuklodSeason2Track='explorer'|'creator'|'together';
export type BuklodSeason2Act=Readonly<{
  id:'CALL'|'MAKE'|'BOND'|'LEGACY';
  number:number;title:string;localTitle:string;weeks:readonly [number,number];
  story:string;goal:string;teaser:string;
  cosmeticPreview:string;
}>;
export const BUKLOD_SEASON2_ACTS:readonly BuklodSeason2Act[]=Object.freeze([
  Object.freeze({id:'CALL',number:1,title:'The Call',localTitle:'Ang Tawag',
    weeks:[1,3] as const,
    story:'A forgotten beacon lights the first path. Every member may choose how to explore.',
    goal:'Learn the world, choose a journey and make one genuine connection.',
    teaser:'A secret map appears — but nobody must post, pray, or disclose private details to take part.',
    cosmeticPreview:'Beacon Trail profile accent'}),
  Object.freeze({id:'MAKE',number:2,title:'The Makers',localTitle:'Mga Tagapagbuo',
    weeks:[4,6] as const,
    story:'The community restores its creative district by sharing original ideas and stories.',
    goal:'Create something meaningful, or contribute through verified learning and support.',
    teaser:'Each authentic story adds light to the district; spam and duplicate engagement do not.',
    cosmeticPreview:'Maker Ribbon Character accessory'}),
  Object.freeze({id:'BOND',number:3,title:'The Alliance',localTitle:'Ang Ugnayan',
    weeks:[7,9] as const,
    story:'Thirteen guides build bridges between neighbors, creators and small teams.',
    goal:'Complete optional cooperative goals with a solo route when no team is available.',
    teaser:'An unfinished bridge opens as different kinds of real participation connect.',
    cosmeticPreview:'Alliance Crest earned badge'}),
  Object.freeze({id:'LEGACY',number:4,title:'The Legacy',localTitle:'Ang Pamana',
    weeks:[10,12] as const,
    story:'The beacon becomes a constellation. Members revisit what they genuinely built.',
    goal:'Finish the narrative, reconcile verified milestones, and celebrate earned results.',
    teaser:'Choose the closing memory you want to keep — the finale is not a paid reward.',
    cosmeticPreview:'Legacy Constellation scene effect'}),
]);
export type BuklodSeason2Week=Readonly<{
  week:number;act:BuklodSeason2Act['id'];title:string;chapterBeat:string;
  primaryEvidence:string;alternativePath:string;rewardCategory:'preview_only';
}>;
export const BUKLOD_SEASON2_WEEKLY_BEATS:readonly BuklodSeason2Week[]=Object.freeze([
  {week:1,act:'CALL',title:'The First Signal',chapterBeat:'A map of 13 paths awakens.',
    primaryEvidence:'Account-scoped Character selection, no season grant',
    alternativePath:'Free story orientation',rewardCategory:'preview_only'},
  {week:2,act:'CALL',title:'The Story Door',chapterBeat:'Find the first clue in a story.',
    primaryEvidence:'Real verified Main Today/Dugtong or KL source',
    alternativePath:'Read and discover without financial reward',rewardCategory:'preview_only'},
  {week:3,act:'CALL',title:'The First Ally',chapterBeat:'A single authentic connection becomes a bridge.',
    primaryEvidence:'Server-qualified meaningful reply, not a reaction ring',
    alternativePath:'Solo discovery/chapter completion',rewardCategory:'preview_only'},
  {week:4,act:'MAKE',title:'Maker Square',chapterBeat:'Community creators rebuild a public square.',
    primaryEvidence:'Unique legitimate original Wall post if opted in',
    alternativePath:'Verified learning or creator-support journey',rewardCategory:'preview_only'},
  {week:5,act:'MAKE',title:'Stories in Motion',chapterBeat:'Visual stories illuminate the town.',
    primaryEvidence:'Qualified original video if available and consented',
    alternativePath:'Text/photo creation or learning; no video requirement',rewardCategory:'preview_only'},
  {week:6,act:'MAKE',title:'The Shared Page',chapterBeat:'A respectful discussion becomes a living archive.',
    primaryEvidence:'Distinct anti-farm reply/creation receipts',
    alternativePath:'Single-player story reflection, no public disclosure',rewardCategory:'preview_only'},
  {week:7,act:'BOND',title:'Bridge Builders',chapterBeat:'The guides meet across communities.',
    primaryEvidence:'Verified voluntary formation or equivalent general learning',
    alternativePath:'Non-Show-Faith pathway pending real source verification',
    rewardCategory:'preview_only'},
  {week:8,act:'BOND',title:'The Kingdom Trial',chapterBeat:'A noncash practice challenge tests skill.',
    primaryEvidence:'Server-confirmed Main Kingdom mastery only if later implemented',
    alternativePath:'No-cost practice and story exploration',rewardCategory:'preview_only'},
  {week:9,act:'BOND',title:'Together We Rise',chapterBeat:'A cooperative bridge lights up for everyone.',
    primaryEvidence:'Verified per-user contribution; no forced invites',
    alternativePath:'Solo chapter completion for ungrouped members',rewardCategory:'preview_only'},
  {week:10,act:'LEGACY',title:'The Memory Gallery',chapterBeat:'Earned artifacts tell an individual story.',
    primaryEvidence:'Server-owned existing Character inventory receipts',
    alternativePath:'View catalog and owned-item history free',rewardCategory:'preview_only'},
  {week:11,act:'LEGACY',title:'The Last Clue',chapterBeat:'An optional catch-up path opens.',
    primaryEvidence:'New, still-eligible verified source only; no retroactive farming',
    alternativePath:'Safe replay of story content with zero new credits',rewardCategory:'preview_only'},
  {week:12,act:'LEGACY',title:'Constellation Finale',chapterBeat:'The story closes with confirmed achievements.',
    primaryEvidence:'Published immutable Season results and canonical ownership',
    alternativePath:'Watch/read finale without competitive participation',rewardCategory:'preview_only'},
]);
export type Season2CharacterCast=Readonly<{role:string;line:string}>;
export const BUKLOD_SEASON2_CHARACTER_CAST:Readonly<
  Record<BuklodCharacterWorldId,Season2CharacterCast>>=Object.freeze({
  phan:{role:'Builder',line:'Every shared tool helps someone begin.'},
  quin:{role:'Pathfinder',line:'Our route grows when we look beyond ourselves.'},
  van:{role:'Guide',line:'A small kindness lights a new way.'},
  christian:{role:'Guardian',line:'Strong communities protect their people.'},
  lhen:{role:'Story Keeper',line:'Let us save the memories worth sharing.'},
  ace:{role:'Inventor',line:'The most useful creation solves a real problem.'},
  ellusur:{role:'Navigator',line:'You can always find a new route.'},
  jawo:{role:'Connector',line:'A real conversation is a bridge.'},
  mitch:{role:'Artist',line:'Every voice has a story.'},
  niel:{role:'Strategist',line:'We are stronger when the plan is fair.'},
  angel:{role:'Steward',line:'We protect what others trust to us.'},
  vhen:{role:'Cultivator',line:'Growth takes patience, not shortcuts.'},
  trudice:{role:'Explorer',line:'The next discovery can be yours.'},
});
export const BUKLOD_SEASON2_CAST_ORDER:readonly BuklodCharacterWorldId[]=Object.freeze([
  'phan','quin','van','christian','lhen','ace','ellusur','jawo',
  'mitch','niel','angel','vhen','trudice',
]);
export type Season2RewardPreview=Readonly<{
  key:string;name:string;kind:'cosmetic'|'earned_badge'|'scene';
  sourceAuthority:'CHARACTER_VERIFIED_RECEIPT';
  available:false;spendable:false;
}>;
export const BUKLOD_SEASON2_REWARDS:readonly Season2RewardPreview[]=Object.freeze([
  {key:'s2_beacon_trail',name:'Beacon Trail Frame',kind:'cosmetic',
    sourceAuthority:'CHARACTER_VERIFIED_RECEIPT',available:false,spendable:false},
  {key:'s2_maker_ribbon',name:'Maker Ribbon',kind:'cosmetic',
    sourceAuthority:'CHARACTER_VERIFIED_RECEIPT',available:false,spendable:false},
  {key:'s2_alliance_crest',name:'Alliance Crest',kind:'earned_badge',
    sourceAuthority:'CHARACTER_VERIFIED_RECEIPT',available:false,spendable:false},
  {key:'s2_constellation',name:'Constellation Finale Scene',kind:'scene',
    sourceAuthority:'CHARACTER_VERIFIED_RECEIPT',available:false,spendable:false},
]);
export function previewSeason2ActForWeek(week:number):BuklodSeason2Act|null{
  if(!Number.isSafeInteger(week)||week<1||week>12)return null;
  return BUKLOD_SEASON2_ACTS.find(x=>week>=x.weeks[0]&&week<=x.weeks[1])??null;
}
export type Season2LaunchEvidence=Readonly<{
  historicalSeasonClosedAndSigned:boolean;
  allEligiblePendingEventsReconciled:boolean;
  officialStartAndEndPublished:boolean;
  characterInventoryReceiptsVerified:boolean;
  qmpAndAdMobProtected:boolean;
  androidRcRuntimeVerified:boolean;
  adAndInstantNavigationRegressionsPassed:boolean;
  stagedBackendAndOfflineTestsPassed:boolean;
  ownerAuthorizedFinalLaunch:boolean;
}>;
export function assessSeason2LaunchEvidence(e:Season2LaunchEvidence):{
  canLaunch:boolean;missing:readonly (keyof Season2LaunchEvidence)[];
  sourceOnly:true;
}{
  const missing=(Object.keys(e) as (keyof Season2LaunchEvidence)[])
    .filter(k=>e[k]!==true);
  // A complete receipt report is still only a design/evidence check, not
  // a capability to publish a Season, send notices or mutate a ledger.
  return {canLaunch:missing.length===0,missing,sourceOnly:true};
}
/** A visual, 12-week CONTENT BLUEPRINT. No official end is inferred. */
export function previewSeason2EditorialWeek(
  week:number,startDay:string=BUKLOD_SEASON2_CAMPAIGN.ownerOpeningTargetManilaDay,
):{week:number;date:string;published:false}|null{
  if(!Number.isSafeInteger(week)||week<1||week>12)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDay))return null;
  const d=new Date(startDay+'T00:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==startDay)return null;
  return {week,date:new Date(d.getTime()+(week-1)*7*86400000).toISOString().slice(0,10),
    published:false};
}
