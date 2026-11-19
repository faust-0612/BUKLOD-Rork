/**
 * Season 2 weekly class recognition — NON-MINTING eligibility contract.
 * A future server job can use this intent only after proof of a completed
 * Manila week, review of anti-farm evidence, and separate grant authorization.
 * This code NEVER executes a Season 1/2 wallet or inventory mutation.
 */
import type { BuklodWeeklyClass } from './buklodWeeklyPerformanceRulesR1';

export type S2WeeklyRewardKey =
  | 'weekly_active_emblem'
  | 'weekly_thrive_frame'
  | 'weekly_exceptional_collectible';
export type S2WeeklyRewardIntent = Readonly<{
  idempotencyKey: string | null;
  reward: S2WeeklyRewardKey | null;
  status: 'NO_REWARD' | 'WEEK_NOT_FINAL' | 'HELD_SEASON2_BACKEND';
  season2GrantExecuted: false;
  season1PointsAwarded: 0;
  tokensAwarded: 0;
  cashAwarded: 0;
}>;
const PRIZE_BY_CLASS: Readonly<Partial<Record<BuklodWeeklyClass, S2WeeklyRewardKey>>> = Object.freeze({
  active:'weekly_active_emblem',
  thrive:'weekly_thrive_frame',
  exceptional:'weekly_exceptional_collectible',
});
/** Preview intent ONLY; `attested` is not permission to mint.
 * Do not accept a client boolean as proof of server verification.
 */
export function planS2WeeklyReward(input: {
  userId:string;
  weekStart:string;
  classification:BuklodWeeklyClass;
  weekClosedAndVerified:boolean;
}):S2WeeklyRewardIntent {
  if(!/^[a-f0-9]{8}-[a-f0-9-]{27,36}$/i.test(input.userId))throw Error('Invalid subject');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.weekStart))throw Error('Invalid Manila week');
  const weekMs=Date.parse(input.weekStart+'T00:00:00Z');
  if(!Number.isFinite(weekMs) || new Date(weekMs).toISOString().slice(0,10)!==input.weekStart ||
     new Date(weekMs).getUTCDay()!==1)throw Error('Not a Manila Monday');
  const reward=PRIZE_BY_CLASS[input.classification]??null;
  const idempotencyKey=reward?`s2_weekly_performance:${input.userId.toLowerCase()}:${input.weekStart}`:null;
  return {
    idempotencyKey,
    reward,
    status:!reward?'NO_REWARD':!input.weekClosedAndVerified?'WEEK_NOT_FINAL':'HELD_SEASON2_BACKEND',
    season2GrantExecuted:false,season1PointsAwarded:0,tokensAwarded:0,cashAwarded:0,
  };
}
/** No client-side grant channel exists in the staging preview. */
export function mayClientMintWeeklyReward():false{return false;}
