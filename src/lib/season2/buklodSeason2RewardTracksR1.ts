/**
 * BUKLOD S2 · two independent, scope-bound reward tracks.
 *
 * SOURCE-ONLY. No backend adapter, earning, payment, mint, or claim.
 * IMPORTANT: these labels classify CONTENT CONTEXT, NEVER the person's
 * faith/religion. The authorized scope at original event time controls mode.
 */
export type S2RewardTrack='show_faith'|'non_show_faith';
export type S2ModeEligibility='show_faith'|'non_show_faith'|'both';
export type S2EvidenceStatus='CANDIDATE_SERVER_SOURCE'|'PENDING_SERVER_VERIFIER'|'NEVER_FINANCIAL';

export const S2_TRACK_ROLLOUT=Object.freeze({
  installed:false,serverAttribution:false,missionClaim:false,tokenMint:false,
  characterAwards:false,automaticModeTransfer:false,productionAuthorized:false,
  affectsLegacyBP:false,affectsQMP:false,affectsCash:false,
});

export const S2_TRACKS=Object.freeze({
 show_faith:{
  id:'show_faith',title:'Show Faith · Faith & Formation',
  p0Learning:'Verified Bible, faith formation, or universally available KL lesson',
  p0Community:'Verified faith/community contribution; private prayer is never required',
  missionKey:'s2_faith_weekly_foundation',
  weeklyBadgePreview:'Faith Foundation Crest',
  learningBadgePreview:'Faith Learning Mark',
  communityBadgePreview:'Faithful Encourager',
  seasonalAwardNamespace:'faith',
 },
 non_show_faith:{
  id:'non_show_faith',title:'Non-Show Faith · Learning & Community',
  p0Learning:'Verified general learning, practical skills, or universally available KL lesson',
  p0Community:'Verified community support, original contribution, or available challenge',
  missionKey:'s2_nonfaith_weekly_foundation',
  weeklyBadgePreview:'Community Foundation Crest',
  learningBadgePreview:'Knowledge Builder Mark',
  communityBadgePreview:'Community Impact Mark',
  seasonalAwardNamespace:'nonfaith',
 },
} as const);

export type S2TrackSource=
 | 'today_dugtong'|'kl_verified_chapter'|'wall_original_post'|'wall_meaningful_comment'
 | 'formation_verified_unit'|'main_bible_qualified_quiz'
 | 'general_learning_verified_unit'|'community_verified_challenge'
 | 'kingdom_verified_mastery'|'children_story_milestone'|'private_prayer';

export type S2TrackSourceRule=Readonly<{
  mode:S2ModeEligibility;
  category:'learning'|'community'|'optional';
  tokens:number;dailyCount:number;
  verification:S2EvidenceStatus;
  creditForFoundation:boolean;
}>;

// Existing approved token amounts are unchanged. Both modes share one
// member-level DAILY ceiling and source-idempotency; switching scopes cannot
// earn a second token grant for a duplicated event.
export const S2_TRACK_SOURCES:Readonly<Record<S2TrackSource,S2TrackSourceRule>>=Object.freeze({
 today_dugtong:{mode:'both',category:'community',tokens:2,dailyCount:1,verification:'CANDIDATE_SERVER_SOURCE',creditForFoundation:true},
 kl_verified_chapter:{mode:'both',category:'learning',tokens:3,dailyCount:1,verification:'CANDIDATE_SERVER_SOURCE',creditForFoundation:true},
 wall_original_post:{mode:'both',category:'community',tokens:2,dailyCount:1,verification:'CANDIDATE_SERVER_SOURCE',creditForFoundation:true},
 wall_meaningful_comment:{mode:'both',category:'community',tokens:1,dailyCount:2,verification:'CANDIDATE_SERVER_SOURCE',creditForFoundation:true},
 formation_verified_unit:{mode:'show_faith',category:'learning',tokens:0,dailyCount:1,verification:'PENDING_SERVER_VERIFIER',creditForFoundation:false},
 main_bible_qualified_quiz:{mode:'show_faith',category:'learning',tokens:0,dailyCount:1,verification:'PENDING_SERVER_VERIFIER',creditForFoundation:false},
 general_learning_verified_unit:{mode:'non_show_faith',category:'learning',tokens:0,dailyCount:1,verification:'PENDING_SERVER_VERIFIER',creditForFoundation:false},
 community_verified_challenge:{mode:'non_show_faith',category:'community',tokens:0,dailyCount:1,verification:'PENDING_SERVER_VERIFIER',creditForFoundation:false},
 kingdom_verified_mastery:{mode:'both',category:'optional',tokens:0,dailyCount:1,verification:'PENDING_SERVER_VERIFIER',creditForFoundation:false},
 children_story_milestone:{mode:'both',category:'optional',tokens:0,dailyCount:1,verification:'NEVER_FINANCIAL',creditForFoundation:false},
 private_prayer:{mode:'show_faith',category:'optional',tokens:0,dailyCount:1,verification:'NEVER_FINANCIAL',creditForFoundation:false},
});

