'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const rules=read('src/lib/season2/buklodSeason2RewardLanesR1.ts');
const view=read('src/components/points/BuklodS2CompleteRewardsReference.tsx');
test('three lanes separate faith, nonfaith and shared without a second ledger',()=>{
 for(const id of ['show_faith','non_faith','shared'])assert.match(rules,new RegExp(id));
 assert.match(rules,/legacyWalletsUnchanged:true/);
 assert.match(rules,/doubleCreditAcrossLanes:false/);
 assert.match(rules,/singleSourceIdAcrossLanes:true/);
 assert.match(rules,/sameMemberAccessToBoth:true/);
 assert.match(rules,/season2Activation:false/);
});
test('Bible faith and game nonfaith are explicit; ambiguous social activity is shared until server source confirms',()=>{
 assert.match(rules,/'daily_bible'/);
 assert.match(rules,/'kl_episode'/);
 assert.match(rules,/'game_first_qualified'/);
 assert.match(rules,/return 'shared'/);
 assert.match(rules,/server verified activity\/source category/);
 assert.match(rules,/proverbsDailyReadingRewardBP:0/);
});
test('Kabihasnang Ligaw reading is shared across Show Faith and Non-Show Faith',()=>{
 assert.match(rules,/sharedStory=new Set\(\['kl_episode','kl_season'\]\)/);
 assert.match(rules,/if\(sharedStory\.has\(id\)\)return 'shared'/);
 assert.match(rules,/id:'shared_kl',lane:'shared'/);
});
test('member guide offers lane switch, filters BP and preserves source-only behavior',()=>{
 assert.match(view,/REWARD_LANE_DETAILS\.map/);
 assert.match(view,/rewardLaneForLegacyBp\(item.id\)===lane/);
 assert.match(view,/REWARD_LANE_FAMILIES\.filter\(x=>x.lane===lane\)/);
 assert.match(view,/BuklodS2CompleteRewardIndex/);
 for(const x of [rules])for(const re of [/\.rpc\s*\(/,/\.insert\s*\(/,/\.upsert\s*\(/,/\.update\s*\(/])assert.doesNotMatch(x,re);
});
