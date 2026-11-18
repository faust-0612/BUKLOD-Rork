import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Wall author badge uses existing rank without changing navigation or ad loading',()=>{
 const wall=read('src/app/(tabs)/buklod.tsx');
 const tap=read('src/components/BuklodTappableAvatar.tsx');
 const shared=read('src/components/ProfileAvatar.tsx');
 assert.match(wall,/get_member_circle_ranks_v1/);
 assert.match(wall,/rankName=\{item\.author_rank_name\}/);
 assert.match(tap,/rankName=\{rankName\}/);
 assert.match(tap,/visitMemberProfile/);
 assert.match(shared,/getBuklodCircleRankArt\(verifiedRankName \|\| rankName\)/);
});
test('Connect passes existing rank through native/web wrappers',()=>{
 for(const path of ['src/components/connect/ConnectQuickContacts.tsx','src/components/BuklodCommunityWallProfileBubbles.tsx','src/components/BuklodCommunityConnectHeader.web.tsx'])
  assert.match(read(path),/rankName=\{contact\.rank_name\}/);
 for(const path of ['src/components/connect/ConnectTappableAvatar.tsx','src/components/connect/ConnectTappableAvatar.web.tsx']){
  const s=read(path);
  assert.match(s,/rankName=\{rankName\}/);
  assert.match(s,/overflow: 'visible'/);
 }
});