export const S2_BOTH_TRACK_LIMITS=Object.freeze({
 requiredVerifiedLearning:1,requiredDifferentVerifiedCommunity:1,
 normalWeekDays:7,graceDays:3,flexCreditsPerSeason:2,daysPerFlexCredit:7,
 configuredDailyTokens:9,globalDailyTokenCeiling:12,
 oneTokenWalletAcrossTracks:true,oneBPWallet:true,oneQmpFinancialLedger:true,
 noPrayerParticipationRequirement:true,noModeSwitchPenalty:true,
 zeroExtraFaithTokenOrCashBonus:true,
});

export type S2TrackSourceTarget=Readonly<{
 key:string;title:string;comparisonKey:string;bp:number;
 activeLegacyCatalog:boolean;backendVerifierReady:boolean;ruleStatus:'EXISTING_CATALOG_NOT_TRIGGER_PROOF'|'PROPOSED_NOT_LIVE';
 requirements:string;
}>;

// Explicit target parity for NONFAITH. These proposals are NOT extra S1 rules
// or auto-grants. There is no private-religion classification of members.
// An eventual separately approved S2 backend must validate genuine teaching
// content and fair alternate participation before awarding these BP.
export const S2_TRACK_LEARNING_BP=Object.freeze({
 show_faith:[
 {key:'daily_bible',title:'Verified Daily Bible',comparisonKey:'daily_learning',bp:10,activeLegacyCatalog:true,backendVerifierReady:false,ruleStatus:'EXISTING_CATALOG_NOT_TRIGGER_PROOF',requirements:'Qualified Bible reading and original server completion.'},
 {key:'devotional',title:'Verified Devotional',comparisonKey:'reflection',bp:12,activeLegacyCatalog:true,backendVerifierReady:false,ruleStatus:'EXISTING_CATALOG_NOT_TRIGGER_PROOF',requirements:'Accepted nonduplicated devotional.'},
 {key:'bible_quiz_easy',title:'Bible Quiz Easy',comparisonKey:'quiz_easy',bp:3,activeLegacyCatalog:true,backendVerifierReady:false,ruleStatus:'EXISTING_CATALOG_NOT_TRIGGER_PROOF',requirements:'Valid graded Bible quiz attempt.'},
 {key:'bible_quiz_medium',title:'Bible Quiz Medium',comparisonKey:'quiz_medium',bp:6,activeLegacyCatalog:true,backendVerifierReady:false,ruleStatus:'EXISTING_CATALOG_NOT_TRIGGER_PROOF',requirements:'Valid graded Bible quiz attempt.'},
 {key:'bible_quiz_hard',title:'Bible Quiz Hard',comparisonKey:'quiz_hard',bp:12,activeLegacyCatalog:true,backendVerifierReady:false,ruleStatus:'EXISTING_CATALOG_NOT_TRIGGER_PROOF',requirements:'Valid graded Bible quiz attempt.'},
 {key:'formation_lesson',title:'Verified Faith Formation Lesson',comparisonKey:'skills_lesson',bp:25,activeLegacyCatalog:true,backendVerifierReady:false,ruleStatus:'EXISTING_CATALOG_NOT_TRIGGER_PROOF',requirements:'Accepted published formation lesson with verified completion.'},
 ] as readonly S2TrackSourceTarget[],
 non_show_faith:[
 {key:'general_daily_learning',title:'Verified General Daily Reading',comparisonKey:'daily_learning',bp:10,activeLegacyCatalog:false,backendVerifierReady:false,ruleStatus:'PROPOSED_NOT_LIVE',requirements:'Equivalent verified nonreligious learning source, not just opening a page.'},
 {key:'general_reflection',title:'Verified Personal Learning Reflection',comparisonKey:'reflection',bp:12,activeLegacyCatalog:false,backendVerifierReady:false,ruleStatus:'PROPOSED_NOT_LIVE',requirements:'Genuine relevant reflection; never judged by faith or belief.'},
 {key:'general_quiz_easy',title:'Knowledge Quiz Easy',comparisonKey:'quiz_easy',bp:3,activeLegacyCatalog:false,backendVerifierReady:false,ruleStatus:'PROPOSED_NOT_LIVE',requirements:'Valid general learning quiz, same difficulty and source controls.'},
 {key:'general_quiz_medium',title:'Knowledge Quiz Medium',comparisonKey:'quiz_medium',bp:6,activeLegacyCatalog:false,backendVerifierReady:false,ruleStatus:'PROPOSED_NOT_LIVE',requirements:'Valid general learning quiz, same difficulty and source controls.'},
 {key:'general_quiz_hard',title:'Knowledge Quiz Hard',comparisonKey:'quiz_hard',bp:12,activeLegacyCatalog:false,backendVerifierReady:false,ruleStatus:'PROPOSED_NOT_LIVE',requirements:'Valid general learning quiz, same difficulty and source controls.'},
 {key:'general_skills_lesson',title:'Verified Life/Skills Lesson',comparisonKey:'skills_lesson',bp:25,activeLegacyCatalog:false,backendVerifierReady:false,ruleStatus:'PROPOSED_NOT_LIVE',requirements:'Real approved general education module and independent completion.'},
 ] as readonly S2TrackSourceTarget[],
});

