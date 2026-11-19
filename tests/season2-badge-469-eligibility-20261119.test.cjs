'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('src/lib/season2/buklodSeason2BadgeEligibilityR1.ts');
const ui=read('src/components/points/BuklodS2AllItemsBadgesGuide.tsx');
const doc=read('docs/season2/BUKLOD_ALL_1300_ITEMS_469_BADGES_40_RANKS_20261119.md');
test('all 469 badge groups have exact source-only proposed criteria with no grant',()=>{
 for(const fragment of ['characterSignature:13','stage:260','era:65','characterMastery:13','characterJourney:52','starterPack:58','series:8','total:469'])
  assert.ok(source.includes(fragment),'missing count '+fragment);
 for(const x of ['all five I1-I5','all four certified','50 of 100','100 of 100','20 certified Stage Mastery','all five Core Character','all eight Special Character','all 13 Character Mastery','all 13 Character Era Mastery'])
  assert.ok(source.includes(x),'missing criteria '+x);
 assert.match(source,/PROPOSED_OWNER_FINAL_SIGNOFF_AND_SERVER_NOT_LIVE/);
 assert.match(ui,/plannedS2BadgeCriteria\(badgeKind,i,en\)/);
 assert.doesNotMatch(source,/@\/lib\/supabase|\.rpc\(|from 'react'/);
});
test('badge thresholds are transparent targets, not live or redeemable cash',()=>{
 assert.match(doc,/proposed/i);
 assert.match(source,/NOT LIVE/);
 assert.doesNotMatch(source,/creditBp|grantBadge|addPoints|spendWallet/);
});
