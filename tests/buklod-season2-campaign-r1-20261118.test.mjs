import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  BUKLOD_SEASON2_CAMPAIGN,BUKLOD_SEASON2_ACTS,BUKLOD_SEASON2_WEEKLY_BEATS,
  BUKLOD_SEASON2_CHARACTER_CAST,BUKLOD_SEASON2_CAST_ORDER,
  BUKLOD_SEASON2_REWARDS,previewSeason2ActForWeek,
  previewSeason2EditorialWeek,assessSeason2LaunchEvidence
} from '../src/lib/buklodSeason2CampaignR1.ts';
const evidence={
  historicalSeasonClosedAndSigned:false,allEligiblePendingEventsReconciled:false,
  officialStartAndEndPublished:false,characterInventoryReceiptsVerified:false,
  qmpAndAdMobProtected:false,androidRcRuntimeVerified:false,
  adAndInstantNavigationRegressionsPassed:false,
  stagedBackendAndOfflineTestsPassed:false,ownerAuthorizedFinalLaunch:false,
};
test('season2 world is an unpublished 12-week editorial concept with Dec 6 target',()=>{
  assert.equal(BUKLOD_SEASON2_CAMPAIGN.ownerOpeningTargetManilaDay,'2026-12-06');
  assert.equal(BUKLOD_SEASON2_CAMPAIGN.officialOpeningPublished,false);
  assert.equal(BUKLOD_SEASON2_CAMPAIGN.officialEndManilaDay,null);
  assert.equal(BUKLOD_SEASON2_CAMPAIGN.recommendedWeeks,12);
  for(const k of ['redemptionLive','missionAwardsLive','chapterPublishingLive',
    'cooperativeAwardsLive','inactivityDeductionsLive'])
    assert.equal(BUKLOD_SEASON2_CAMPAIGN[k],false,k);
});
test('four acts cover all weeks exactly once without publishing an end date',()=>{
  assert.deepEqual(BUKLOD_SEASON2_ACTS.map(x=>x.weeks),[[1,3],[4,6],[7,9],[10,12]]);
  assert.equal(BUKLOD_SEASON2_WEEKLY_BEATS.length,12);
  for(let n=1;n<=12;n++){
    const act=previewSeason2ActForWeek(n);
    const week=BUKLOD_SEASON2_WEEKLY_BEATS[n-1];
    assert.equal(week.week,n);
    assert.equal(week.act,act?.id);
    assert.equal(week.rewardCategory,'preview_only');
  }
  assert.equal(previewSeason2ActForWeek(0),null);
  assert.equal(previewSeason2ActForWeek(13),null);
  assert.equal(previewSeason2ActForWeek(1.5),null);
});
test('all 13 canonical Characters appear exactly once with distinct story role',()=>{
  const ids=['phan','quin','van','christian','lhen','ace','ellusur','jawo',
    'mitch','niel','angel','vhen','trudice'];
  assert.deepEqual([...BUKLOD_SEASON2_CAST_ORDER],ids);
  assert.deepEqual(Object.keys(BUKLOD_SEASON2_CHARACTER_CAST).sort(),ids.sort());
  for(const id of ids){
    assert.ok(BUKLOD_SEASON2_CHARACTER_CAST[id].role.length>2);
    assert.ok(BUKLOD_SEASON2_CHARACTER_CAST[id].line.length>15);
  }
});
test('no payment, gambling, mandatory prayer or public-content coercion in mission briefs',()=>{
  const all=BUKLOD_SEASON2_WEEKLY_BEATS.map(x=>[
    x.title,x.chapterBeat,x.primaryEvidence,x.alternativePath].join(' ')).join(' ');
  assert.match(all,/Non-Show-Faith pathway pending real source verification/);
  assert.match(all,/no forced invites/);
  assert.match(all,/Solo/);
  assert.doesNotMatch(all,/buy to win|loot box|pay to unlock/i);
});
test('four preview rewards are inaccessible and use Character canonical authority',()=>{
  assert.equal(BUKLOD_SEASON2_REWARDS.length,4);
  assert.equal(new Set(BUKLOD_SEASON2_REWARDS.map(x=>x.key)).size,4);
  for(const r of BUKLOD_SEASON2_REWARDS){
    assert.equal(r.sourceAuthority,'CHARACTER_VERIFIED_RECEIPT');
    assert.equal(r.available,false);assert.equal(r.spendable,false);
  }
});
test('all nine release gates block launch while Season 1, QMP, Ads and RC are unverified',()=>{
  const a=assessSeason2LaunchEvidence(evidence);
  assert.equal(a.canLaunch,false);
  assert.equal(a.missing.length,9);
  assert.equal(a.sourceOnly,true);
});
test('a fully documented proposed proof is NOT a publishing function',()=>{
  const x=assessSeason2LaunchEvidence(Object.fromEntries(
    Object.keys(evidence).map(k=>[k,true])));
  assert.equal(x.canLaunch,true);
  assert.equal(x.sourceOnly,true);
  const code=readFileSync('src/lib/buklodSeason2CampaignR1.ts','utf8');
  assert.doesNotMatch(code,/supabase|postgrest|fetch\(|\.rpc\(|eas update|process\.env/i);
});
test('content calendar computes dates, but never claims official publication',()=>{
  const first=previewSeason2EditorialWeek(1);
  const second=previewSeason2EditorialWeek(2);
  const last=previewSeason2EditorialWeek(12);
  assert.deepEqual(first,{week:1,date:'2026-12-06',published:false});
  assert.equal(second?.date,'2026-12-13');
  assert.equal(last?.date,'2027-02-21');
  assert.equal(previewSeason2EditorialWeek(13),null);
  assert.equal(previewSeason2EditorialWeek(0),null);
  assert.equal(previewSeason2EditorialWeek(4,'2026-02-30'),null);
});
test('existing Points/Season preview uses the new campaign but preserves all ads',()=>{
  const p=readFileSync('src/components/points/BuklodPointsRewardsScreen.tsx','utf8');
  const card=readFileSync('src/components/points/BuklodSeasonJourneyPreview.tsx','utf8');
  assert.match(p,/BuklodSeasonJourneyPreview/);
  assert.match(p,/points_redeem_transition_native/);
  assert.match(card,/BUKLOD_SEASON2_ACTS/);
  assert.match(card,/BUKLOD_SEASON2_CHARACTER_CAST/);
  assert.match(card,/BUKLOD_SEASON2_WEEKLY_BEATS/);
  assert.match(card,/Preview only — not enrolled/);
  assert.match(card,/Notifications are not enabled by this preview/);
  assert.doesNotMatch(card,/supabase|\.rpc\(|\.insert\(|\.update\(|\.delete\(|setInterval/i);
});
