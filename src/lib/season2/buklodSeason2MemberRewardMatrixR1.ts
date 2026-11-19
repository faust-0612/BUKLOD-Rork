/**
 * Season 2 user-facing, fully offline reference from the audited Nov 19
 * BUKLOD BP/QMP catalog and owner-approved S2 implementation target.
 * NO network calls, NO grants, NO live backend source of authority.
 * If rules change, regenerate from the independently verified catalog and
 * update regression tests before approval; never silently mutate Season1.
 */
export const S2_MEMBER_GUIDE_SNAPSHOT = '2026-11-19' as const;
export type S2BpGroup = 'community'|'learning'|'service'|'game_quiz'|'milestones'|'admin';
export type S2BpCatalogEntry = Readonly<{
  id:string;title:string;group:S2BpGroup;bp:number;dayCapBP:number|null;condition:string;
}>;
export const S2_LEGACY_BP_ACTIVE:readonly S2BpCatalogEntry[] = Object.freeze([
  {
    "id": "abc_growth_lesson",
    "title": "ABC Growth Lesson",
    "group": "learning",
    "bp": 8,
    "dayCapBP": null,
    "condition": "Tapusin ang 1 tunay at verified ABC Growth lesson; no repeat credit for the same lesson."
  },
  {
    "id": "achievement_bible_scholar",
    "title": "Achievement Bible Scholar",
    "group": "milestones",
    "bp": 100,
    "dayCapBP": 100,
    "condition": "Milestone: 28 verified ABC lessons, supporting records, application/evidence verification. +100 BP once eligible."
  },
  {
    "id": "achievement_community_builder",
    "title": "Achievement Community Builder",
    "group": "milestones",
    "bp": 150,
    "dayCapBP": 150,
    "condition": "Milestone: real, documented community project with beneficiaries and independently verified evidence. +150 BP."
  },
  {
    "id": "achievement_faithful_mentor",
    "title": "Achievement Faithful Mentor",
    "group": "milestones",
    "bp": 200,
    "dayCapBP": 200,
    "condition": "Milestone: 4 approved teaching sessions with real mentor/mentee records and supporting evidence. +200 BP."
  },
  {
    "id": "achievement_kingdom_champion",
    "title": "Achievement Kingdom Champion",
    "group": "milestones",
    "bp": 250,
    "dayCapBP": 250,
    "condition": "Milestone: 20 recorded Kingdom levels PLUS independent event verification; client score alone cannot award. +250 BP."
  },
  {
    "id": "admin_bonus",
    "title": "Admin Bonus",
    "group": "admin",
    "bp": 0,
    "dayCapBP": null,
    "condition": "Admin-controlled only. No public self-claim or automatic +BP."
  },
  {
    "id": "admin_manual_award",
    "title": "Admin Manual Award",
    "group": "admin",
    "bp": 0,
    "dayCapBP": null,
    "condition": "Restricted, audited administrative grant only. Default +0, not a member action."
  },
  {
    "id": "bible_arena_monthly",
    "title": "Bible Arena Monthly",
    "group": "game_quiz",
    "bp": 15,
    "dayCapBP": null,
    "condition": "Valid verified eligible monthly Bible Arena activity/event; source-controlled, not automatic for opening."
  },
  {
    "id": "bible_flash_easy",
    "title": "Bible Flash Easy",
    "group": "game_quiz",
    "bp": 1,
    "dayCapBP": null,
    "condition": "Passed/accepted verified Bible Flash Easy event; server validates source."
  },
  {
    "id": "bible_flash_medium",
    "title": "Bible Flash Medium",
    "group": "game_quiz",
    "bp": 3,
    "dayCapBP": null,
    "condition": "Passed/accepted verified Bible Flash Medium event; server validates source."
  },
  {
    "id": "bible_flash_hard",
    "title": "Bible Flash Hard",
    "group": "game_quiz",
    "bp": 6,
    "dayCapBP": null,
    "condition": "Passed/accepted verified Bible Flash Hard event; server validates source."
  },
  {
    "id": "bible_quiz_easy",
    "title": "Bible Quiz Easy",
    "group": "learning",
    "bp": 3,
    "dayCapBP": 3,
    "condition": "Five questions, passing threshold 4/5, one legitimate daily qualified attempt/account (Manila date)."
  },
  {
    "id": "bible_quiz_medium",
    "title": "Bible Quiz Medium",
    "group": "learning",
    "bp": 6,
    "dayCapBP": 6,
    "condition": "Five questions, passing threshold 4/5, one legitimate daily qualified attempt/account (Manila date)."
  },
  {
    "id": "bible_quiz_hard",
    "title": "Bible Quiz Hard",
    "group": "learning",
    "bp": 12,
    "dayCapBP": 12,
    "condition": "Five questions, passing threshold 4/5, one legitimate daily qualified attempt/account (Manila date)."
  },
  {
    "id": "community_chain_resolve",
    "title": "Community Chain Resolve",
    "group": "community",
    "bp": 1,
    "dayCapBP": 3,
    "condition": "Server-verified meaningful support-chain completion with distinct qualified members; catalog cap 3 BP/day. Related +3 BP three-member proposal is NOT confirmed live."
  },
  {
    "id": "community_challenge_complete",
    "title": "Community Challenge Complete",
    "group": "community",
    "bp": 2,
    "dayCapBP": 6,
    "condition": "Complete an eligible accepted community challenge; source and duplicate protection, up to 6 BP/day catalog cap."
  },
  {
    "id": "community_comment",
    "title": "Community Comment",
    "group": "community",
    "bp": 2,
    "dayCapBP": null,
    "condition": "Real accepted community comment by member, no self-farming or repeat replay; no second credit on edit."
  },
  {
    "id": "community_dugtong",
    "title": "Community Dugtong",
    "group": "community",
    "bp": 1,
    "dayCapBP": 8,
    "condition": "Valid original approved Today/Dugtong response; catalog cap 8 BP/day."
  },
  {
    "id": "community_helpful_dugtong",
    "title": "Community Helpful Dugtong",
    "group": "community",
    "bp": 2,
    "dayCapBP": 6,
    "condition": "Distinct verified helpful Dugtong response; catalog cap 6 BP/day."
  },
  {
    "id": "community_poll_vote",
    "title": "Community Poll Vote",
    "group": "community",
    "bp": 1,
    "dayCapBP": 5,
    "condition": "One valid member-owned poll vote per eligible poll; catalog cap 5 BP/day."
  },
  {
    "id": "community_post",
    "title": "Community Post",
    "group": "community",
    "bp": 5,
    "dayCapBP": null,
    "condition": "One genuine originally published and moderated Wall post; rejected/deleted/spam posts excluded."
  },
  {
    "id": "community_reaction",
    "title": "Community Reaction",
    "group": "community",
    "bp": 1,
    "dayCapBP": null,
    "condition": "One genuine reaction to eligible content; do not farm self-reactions, bots or repeats."
  },
  {
    "id": "community_resource_used",
    "title": "Community Resource Used",
    "group": "community",
    "bp": 1,
    "dayCapBP": 5,
    "condition": "Server-confirmed eligible community resource usage, not merely opening screen; cap 5 BP/day."
  },
  {
    "id": "community_takeaway_share",
    "title": "Community Takeaway Share",
    "group": "community",
    "bp": 1,
    "dayCapBP": 2,
    "condition": "Server-verified substantive community takeaway share; cap 2 BP/day."
  },
  {
    "id": "daily_bible",
    "title": "Daily Bible",
    "group": "learning",
    "bp": 10,
    "dayCapBP": null,
    "condition": "Real completed verified Daily Bible participation; opening reader alone is not proof."
  },
  {
    "id": "daily_bible_verification",
    "title": "Daily Bible Verification",
    "group": "learning",
    "bp": 2,
    "dayCapBP": null,
    "condition": "Distinct server-approved Bible verification event, not a second grant from the same unqualified source."
  },
  {
    "id": "devotional",
    "title": "Devotional",
    "group": "learning",
    "bp": 12,
    "dayCapBP": null,
    "condition": "Complete and verify eligible devotional entry; not rewarded merely for viewing."
  },
  {
    "id": "event_attendance",
    "title": "Event Attendance",
    "group": "service",
    "bp": 10,
    "dayCapBP": null,
    "condition": "Check-in only for an actual scheduled live event with recorded date/location; +10 BP when independently verified."
  },
  {
    "id": "formation_lesson",
    "title": "Formation Lesson",
    "group": "learning",
    "bp": 25,
    "dayCapBP": null,
    "condition": "Complete eligible approved Formation lesson and required evidence; one award per distinct lesson."
  },
  {
    "id": "game_first_qualified",
    "title": "Game First Qualified",
    "group": "game_quiz",
    "bp": 2,
    "dayCapBP": null,
    "condition": "First independently verified eligible game achievement only; scores alone do not count."
  },
  {
    "id": "game_tournament_champion",
    "title": "Game Tournament Champion",
    "group": "game_quiz",
    "bp": 100,
    "dayCapBP": 100,
    "condition": "Independently verified real tournament championship; cap 100 BP/day catalog."
  },
  {
    "id": "learning_progress_verification",
    "title": "Learning Progress Verification",
    "group": "learning",
    "bp": 5,
    "dayCapBP": null,
    "condition": "Submitted lesson/reading progress approved from independent server evidence; duplicate submissions excluded."
  },
  {
    "id": "mentor_session",
    "title": "Mentor Session",
    "group": "service",
    "bp": 15,
    "dayCapBP": null,
    "condition": "Registered mentor, actual mentees, teaching notes/date/place, proper evidence/consent and validated session. No self-report credit."
  },
  {
    "id": "mentoring_release",
    "title": "Mentoring Release",
    "group": "service",
    "bp": 20,
    "dayCapBP": null,
    "condition": "Genuine approved mentoring or lesson-release milestone distinct from the mentor-session receipt."
  },
  {
    "id": "ministry_activity",
    "title": "Ministry Activity",
    "group": "service",
    "bp": 15,
    "dayCapBP": null,
    "condition": "Real documented and verified ministry/service activity by member; no forged participation."
  },
  {
    "id": "ministry_major_milestone",
    "title": "Ministry Major Milestone",
    "group": "service",
    "bp": 100,
    "dayCapBP": 100,
    "condition": "Documented major ministry achievement including date, participants and independent supporting proof; cap 100 BP/day."
  },
  {
    "id": "prayer_response",
    "title": "Prayer Response",
    "group": "learning",
    "bp": 2,
    "dayCapBP": null,
    "condition": "Only a legitimate voluntary qualifying response; never score private prayer sincerity, text or beliefs."
  },
  {
    "id": "referral_rank_bonus",
    "title": "Referral Rank Bonus",
    "group": "learning",
    "bp": 10,
    "dayCapBP": null,
    "condition": "Legacy +10 BP configured; independent rank gain evidence required. New S2 +20 BP referrer is isolated target, NOT live, no double grant."
  },
  {
    "id": "reflection_quality_bonus",
    "title": "Reflection Quality Bonus",
    "group": "learning",
    "bp": 5,
    "dayCapBP": null,
    "condition": "Genuine original, approved substantive reflection according to its source rubric; duplicate templates excluded."
  },
  {
    "id": "scope_attendance",
    "title": "Scope Attendance",
    "group": "service",
    "bp": 10,
    "dayCapBP": null,
    "condition": "Actual open/live Cluster/scope event with validated attendance; no fake or duplicate check-in."
  },
  {
    "id": "stage_completion",
    "title": "Stage Completion",
    "group": "service",
    "bp": 75,
    "dayCapBP": null,
    "condition": "Verified completion of an entire assigned formation stage, not each opened lesson."
  },
  {
    "id": "verified_giving_participation",
    "title": "Verified Giving Participation",
    "group": "service",
    "bp": 5,
    "dayCapBP": null,
    "condition": "Independently verified voluntary participation, not donation amount; protect financial privacy and no paid reward multiplier."
  },
  {
    "id": "verified_volunteer_service",
    "title": "Verified Volunteer Service",
    "group": "service",
    "bp": 20,
    "dayCapBP": 20,
    "condition": "Validated real volunteer service with documented evidence; cap 20 BP/day."
  },
  {
    "id": "weekly_consistency",
    "title": "Weekly Consistency",
    "group": "milestones",
    "bp": 20,
    "dayCapBP": null,
    "condition": "Verified qualifying weekly pattern under applicable server rule; not one-time tab opening."
  },
  {
    "id": "weekly_tip_dugtong",
    "title": "Weekly Tip Dugtong",
    "group": "community",
    "bp": 2,
    "dayCapBP": 2,
    "condition": "Accepted meaningful Dugtong response to official Weekly Tip; cap 2 BP/day."
  },
  {
    "id": "weekly_tip_reaction",
    "title": "Weekly Tip Reaction",
    "group": "community",
    "bp": 1,
    "dayCapBP": 1,
    "condition": "Distinct real approved reaction to an official Weekly Tip; cap 1 BP/day."
  }
]);
export const S2_LEGACY_BP_INACTIVE:readonly Readonly<{id:string;title:string;bp:number}>[] = Object.freeze([
  {
    "id": "bible_weekly_streak",
    "title": "Bible Weekly Streak",
    "bp": 20
  },
  {
    "id": "consistency_30_day",
    "title": "Consistency 30 Day",
    "bp": 50
  },
  {
    "id": "daily_bible_reading",
    "title": "Daily Bible Reading",
    "bp": 10
  },
  {
    "id": "daily_devotional_reflection",
    "title": "Daily Devotional Reflection",
    "bp": 12
  },
  {
    "id": "formation_assessment",
    "title": "Formation Assessment",
    "bp": 25
  },
  {
    "id": "formation_module",
    "title": "Formation Module",
    "bp": 75
  },
  {
    "id": "game_advanced_perfect",
    "title": "Game Advanced Perfect",
    "bp": 20
  },
  {
    "id": "game_expert_campaign",
    "title": "Game Expert Campaign",
    "bp": 50
  },
  {
    "id": "game_hard_win",
    "title": "Game Hard Win",
    "bp": 10
  },
  {
    "id": "game_medium_win",
    "title": "Game Medium Win",
    "bp": 5
  },
  {
    "id": "game_puzzle_series",
    "title": "Game Puzzle Series",
    "bp": 25
  },
  {
    "id": "kl_episode",
    "title": "KL Episode",
    "bp": 10
  },
  {
    "id": "kl_season",
    "title": "KL Season",
    "bp": 50
  },
  {
    "id": "r2_verified_challenge",
    "title": "R2 Verified Challenge",
    "bp": 10
  },
  {
    "id": "verified_cluster_attendance",
    "title": "Verified Cluster Attendance",
    "bp": 10
  },
  {
    "id": "verified_mentoring_session",
    "title": "Verified Mentoring Session",
    "bp": 15
  }
]);
export const S2_GUIDE_BP_GROUPS:readonly Readonly<{id:S2BpGroup;title:string}>[] = Object.freeze([
  {id:'community',title:'Community / Wall / Dugtong'},
  {id:'learning',title:'Bible / KL / Learning'},
  {id:'service',title:'Service / Mentoring / Attendance'},
  {id:'game_quiz',title:'Game / Bible Quiz'},
  {id:'milestones',title:'Achievements / Weekly'},
  {id:'admin',title:'Admin-only configuration'},
]);
export const S2_QMP_EVENTS = Object.freeze([
  {id:'useful_post',title:'Useful original Wall post',qmp:5,condition:'40+ characters or qualified approved media'},
  {id:'qualified_video',title:'Original qualified video',qmp:10,condition:'Validated author-owned video, not raw views'},
  {id:'meaningful_reply',title:'Meaningful reply',qmp:3,condition:'20+ characters; duplicate-text within 7 days excluded'},
  {id:'creator_unique_reaction',title:'Unique creator reaction bonus',qmp:1,condition:'Different real member, not self-like'},
  {id:'creator_meaningful_reply_engagement',title:'Creator qualified reply engagement',qmp:1,condition:'Different real member and qualified reply; actual source trigger must be verified'},
  {id:'internal_share',title:'Validated internal share bonus',qmp:2,condition:'Only if actual qualifying share source exists'},
] as const);
export const S2_QMP_TIERS = Object.freeze([
 {id:'starter',title:'Starter',minQmp:0,maxQmp:24},
 {id:'active',title:'Active',minQmp:25,maxQmp:74},
 {id:'contributor',title:'Contributor',minQmp:75,maxQmp:149},
 {id:'builder',title:'Builder',minQmp:150,maxQmp:299},
 {id:'community_champion',title:'Community Champion',minQmp:300,maxQmp:null},
] as const);
export const S2_SOCIAL_MILESTONES_NOT_YET_ACTIVE = Object.freeze({
 active:false,
 helpfulCommentDistinctReactions:[{at:3,totalBonusBP:2},{at:10,totalBonusBP:5},{at:25,totalBonusBP:10}],
 mutualSupportChain:{distinctMembers:3,eachParticipantBp:3},
 postImpact: 'Server-verified original post engagement; exact active threshold/source unverified',
 note:'Source UI previously proposed these milestones, but source-authoritative grant rollout is not verified. Never auto-credit from this guide.',
});
export const S2_OPTIONAL_AD_ENERGY_NOT_BP = Object.freeze({
 example:'Watch 1 optional rewarded ad → +1 Garden Energy',
 bpGranted:0,qmpGranted:0,cashGranted:0,journeyTokensGranted:0,
 providerEarnedEventRequired:true,grantLiveVerified:false,
});
export const S2_QMP_MISSIONS = Object.freeze([
  {
    "id": "COMMUNITY_BUILDER",
    "source": "ACTIVE_DAY",
    "required": 3,
    "qmp": 20
  },
  {
    "id": "COMMUNITY_CREATOR",
    "source": "USEFUL_POST",
    "required": 3,
    "qmp": 15
  },
  {
    "id": "HELPFUL_VOICE",
    "source": "MEANINGFUL_REPLY",
    "required": 5,
    "qmp": 10
  },
  {
    "id": "VIDEO_STORYTELLER",
    "source": "QUALIFIED_VIDEO",
    "required": 1,
    "qmp": 15
  }
]);
export const S2_QMP_QUALIFICATIONS = Object.freeze({
  postMinCharacters:40,replyMinCharacters:20,duplicateReplyDays:7,
  creatorBonusPerContentCap:25,creatorBonusMonthlyCap:250,velocityHoldPerHour:30,
  eligibleUserPoolPercentage:30,financialFinalizationVerified:false,
  fixedPesoPerQmp:false,
});
export const S2_JOURNEY_TOKEN_SOURCES = Object.freeze([
  {
    "id": "today_dugtong",
    "amount": 2,
    "dailyCount": 1,
    "conditions": "Accepted real Today/Dugtong, actor-owned, one source/cycle"
  },
  {
    "id": "kl_verified_chapter",
    "amount": 3,
    "dailyCount": 1,
    "conditions": "Published, completed chapter + verified evidence; no phantom client quiz"
  },
  {
    "id": "wall_original_post",
    "amount": 2,
    "dailyCount": 1,
    "conditions": "Meaningful original still-visible moderated post"
  },
  {
    "id": "wall_meaningful_comment",
    "amount": 1,
    "dailyCount": 2,
    "conditions": "Nonself distinct accepted >=20 chars; no duplicates"
  }
]);
export const S2_WEEKLY_CLASSIFICATIONS = Object.freeze([
  {
    "name": "Unrated",
    "score": 0,
    "minActiveDays": 0,
    "minCategories": 0,
    "earnedReward": "none"
  },
  {
    "name": "Emerging",
    "score": 1,
    "minActiveDays": 1,
    "minCategories": 1,
    "earnedReward": "class only"
  },
  {
    "name": "Active",
    "score": 25,
    "minActiveDays": 2,
    "minCategories": 1,
    "earnedReward": "weekly emblem"
  },
  {
    "name": "Thrive",
    "score": 60,
    "minActiveDays": 3,
    "minCategories": 2,
    "earnedReward": "cosmetic frame"
  },
  {
    "name": "Exceptional",
    "score": 85,
    "minActiveDays": 4,
    "minCategories": 2,
    "earnedReward": "weekly collectible"
  }
]);
export const S2_JOURNEY_TOKEN_DAILY_MODELED_MAX = 9 as const;
export const S2_JOURNEY_TOKEN_DAILY_GLOBAL_CEILING = 12 as const;
export const S2_COSMETIC_PRICES_PREVIEW = Object.freeze([
  {
    "id": "accessory_finish",
    "tokens": 30
  },
  {
    "id": "gallery_theme",
    "tokens": 60
  },
  {
    "id": "skin_variant",
    "tokens": 80
  },
  {
    "id": "premium_visual_effect",
    "tokens": 150
  }
]);
export const S2_KL_FUTURE_RULES = Object.freeze({
  baseBp:5,perChapterBp:1,chaptersPerSeries:30,
  chapterBpPendingUntilNextVerified:true,
  lastChapterPendingUntilNextSeriesChapter1:true,
  sequentialAllPriorVerified:true,
  minReadingDurationMinutes:0,readingQuizRequired:true,
  chapterCommentMinCharacters:20,oneRewardedCommentPerChapter:true,chapterCommentBp:5,
  finalSeriesReflectionMinCharacters:50,seriesBonusBp:50,
  requiresIllustration:false,noRetroactiveS1Rewrite:true,
  first30ChapterTotalBp:615,all30CommentBp:150,
});
export function s2ChapterPotentialBp(chapter:number):number {
  if (!Number.isInteger(chapter)||chapter<1||chapter>30) throw new Error('Invalid KL chapter');
  return S2_KL_FUTURE_RULES.baseBp + chapter;
}
export const S2_WEEKLY_FOUNDATION_FUTURE=Object.freeze({
  distinctVerifiedLearning:1,distinctVerifiedCommunity:1,
  normalDays:7,automaticGraceDays:3,flexCreditsPerSeason:2,
  extraDaysPerFlex:7,optionalOnly:true,
  coreBpQmpCashBlocked:false,
});
export const S2_MOMENTUM_PREVIEW_ONLY=Object.freeze({
  deductionsLive:false,ownerRatesFinalized:false,optInRequired:true,
  verifiedActiveDayPlus:5,inactivityAfterGraceMinus:5,missedReadingMinus:2,
  missedCreatorMinus:2,maxPerDayMinus:9,minBalance:0,
  lifetimeBPQMPXPItemsCashNeverDebited:true,
});
export const S2_CHARACTER_MASTERY_FUTURE=Object.freeze({
  characterCount:13,levelsPerCharacter:20,itemsPerLevel:5,totalItems:1300,
  slotSteps:[
    'I1: canonical active Character + level/stage (+ special rank gate)',
    'I2: one unused verified learning receipt',
    'I3: one unused verified original community contribution',
    'I4: one unused claimed weekly Foundation receipt',
    'I5: server-certified ownership of I1-I4 in same Character/level',
  ],
  noArtworkBasedGrants:true,noLegacyItemRelocking:true,
});
export const S2_REFERRAL_FUTURE=Object.freeze({
  referrerRankUpgradeBp:20,referredQualifiedBp:10,
  legacyRankBonusConfiguredBp:10,legacyConflictUnreconciled:true,
  mustGainOneEligibleVerifiedCircleRankInActiveCluster:true,
  oneAwardPerReferral:true,
});
export const S2_FINANCE_CARRYOVER=Object.freeze({
  finalizedCashPreserved:true,withdrawalHistoryPreserved:true,monthlyQmpHistoryPreserved:true,
  minFundedWithdrawalPhp:200,requiresApprovedMembership:true,
  requiresVerifiedGovernmentId:true,requiresMatchingBeneficiary:true,
  allAdmobEstimatesAreNonWithdrawableUntilFinalized:true,
});
export const S2_CARRYOVER_POLICY=Object.freeze({
  preserved:['Lifetime BP / Circle Rank','Per-character XP, levels and selection',
    'Owned collectibles, inventory and permanent badges','Monthly QMP and finance history',
    'Finalized available pesos and payouts','Membership and immutable verified activities'],
  resetOnly:['Seasonal mission score','Seasonal competition tier','Season mission progress'],
});
export const S2_MEMBER_RELEASE_NOTICE=Object.freeze({
  earliestManilaDay:'2026-12-06',
  automaticActivation:false,
  grantOrTokenBackendVerified:false,
  adminOwnerApprovalRequired:true,
  status:'TARGET PACKAGE — HINDI PA LIVE',
});
