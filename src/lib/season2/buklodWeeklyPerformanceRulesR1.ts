/**
 * BUKLOD Season 2 WEEKLY PERFORMANCE — read-only presentation contract.
 *
 * Never credits Season 1 BP, changes Circle Rank, QMP/AdMob payouts or
 * creates Season 2 assets. The backend is the only authority for evidence.
 */
export type BuklodWeeklyClass = 'unrated' | 'emerging' | 'active' | 'thrive' | 'exceptional';
export type BuklodWeeklyEvidence = Readonly<{
  user_id: string;
  week_start: string;
  class_code: BuklodWeeklyClass;
  score: number;
  active_days: number;
  learning_days: number;
  community_days: number;
  creation_days: number;
}>;
export const WEEKLY_PERFORMANCE_RULE_VERSION = 's2-weekly-performance-r1';
export const WEEKLY_CLASS_META: Readonly<Record<BuklodWeeklyClass, Readonly<{
  title: string;
  icon: 'sprout' | 'flash' | 'fire' | 'star-four-points' | 'minus-circle-outline';
  color: string;
  next: BuklodWeeklyClass | null;
  rewardPreview: string;
}>>> = Object.freeze({
  unrated: {title:'Unrated',icon:'minus-circle-outline',color:'#71807A',next:'emerging',rewardPreview:'Walang reward habang unrated'},
  emerging: {title:'Emerging',icon:'sprout',color:'#388852',next:'active',rewardPreview:'Participation recognition lamang'},
  active: {title:'Active',icon:'flash',color:'#287BC5',next:'thrive',rewardPreview:'Weekly achievement emblem (Season 2 preview)'},
  thrive: {title:'Thrive',icon:'fire',color:'#874BC4',next:'exceptional',rewardPreview:'Weekly cosmetic frame (Season 2 preview)'},
  exceptional: {title:'Exceptional',icon:'star-four-points',color:'#B78416',next:null,rewardPreview:'Exceptional weekly collectible (Season 2 preview)'},
});
export const WEEKLY_PERFORMANCE_TIERS = Object.freeze([
  {class_code:'emerging', minScore:1, minDays:1, minCategories:1},
  {class_code:'active', minScore:25, minDays:2, minCategories:1},
  {class_code:'thrive', minScore:60, minDays:3, minCategories:2},
  {class_code:'exceptional', minScore:85, minDays:4, minCategories:2},
] as const);
export type BuklodWeeklyBuckets = Readonly<{
  active_days: number;
  learning_days: number;
  community_days: number;
  creation_days: number;
}>;
const bounded = (n: unknown, cap: number): number => Number.isFinite(Number(n)) ?
  Math.min(cap, Math.max(0, Math.floor(Number(n)))) : 0;
/** Mirror of the server contract for unit tests and explanatory progress ONLY.
 * Never use these client-calculated values to grant a class or reward.
 */
export function previewWeeklyClassification(b: BuklodWeeklyBuckets): Readonly<{
  score: number;
  class_code: BuklodWeeklyClass;
  category_count: number;
}> {
  const days=bounded(b.active_days,7);
  const learning=bounded(b.learning_days,5);
  const community=bounded(b.community_days,5);
  const creation=bounded(b.creation_days,5);
  const category_count=Number(learning>0)+Number(community>0)+Number(creation>0);
  const score=Math.min(100,days*5+learning*6+community*7+creation*6);
  const class_code:BuklodWeeklyClass =
    score>=85&&days>=4&&category_count>=2?'exceptional':
    score>=60&&days>=3&&category_count>=2?'thrive':
    score>=25&&days>=2?'active':
    score>0?'emerging':'unrated';
  return {score,class_code,category_count};
}
/** Monday 00:00 Asia/Manila, regardless of device timezone. */
export function manilaWeekStart(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(now);
  const value=(key:string)=>Number(parts.find(p=>p.type===key)?.value);
  const d=new Date(Date.UTC(value('year'),value('month')-1,value('day')));
  const offset=(d.getUTCDay()+6)%7;
  return new Date(d.getTime()-offset*86400000).toISOString().slice(0,10);
}
export function parseVerifiedWeeklyClass(value: unknown): BuklodWeeklyClass | null {
  if(typeof value!=='string')return null;
  return Object.prototype.hasOwnProperty.call(WEEKLY_CLASS_META,value) ? value as BuklodWeeklyClass : null;
}
export function normalizeVerifiedWeeklyEvidence(raw: unknown, userId: string, weekStart=manilaWeekStart()): BuklodWeeklyEvidence | null {
  if(!raw||typeof raw!=='object')return null;
  const x=raw as Record<string,unknown>;
  const user=String(x.user_id??'').toLowerCase();
  if(!userId||user!==userId.toLowerCase()||x.week_start!==weekStart)return null;
  const class_code=parseVerifiedWeeklyClass(x.class_code);
  const keys=['score','active_days','learning_days','community_days','creation_days'] as const;
  if(!class_code||keys.some(k=>typeof x[k]!=='number'||!Number.isInteger(x[k])||(x[k] as number)<0))return null;
  if((x.score as number)>100||(x.active_days as number)>7||['learning_days','community_days','creation_days'].some(k=>(x[k] as number)>7))return null;
  return {
    user_id:user,week_start:weekStart,class_code,
    score:x.score as number,active_days:x.active_days as number,
    learning_days:x.learning_days as number,community_days:x.community_days as number,
    creation_days:x.creation_days as number,
  };
}
export const WEEKLY_REWARD_POLICY = Object.freeze({
  previewOnly:true,
  grantsEnabled:false,
  mintedSeason1BP:0,
  mintedCash:0,
  mintedQMP:0,
  autoIssuedTokens:0,
  onePerUserPerManilaWeek:true,
  noDuplicateSources:true,
  cosmeticOnlyOnSeparateS2BackendApproval:true,
  noTransferOrWithdrawal:true,
});
