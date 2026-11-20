/** Exact 1–10 owner-approved Season 2 scope, isolated from Season 1.
 * Staging visual catalogue only. Does not run network, award, enroll or publish. */
export type S2ApprovedFeature = Readonly<{id:string;number:number;title:string;explanation:string;status:'STORY_PREVIEW'|'CATALOG_PREVIEW'|'AWARDS_HELD'|'BACKEND_HELD'|'RECONCILIATION_HELD';locked:true}>;
export const S2_EXCLUSIVE_FEATURES:readonly S2ApprovedFeature[]=Object.freeze([
  Object.freeze({id:'rise_together_campaign',number:1,title:"Rise Together — 13 Guides / 12 Weeks",explanation:"13 guides, four arcs, three optional paths and replayable prologue",status:'STORY_PREVIEW' as const,locked:true as const}),
  Object.freeze({id:'journey_token_wallet',number:2,title:"Journey Tokens / Noncash Wallet",explanation:"Wallet, token earn/spend and cosmetics are source contracts only; no real grants",status:'BACKEND_HELD' as const,locked:true as const}),
  Object.freeze({id:'character_mastery_1300',number:3,title:"1,300 Character Mastery Items",explanation:"13 characters × 20 levels × 5 slots; prerequisite and benefits guide",status:'CATALOG_PREVIEW' as const,locked:true as const}),
  Object.freeze({id:'weekly_performance_class',number:4,title:"Weekly Performance Classification",explanation:"Emerging / Active / Thrive / Exceptional; cosmetic reward intents held",status:'BACKEND_HELD' as const,locked:true as const}),
  Object.freeze({id:'four_season_awards',number:5,title:"Four Earned Seasonal Awards",explanation:"Beacon Trail Frame / Maker Ribbon / Alliance Crest / Constellation Finale Scene",status:'AWARDS_HELD' as const,locked:true as const}),
  Object.freeze({id:'kingdom_cooperative_missions',number:6,title:"Kingdom & Cooperative Missions",explanation:"Character-owned receipts, genuine cooperative evidence, solo alternatives",status:'BACKEND_HELD' as const,locked:true as const}),
  Object.freeze({id:'foundation_momentum_grace_antifarm',number:7,title:"Foundation, Momentum & Fair Play",explanation:"7+3-day grace, 2 optional 7-day Flex, server anti-farm and no BP/QMP deductions",status:'BACKEND_HELD' as const,locked:true as const}),
  Object.freeze({id:'kl_progressive_pending_bp',number:8,title:"KL Progressive Chapter BP",explanation:"Chapter N: 5+N pending until chapter N+1 verified; chapter 30 rolls to next series",status:'BACKEND_HELD' as const,locked:true as const}),
  Object.freeze({id:'seasonal_archival_carryover',number:9,title:"Season Carryover & Hall of Fame",explanation:"Signed archive before reset; preserve lifetime, monthly, per-character and finance",status:'BACKEND_HELD' as const,locked:true as const}),
  Object.freeze({id:'qualified_referral_rank_reward',number:10,title:"Qualified Referral Rank Reward",explanation:"Conditional referrer +20 BP only on verified cluster-rank gain; referred +10 BP; avoid double grants",status:'RECONCILIATION_HELD' as const,locked:true as const}),
]);
export const S2_EXCLUSIVE_SCOPE_ROLLOUT=Object.freeze({
  previewOnly:true,productionAuthorized:false,backendRewardsLive:false,
  tokenMint:false,tokenSpend:false,badgeGrants:false,chapterBpCredits:false,
  seasonalRollover:false,referralDoubleGrant:false,
  productionNotBefore:'2026-12-06T00:00:00+08:00',
  requiresNewOwnerApproval:true,themeWorkIncluded:false,
});
export function isApprovedSeason2Exclusive(id:string):boolean {
  return S2_EXCLUSIVE_FEATURES.some(item=>item.id===id);
}
/** Nothing in this preview is a grant or access entitlement. */
export function canActivateSeason2Exclusive():false {return false;}