export const S2_SHARED_FINANCIAL_POLICY=Object.freeze({
 qmpRatesUnchanged:true,earningsPoolUnchanged:true,monthlySettlementUnchanged:true,
 separateModeReporting:true,neverSplitOrMultiplyOriginalQmp:true,
 noFaithBasedCashMultiplier:true,neverHideOrDebitLegacyRewards:true,
});

export const S2_TRACK_BADGE_PREVIEWS=Object.freeze([
 {key:'faith_learning_mark',track:'show_faith',criteria:'Qualified Show Faith learning milestone verified in this scope and track.',bp:0,tokens:0,status:'PREVIEW_NOT_LIVE'},
 {key:'faithful_encourager',track:'show_faith',criteria:'Distinct verified community encouragement; no private prayer content or sincerity rating.',bp:0,tokens:0,status:'PREVIEW_NOT_LIVE'},
 {key:'faith_foundation_crest',track:'show_faith',criteria:'One distinct learning and one distinct social receipt in a closed Show Faith week.',bp:0,tokens:0,status:'PREVIEW_NOT_LIVE'},
 {key:'knowledge_builder_mark',track:'non_show_faith',criteria:'Qualified general learning milestone verified in this scope and track.',bp:0,tokens:0,status:'PREVIEW_NOT_LIVE'},
 {key:'community_impact_mark',track:'non_show_faith',criteria:'Distinct verified nonfaith community contribution; no faith requirement.',bp:0,tokens:0,status:'PREVIEW_NOT_LIVE'},
 {key:'community_foundation_crest',track:'non_show_faith',criteria:'One distinct learning and one distinct social receipt in a closed Non-Show Faith week.',bp:0,tokens:0,status:'PREVIEW_NOT_LIVE'},
] as const);

export type S2VisibleScope=Readonly<{
 scope_id?:string|null; show_faith_content?:boolean|null;
 scope_status?:string|null;
}>;
/** UI classification ONLY: cached client scope is never authority to mint. */
export function previewTrackForScope(scope:S2VisibleScope|null|undefined):S2RewardTrack|null{
 if(!scope?.scope_id||typeof scope.show_faith_content!=='boolean')return null;
 if(scope.scope_status&&scope.scope_status.toUpperCase()!=='ACTIVE')return null;
 return scope.show_faith_content?'show_faith':'non_show_faith';
}

