'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const load=p=>fs.readFileSync(path.join(root,p),'utf8');
const matrix=load('src/lib/season2/buklodSeason2MemberRewardMatrixR1.ts');
const view=load('src/components/points/BuklodS2CompleteRewardsReference.tsx');
const journey=load('src/components/points/BuklodSeasonJourneyPreview.tsx');
const owner=JSON.parse(load('contracts/season2-owner-approved-exclusives-20261119.json'));
const audit=JSON.parse(load('contracts/season2-dec6-complete-reward-inventory-20261119.json'));
function freezeArray(start){
 const a=matrix.indexOf(start);
 assert.ok(a>=0,'missing matrix start '+start);
 const b=matrix.indexOf(');',a+start.length);
 assert.ok(b>a,'missing Object.freeze closing bracket');
 return JSON.parse(matrix.slice(a+start.length,b).trim());
}
const active=freezeArray('export const S2_LEGACY_BP_ACTIVE:readonly S2BpCatalogEntry[] = Object.freeze(');
const inactive=freezeArray('export const S2_LEGACY_BP_INACTIVE:readonly Readonly<{id:string;title:string;bp:number}>[] = Object.freeze(');
test('full member BP catalog reflects exact audited active/inactive S1 snapshot',()=>{
 assert.equal(active.length,46);assert.equal(inactive.length,16);
 assert.equal(new Set(active.map(x=>x.id)).size,46);
 assert.equal(new Set(inactive.map(x=>x.id)).size,16);
 assert.deepEqual(active.map(x=>[x.id,x.bp,x.dayCapBP]),audit.season1BP.activeCatalog.map(x=>[x.id,x.baseBP,x.dayCapBP]));
 assert.deepEqual(inactive.map(x=>[x.id,x.bp]),audit.season1BP.inactiveCatalog.map(x=>[x.id,x.baseBP]));
});
test('new S2 guide is never a second currency authority, reward grant or backend client',()=>{
 for(const unsafe of [/@\/lib\/supabase/,/\.rpc\s*\(/,/\.functions\.invoke\s*\(/,/\.upsert\s*\(/,/\.insert\s*\(/,/\.update\s*\(/,/\bservice_role\b/]){
  assert.doesNotMatch(view,unsafe);
  assert.doesNotMatch(matrix,unsafe);
 }
 assert.match(view,/useState\(false\)/);
 assert.match(view,/\{expanded\?<View/);
 assert.match(view,/TARGET PACKAGE — HINDI PA LIVE|S2_MEMBER_RELEASE_NOTICE\.status/);
 assert.match(journey,/\{open\?\(/);
 assert.match(journey,/<BuklodS2CompleteRewardsReference\s*\/>/);
});
test('all member categories and QMP rates/ceilings are specific and truthful',()=>{
 for(const s of ['S2_LEGACY_BP_ACTIVE','S2_LEGACY_BP_INACTIVE','S2_QMP_EVENTS','S2_QMP_MISSIONS',
 'S2_QMP_QUALIFICATIONS','S2_KL_FUTURE_RULES','S2_MOMENTUM_PREVIEW_ONLY','S2_FINANCE_CARRYOVER']){
  assert.ok(view.includes(s),'missing UI section '+s);
 }
 for(const a of ['original Wall post','qualified video','meaningful reply'])assert.ok(matrix.toLowerCase().includes(a.toLowerCase()));
 assert.match(matrix,/financialFinalizationVerified:false/);
 assert.match(matrix,/fixedPesoPerQmp:false/);
 assert.match(matrix,/creatorBonusMonthlyCap:250/);
 assert.match(matrix,/creatorBonusPerContentCap:25/);
});
test('both show faith and nonfaith source options are preserved without auto-inventing pay',()=>{
 assert.match(matrix,/tokenSources|S2_JOURNEY_TOKEN_SOURCES/);
 assert.match(matrix,/S2_JOURNEY_TOKEN_DAILY_MODELED_MAX = 9/);
 assert.match(matrix,/S2_JOURNEY_TOKEN_DAILY_GLOBAL_CEILING = 12/);
 assert.match(view,/No conversion to cash, BP, QMP or Kingdom Shards/);
 assert.doesNotMatch(view,/Prayer \+\d+ tokens/);
});
test('latest KL progressive 5+n and deferred vs credited distinction is visible',()=>{
 assert.match(matrix,/baseBp:5,perChapterBp:1,chaptersPerSeries:30/);
 assert.match(matrix,/lastChapterPendingUntilNextSeriesChapter1:true/);
 assert.match(matrix,/chapterCommentMinCharacters:20/);
 assert.match(matrix,/finalSeriesReflectionMinCharacters:50/);
 assert.match(matrix,/oneRewardedCommentPerChapter:true/);
 assert.match(view,/PENDING until next series Chapter 1 verified/);
 assert.match(view,/photo optional/);
});
test('13×20×5 item slot requirements and cosmetics are honest, non-minting',()=>{
 assert.match(matrix,/characterCount:13,levelsPerCharacter:20,itemsPerLevel:5,totalItems:1300/);
 for(let i=1;i<=5;i++)assert.ok(matrix.includes(`I${i}:`));
 assert.match(matrix,/noArtworkBasedGrants:true/);
 assert.match(matrix,/noLegacyItemRelocking:true/);
 assert.match(view,/LOCKED/);
});
test('weekly score classes and opt-in Momentum do not change S1 accounting',()=>{
 for(const t of ['Emerging','Active','Thrive','Exceptional'])assert.ok(matrix.includes(t));
 assert.match(matrix,/deductionsLive:false,ownerRatesFinalized:false,optInRequired:true/);
 assert.match(matrix,/maxPerDayMinus:9,minBalance:0/);
 assert.match(matrix,/lifetimeBPQMPXPItemsCashNeverDebited:true/);
 assert.match(matrix,/coreBpQmpCashBlocked:false/);
});
test('referral +20 future stays distinct from legacy +10 and member +10',()=>{
 assert.match(matrix,/referrerRankUpgradeBp:20,referredQualifiedBp:10/);
 assert.match(matrix,/legacyRankBonusConfiguredBp:10,legacyConflictUnreconciled:true/);
 assert.match(view,/Legacy \+10 is NOT reconciled/);
});
test('full QMP classifications and social bonus proposals never masquerade as live rewards',()=>{
 for(const [name,min] of [['Starter',0],['Active',25],['Contributor',75],['Builder',150],['Community Champion',300]]){
  assert.ok(matrix.includes(`title:'${name}',minQmp:${min}`));
 }
 assert.match(view,/S2_QMP_TIERS\.map\(/);
 assert.match(matrix,/S2_SOCIAL_MILESTONES_NOT_YET_ACTIVE = Object\.freeze\(\{/);
 assert.match(matrix,/active:false,/);
 assert.match(view,/Proposed social milestone bonuses \(NOT LIVE\)/);
 assert.match(matrix,/S2_OPTIONAL_AD_ENERGY_NOT_BP/);
 assert.match(matrix,/bpGranted:0,qmpGranted:0,cashGranted:0,journeyTokensGranted:0/);
 assert.match(view,/Optional rewarded ads — not BP/);
});
test('exactly the ten owner-approved exclusives rendered with no extra feature',()=>{
 assert.equal(owner.approvedFeatureIds.length,10);
 assert.equal(audit.approvedExclusives.length,10);
 assert.match(view,/S2_EXCLUSIVE_FEATURES\.map\(/);
 assert.match(journey,/<BuklodSeason2ApprovedExclusivePreview\s*\/>/);
});
test('no eager network loading; exact next activation date and isolation notice visible',()=>{
 assert.match(matrix,/earliestManilaDay:'2026-12-06'/);
 assert.match(matrix,/automaticActivation:false/);
 assert.match(matrix,/grantOrTokenBackendVerified:false/);
 assert.match(view,/INFORMATIONAL SNAPSHOT ONLY/);
 assert.match(view,/Not a wallet, cash estimate, claim, grant or activation/);
 assert.match(view,/financial finalization was OFF/);
});
