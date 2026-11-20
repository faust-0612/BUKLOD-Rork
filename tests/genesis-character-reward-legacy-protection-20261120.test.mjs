import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Character mastery and badges cannot make grants or modify saved Character progress',()=>{
 const guide=read('src/components/points/BuklodS2AllItemsBadgesGuide.tsx');
 const rule=read('src/lib/season2/buklodSeason2CollectibleGuideR1.ts');
 const prog=read('src/lib/season2/buklodSeason2BadgeEligibilityR1.ts');
 const score=read('src/lib/season2/buklodSeason2ApprovedScopeR1.ts');
 assert.match(rule,/13 \* 20 \* 5/);
 assert.match(rule,/preview/i);
 assert.doesNotMatch(guide,/claimBuklodRewardEvent|supabase\.from|\.rpc\(/);
 assert.doesNotMatch(prog,/supabase\.|\.rpc\(/);
 assert.match(score,/tokenMint:false/);
 assert.match(score,/badgeGrants:false/);
});
