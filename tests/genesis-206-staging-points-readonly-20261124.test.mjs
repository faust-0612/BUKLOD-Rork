import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const s=readFileSync('src/components/points/BuklodPointsRewardsScreen.tsx','utf8');
const native=readFileSync('src/lib/buklodPointsRewardedAd.native.ts','utf8');
test('Genesis shared-backend staging Points preview is fail-closed and read-only',()=>{
 assert.match(s,/const POINTS_STAGING_READ_ONLY = process\.env\.EXPO_PUBLIC_APP_ENV !== 'production' \|\| isGenesisPreviewBuild\(\)/);
 assert.match(s,/\{POINTS_STAGING_READ_ONLY \? \([\s\S]*?STAGING PREVIEW[\s\S]*?\) : claimGroups\.length > 0 \?/);
 assert.match(s,/\{!POINTS_STAGING_READ_ONLY \? <View style=\{\{ width: '100%'/);
 assert.match(s,/rows=\{rows\}/);
 assert.match(s,/onToggle=\{\(\) => toggleGroup\(group\.group_key\)\}/);
 assert.match(s,/loadBuklodClaimCards\(0, accountId\)/);
 assert.match(s,/LOAD MORE INDIVIDUAL REWARDS/);
 assert.match(s,/BuklodSeason2ApprovedExclusivePreview/);
 assert.match(s,/\/points\/season2-guide/);
 assert.doesNotMatch(s,/CLAIM ALL|__buklod_claim_all_eligible__/);
 assert.match(s,/if \(!POINTS_STAGING_READ_ONLY\) warmBuklodAdOpportunity/);
});
test('direct invocation of both mutation handlers returns before any side effects in staging',async()=>{
 for(const [name,marker] of [['claimOne','const watchBonus ='],['watchBonus','const filtered =']]){
   const start=s.indexOf('const '+name+' = useCallback(');
   const end=s.indexOf(marker,start);
   assert.ok(start>=0&&end>start);
   const fragment=s.slice(start,end);
   // Strip the dependency array, which is not part of the handler body.
   const closing=fragment.lastIndexOf('}, [');
   assert.ok(closing>0);
   const code=stripTypeScriptTypes(fragment.slice(0,closing+1)+');',{mode:'strip'});
   const callback=vm.runInNewContext(code+'\n'+name,{POINTS_STAGING_READ_ONLY:true,useCallback:fn=>fn});
   await callback({event_id:'test',ledger_id:'test'});
 }
});
test('native reward path also refuses staging and disabled bonus',()=>{
 assert.match(native,/if \(process\.env\.EXPO_PUBLIC_APP_ENV !== 'production' \|\|\s*process\.env\.EXPO_PUBLIC_POINTS_REWARDED_BONUS_ENABLED !== 'true' \|\|/);
 assert.ok(native.indexOf("process.env.EXPO_PUBLIC_APP_ENV !== 'production'")<native.indexOf('await initializeBuklodAds()'));
 assert.match(s,/bonusEnabled=\{!POINTS_STAGING_READ_ONLY && bonusStatus\?\.enabled === true/);
});
