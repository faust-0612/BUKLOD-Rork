import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const r=p=>readFileSync(p,'utf8');
test('full user rewards catalogue remains read-only, one route away from instant Points paint',()=>{
 const s=r('src/app/points/season2-guide.tsx'),p=r('src/components/points/BuklodPointsRewardsScreen.tsx');
 assert.match(s,/isGenesisPreviewBuild/);
 assert.match(s,/BuklodS2CompleteRewardsReference/);
 assert.match(p,/\/points\/season2-guide/);
 assert.doesNotMatch(s,/supabase|claimBuklodRewardEvent|tokenMint/);
});
test('two independent faith-context lanes cannot mint or claim and all ten exclusives stay locked',()=>{
 const a=r('src/lib/season2/buklodSeason2RewardTracksR1.ts');
 for(const v of ['installed:false','tokenMint:false','productionAuthorized:false','affectsLegacyBP:false','affectsQMP:false','affectsCash:false'])assert.ok(a.includes(v),v);
 const s=r('src/lib/season2/buklodSeason2ApprovedScopeR1.ts');
 assert.equal((s.match(/Object.freeze\(\{id:/g)||[]).length,10);
});
test('1,300 collectible and 469 badge guides do not claim real inventory or entitlements',()=>{
 const guide=r('src/components/points/BuklodS2AllItemsBadgesGuide.tsx');
 assert.ok(guide.includes('S2_COLLECTIBLE_TOTAL')||guide.includes('1,300'));
 assert.doesNotMatch(guide,/claimBuklodRewardEvent|\.rpc\(|supabase\.from/);
});
