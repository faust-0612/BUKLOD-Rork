/** Display-only source taxonomy; never split balances or mint a second BP/QMP wallet. */
export type RewardLane='show_faith'|'non_faith'|'shared';
export const REWARD_LANE_DETAILS=Object.freeze([
{id:'show_faith',title:'SHOW FAITH',description:'Bible, devotional, prayer, faith lessons, ministry and faith-qualified reading rewards. A public Show Faith Wall post is not automatically a Bible completion.'},
{id:'non_faith',title:'NON-FAITH',description:'General community posts, learning, game challenges, skills, social service and verified nonfaith participation.'},
{id:'shared',title:'SHARED / SOURCE-DEPENDENT',description:'Referral, rank, attendance, milestones, weekly participation and cross-community activity must be classified from authoritative source context; do not guess faith from text.'},
] as const);
const faith=new Set([
'abc_growth_lesson','achievement_bible_scholar','achievement_faithful_mentor',
'bible_arena_monthly','bible_flash_easy','bible_flash_medium','bible_flash_hard',
'bible_quiz_easy','bible_quiz_medium','bible_quiz_hard','daily_bible',
'daily_bible_verification','devotional','formation_lesson','prayer_response',
'bible_weekly_streak','daily_bible_reading','daily_devotional_reflection',
'formation_assessment','formation_module'
]);
const sharedStory=new Set(['kl_episode','kl_season']);
const non=new Set([
'game_first_qualified','game_tournament_champion','game_advanced_perfect',
'game_expert_campaign','game_hard_win','game_medium_win','game_puzzle_series'
]);
export function rewardLaneForLegacyBp(id:string):RewardLane{
 // Kabihasnang Ligaw is literary reading available in BOTH scope modes.
 if(sharedStory.has(id))return 'shared';
 if(faith.has(id))return 'show_faith';
 if(non.has(id))return 'non_faith';
 return 'shared';
}
export const REWARD_LANE_POLICY=Object.freeze({
classificationAuthority:'server verified activity/source category, never client text keyword or user-selected lane',
legacyWalletsUnchanged:true,
separateDisplayLedgersOnly:true,
doubleCreditAcrossLanes:false,
singleSourceIdAcrossLanes:true,
crossLaneTransferOrConversion:false,
sameMemberAccessToBoth:true,
faithContentDoesNotRequireReligiousSelfIdentification:true,
privatePrayerDoesNotGrantJourneyTokens:true,
proverbsDailyReadingRewardBP:0,
nonfaithCannotClaimFaithOnlyReadingQuiz:true,
unknownSourceLane:'shared',
season2Activation:false,
});
export const REWARD_LANE_FAMILIES=Object.freeze([
{id:'faith_bible',lane:'show_faith',title:'Bible / Daily Reading / quizzes',requirement:'Completed and verified canonical chapter or authorized quiz; no duplicate old RPC and new catalog award',status:'S1 catalog; S2 future KL separate'},
{id:'shared_kl',lane:'shared',title:'Kabihasnang Ligaw (both modes): reading, reflection, chapter comments',requirement:'Literary reading is open to Show Faith and Non-Show Faith. Sequential verified chapters, delayed next-chapter BP, ≥20-character comment and ≥50-character final series reflection.',status:'S2 NOT LIVE'},
{id:'faith_ministry',lane:'show_faith',title:'Faith formation, ministry, mentoring, prayer',requirement:'Verified genuine activity, proper source ownership and moderation; private prayer is not a public farming source',status:'S1 configured; verify individual triggers'},
{id:'faith_proverbs',lane:'show_faith',title:'Show Faith daily Proverbs',requirement:'Read-only daily verse; no automatic BP, QMP, Token or XP',status:'CONTENT ONLY'},
{id:'non_social',lane:'non_faith',title:'General Community Wall, reactions, posts and replies',requirement:'Server-confirmed nonfaith category, valid unique actor, moderation and anti-farm checks',status:'S1 shared catalog; future source-lane mapping required'},
{id:'non_learning',lane:'non_faith',title:'General learning, skills and games',requirement:'Verified nonfaith learning/game evidence, eligible canonical source, no client-score grants',status:'S1 game catalog; other source-specific verification required'},
{id:'non_service',lane:'non_faith',title:'General service, volunteering and community challenges',requirement:'Independent nonfaith event verification; never award merely for selecting a tab',status:'S1 shared catalog; future source-lane mapping required'},
{id:'shared',lane:'shared',title:'Referral, Circle Rank, Character, badges, Kingdom, QMP, finance',requirement:'Preserve canonical authority and exact source lineage; no duplicate lane-specific wallet or payouts',status:'SHARED CANONICAL LEDGERS'},
] as const);
