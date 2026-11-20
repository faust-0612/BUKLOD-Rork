import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const shared = read('src/components/ProfileAvatar.tsx');
const tap = read('src/components/BuklodTappableAvatar.tsx');
const connect = read('src/components/connect/ConnectTappableAvatar.tsx');
const connectWeb = read('src/components/connect/ConnectTappableAvatar.web.tsx');
const presence = read('src/lib/buklodAvatarPresence.ts');

test('uses bundled 40 canonical Genesis emblems, 10 oclock and colored ring', () => {
  assert.ok(existsSync('assets/season2/rank-badges/buklod-circle-ranks-atlas.webp'));
  assert.match(shared,/get_member_circle_ranks_v1/);
  assert.match(shared,/createBuklodAvatarBatchLookup/);
  assert.match(shared,/getBuklodCircleRankArt/);
  assert.match(shared,/left: -badgeSize \* 0\.25/);
  assert.match(shared,/borderColor: rankBorder/);
  assert.match(shared,/rankPreviewEnabled \? getBuklodCircleRankArt/);
});
test('isolation, notes location and presence are fail closed', () => {
  assert.match(shared,/isGenesisPreviewBuild\(\)/);
  assert.match(shared,/!rankPreviewEnabled \|\| !viewerId/);
  assert.match(shared,/EXPO_PUBLIC_BUKLOD_GENESIS_PRESENCE_APPROVED === 'true'/);
  assert.match(shared,/!onlinePreviewEnabled \|\| !viewerId/);
  assert.match(shared,/top:-px\*0\.22/);
  assert.match(shared,/S2_WEEKLY_PERFORMANCE_STAGING_ONLY/);
  const weeklyIndicator=shared.split('export function ProfileAvatarStatusIndicator')[1].split('/** Readable avatar-adjacent')[0];
  assert.doesNotMatch(weeklyIndicator,/>\s*N\s*</);
  assert.match(shared,/bottom: -onlineSize \* 0\.30/);
  assert.match(presence,/supabase\.removeChannel/);
  assert.match(presence,/AppState\.currentState === 'active'/);
});
test('Wall, Connect and web avatars preserve visible overlays and taps', () => {
  for(const content of [tap, connect, connectWeb]){
    assert.match(content,/rankName\?: string \| null/);
    assert.match(content,/rankName=\{rankName\}/);
    assert.match(content,/overflow: 'visible'/);
  }
  assert.match(read('src/app/(tabs)/buklod.tsx'),/rankName=\{item\.author_rank_name\}/);
  for(const path of ['src/components/BuklodCommunityWallProfileBubbles.tsx','src/components/BuklodCommunityConnectHeader.web.tsx']){
    assert.match(read(path),/rankName=\{contact\.rank_name\}/);
  }
  assert.match(tap,/isAvatarCircleHit/);
  assert.match(connect,/isAvatarCircleHit/);
});