export function sourceAvailableInTrack(source:S2TrackSource,track:S2RewardTrack):boolean{
 if(track!=='show_faith'&&track!=='non_show_faith')return false;
 const rule=S2_TRACK_SOURCES[source];
 return !!rule&&(rule.mode==='both'||rule.mode===track);
}
export function sourceKeyAcrossTracks(userId:string,kind:string,sourceId:string):string{
 if(!userId||!sourceId||!kind)throw Error('Missing immutable source identity');
 // No scope or mode in key: same source cannot claim twice after switching.
 return JSON.stringify([userId,kind,sourceId]);
}
export type S2TrackedEvidence=Readonly<{
 userId:string;scopeId:string;source:S2TrackSource;sourceId:string;
 scopeModeAtEvent:S2RewardTrack;serverVerified:boolean;accepted:boolean;
 originalEventTimeVerified:boolean;memberOfScopeAtEvent:boolean;isMainApp:boolean;
}>;
export type S2TrackEvaluation=Readonly<{
 live:false;eligibleForPreview:boolean;track:S2RewardTrack|null;
 reason:'NO_SCOPE'|'WRONG_SCOPE'|'WRONG_TRACK'|'UNKNOWN_SOURCE'|
 'UNVERIFIED'|'NOT_MEMBER_AT_EVENT'|'INACTIVE_SOURCE'|'ELIGIBLE_PREVIEW';
 receiptKey:string|null;bonusBP:0;creditedTokens:0;
}>;
export function previewS2TrackEvidence(
 evidence:S2TrackedEvidence,visibleScope:S2VisibleScope|null,
 seenSources:ReadonlySet<string>=new Set(),
):S2TrackEvaluation{
 const track=previewTrackForScope(visibleScope);
 const result=(reason:S2TrackEvaluation['reason'],key:string|null=null):S2TrackEvaluation=>({
  live:false,eligibleForPreview:reason==='ELIGIBLE_PREVIEW',
  track,reason,receiptKey:key,bonusBP:0,creditedTokens:0,
 });
 if(!track)return result('NO_SCOPE');
 if(!evidence.userId||!evidence.sourceId||!evidence.scopeId||
    evidence.scopeId!==visibleScope?.scope_id)return result('WRONG_SCOPE');
 if(evidence.scopeModeAtEvent!==track)return result('WRONG_TRACK');
 if(!Object.prototype.hasOwnProperty.call(S2_TRACK_SOURCES,evidence.source))return result('UNKNOWN_SOURCE');
 if(!sourceAvailableInTrack(evidence.source,track))return result('WRONG_TRACK');
 if(!evidence.memberOfScopeAtEvent)return result('NOT_MEMBER_AT_EVENT');
 if(!evidence.serverVerified||!evidence.accepted||
    !evidence.originalEventTimeVerified||!evidence.isMainApp)return result('UNVERIFIED');
 const rule=S2_TRACK_SOURCES[evidence.source];
 if(!rule.creditForFoundation||rule.verification!=='CANDIDATE_SERVER_SOURCE')return result('INACTIVE_SOURCE');
 const key=sourceKeyAcrossTracks(evidence.userId,evidence.source,evidence.sourceId);
 if(seenSources.has(key))return result('INACTIVE_SOURCE');
 return result('ELIGIBLE_PREVIEW',key);
}

export type S2TrackWeeklyEvidence=Readonly<{
 weekStartManila:string;track:S2RewardTrack;scopeId:string;
 sources:readonly S2TrackedEvidence[];scope:S2VisibleScope|null;
}>;
// Distinct source receipt is required; even two different categories from one
// source event cannot satisfy the two slots. Actual weekly close/claim is server only.
export function previewS2TrackFoundation(input:S2TrackWeeklyEvidence):Readonly<{
 live:false;learning:boolean;community:boolean;completePreview:boolean;
 scopeTrackMatched:boolean;bonusBP:0;creditedTokens:0;
}>{
 const scopeTrackMatched=previewTrackForScope(input.scope)===input.track&&
  input.scope?.scope_id===input.scopeId;
 const unique=new Set<string>();let learning=false,community=false;
 if(scopeTrackMatched)for(const e of input.sources){
  const v=previewS2TrackEvidence(e,input.scope,unique);
  if(!v.eligibleForPreview||!v.receiptKey)continue;
  unique.add(v.receiptKey);
  const rule=S2_TRACK_SOURCES[e.source];
  if(rule.category==='learning')learning=true;
  if(rule.category==='community')community=true;
 }
 return {live:false,learning,community,completePreview:learning&&community,
  scopeTrackMatched,bonusBP:0,creditedTokens:0};
}
