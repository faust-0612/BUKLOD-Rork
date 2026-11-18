import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Season2 avatar art never replaces the first-view native AdMob or the points road map ad placements',()=>{
 const road=read('src/app/points/progression.tsx');
 const avatar=read('src/components/ProfileAvatar.tsx');
 const sidebar=read('src/components/BuklodCommunityConnectHeader.web.tsx');
 assert.match(road,/placementId="points_rank_progression_native"/);
 assert.match(road,/placementId="points_rank_roadmap_footer"/);
 assert.match(sidebar,/rankName=\{contact.rank_name\}/);
 assert.match(avatar,/ProfileAvatarStatusIndicator/);
 assert.doesNotMatch(avatar,/showBuklodAdOpportunity|claimBuklodRewardEvent|qmp|withdraw/i);
});
test('Season2 badge overlay cannot mutate finance or the server-authored lifetime rank',()=>{
 const art=read('src/lib/buklodCircleRankArtwork.ts');
 const badge=read('src/components/points/BuklodCircleRankBadge.tsx');
 assert.match(art,/CIRCLE_RANK_FAMILIES/);
 assert.match(badge,/BuklodSeason2RankArtwork/);
 assert.doesNotMatch(art,/supabase|rpc\(|points_ledger|balance_update/i);
 assert.doesNotMatch(badge,/supabase|rpc\(|points_ledger|balance_update/i);
});
