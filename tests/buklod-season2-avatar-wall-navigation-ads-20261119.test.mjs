import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Wall member avatars keep circular tap navigation while badge is non-touchable and unclipped',()=>{
 const avatar=read('src/components/ProfileAvatar.tsx');
 const wall=read('src/components/BuklodTappableAvatar.tsx');
 const post=read('src/app/post/[id].tsx');
 assert.match(avatar,/pointerEvents="none"/);
 assert.match(wall,/isAvatarCircleHit\(event, size \/ 2\)/);
 assert.match(wall,/overflow: 'visible'/);
 assert.match(post,/BuklodTappableAvatar/);
 assert.match(post,/rankName=\{post.author_rank_name\}/);
});
test('Navigation/auth and Connect tap behaviors retain original route while avatar overlay cannot steal events',()=>{
 const wall=read('src/components/BuklodTappableAvatar.tsx');
 const connect=read('src/components/connect/ConnectTappableAvatar.tsx');
 const web=read('src/components/connect/ConnectTappableAvatar.web.tsx');
 assert.match(wall,/visitMemberProfile/);
 assert.match(connect,/isAvatarCircleHit/);
 assert.match(connect,/onPress=\{/);
 assert.match(web,/onPress=\{tapHandler/);
 assert.match(web,/overflow: 'visible'/);
 const avatar=read('src/components/ProfileAvatar.tsx');
 assert.match(avatar,/useAuth\(\)/);
 assert.match(avatar,/viewerId/);
});
test('AdMob finance Points and Season 1 rank calculation remain untouched by new visual-only display',()=>{
 const progress=read('src/app/points/progression.tsx');
 const art=read('src/lib/buklodSeason2RankArt.ts');
 const ranks=read('src/lib/buklodAvatarRankLookup.ts');
 assert.match(progress,/placementId="points_rank_progression_native"/);
 assert.match(progress,/placementId="points_rank_roadmap_footer"/);
 assert.match(progress,/get_my_buklod_rank_progress/);
 assert.match(ranks,/get_member_circle_ranks_v1/);
 assert.doesNotMatch(art,/claimBuklodRewardEvent|QMP|withdraw|credit_points/);
});
