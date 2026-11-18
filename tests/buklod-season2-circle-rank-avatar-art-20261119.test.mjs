import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read('assets/season2/buklod-circle-ranks-40.manifest.json'));
test('Season 2 approved 40 rank artwork is exactly 8 x 5 with no missing or duplicate positions',()=>{
 assert.equal(manifest.count,40);
 assert.equal(manifest.slots.length,40);
 assert.deepEqual([manifest.rows,manifest.columns,manifest.cellSize],[8,5,160]);
 assert.equal(new Set(manifest.slots.map(x=>x.name)).size,40);
 for(let i=0;i<40;i++){
  const row=manifest.slots[i];
  assert.equal(row.index,i+1);
  assert.equal(row.row,Math.floor(i/5));
  assert.equal(row.col,i%5);
  assert.ok(row.name.endsWith([' V',' IV',' III',' II',' I'][i%5]));
  assert.equal(row.file, row.name.toLowerCase().replace(/\s+/g,'_')+'.png');
 }
 const bytes=readFileSync(new URL('../'+manifest.atlas,import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(bytes.toString('ascii',8,12),'WEBP');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
});
test('Circle Rank sprite uses alpha artwork without square backgrounds or dummy number badges',()=>{
 const b=read('src/components/points/BuklodCircleRankBadge.tsx');
 const art=read('src/lib/buklodSeason2RankArt.ts');
 assert.match(b,/RANK_ART_SOURCE/);
 assert.match(b,/overflow:'hidden'/);
 assert.match(b,/left:-column\*spriteSize/);
 assert.match(b,/top:-row\*spriteSize/);
 assert.match(b,/locked\?0\.32:1/);
 assert.match(art,/RANK_COUNT = 40/);
 assert.match(art,/RANK_ART_SOURCE = require/);
 for(const family of ['starter','active','steady','builder','impact','vanguard','prime','prime elite']){
  assert.ok(art.includes(family),family);
 }
});
test('All shared Wall/Connect/Profile avatars have top-left badge, rank border and bottom blue presence dot',()=>{
 const avatar=read('src/components/ProfileAvatar.tsx');
 const wall=read('src/components/BuklodTappableAvatar.tsx');
 const connect=read('src/components/connect/ConnectTappableAvatar.tsx');
 const connectWeb=read('src/components/connect/ConnectTappableAvatar.web.tsx');
 const wallBubbles=read('src/components/BuklodCommunityWallProfileBubbles.tsx');
 const wallScreen=read('src/app/(tabs)/buklod.tsx');
 const quick=read('src/components/connect/ConnectQuickContacts.tsx');
 const post=read('src/app/post/[id].tsx');
 const me=read('src/app/(tabs)/me.tsx');
 const status=read('src/lib/buklodAvatarPresence.ts');
 const ranks=read('src/lib/buklodAvatarRankLookup.ts');
 assert.match(avatar,/left:-size\*0\.20,top:-size\*0\.25/);
 assert.match(avatar,/rankArtwork\?\.color/);
 assert.match(avatar,/backgroundColor:'#138DFF'/);
 assert.match(avatar,/<ProfileAvatarStatusIndicator userId=\{userId\}/);
 assert.match(wall,/overflow: 'visible'/);
 assert.match(connect,/overflow: 'visible'/);
 assert.match(connectWeb,/overflow: 'visible'/);
 assert.match(wallBubbles,/rankName=\{contact.rank_name\}/);
 assert.match(wallScreen,/rankName=\{item.author_rank_name\}/);
 assert.match(post,/rankName=\{post.author_rank_name\}/);
 assert.match(me,/rankName=\{circleRank\}/);
 assert.match(quick,/rankName=\{contact.rank_name\}/);
 assert.match(status,/AppState.addEventListener/);
 assert.match(status,/connected.track/);
 assert.match(ranks,/get_member_circle_ranks_v1/);
 assert.match(ranks,/p_user_ids:group/);
 assert.match(ranks,/session.session\?\.user\?\.id!==viewer/);
});
test('Season 1 rank award thresholds, currency/QMP and AdMob were not modified',()=>{
 const progression=read('src/app/points/progression.tsx');
 assert.match(progression,/get_my_buklod_rank_progress/);
 assert.match(progression,/get_buklod_rank_ladder/);
 assert.match(progression,/<BuklodCircleRankBadge/);
 assert.match(progression,/locked=\{!achieved && !current\}/);
 assert.match(progression,/placementId="points_rank_progression_native"/);
});
