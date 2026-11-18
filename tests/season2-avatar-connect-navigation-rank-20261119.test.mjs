import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('Season 2 shared avatar does not intercept Wall or Connect navigation', () => {
  const wall = read('src/components/BuklodTappableAvatar.tsx');
  const connect = read('src/components/connect/ConnectTappableAvatar.tsx');
  const badge = read('src/components/points/BuklodSeason2RankArtwork.tsx');
  assert.match(wall, /isAvatarCircleHit/);
  assert.match(wall, /visitMemberProfile/);
  assert.match(connect, /openConversation/);
  assert.match(connect, /isAvatarCircleHit/);
  assert.match(badge, /pointerEvents="none"/);
  assert.match(badge, /overflow: 'hidden'/);
  assert.match(wall, /overflow: 'visible'/);
  assert.match(connect, /overflow: 'visible'/);
});
test('Do not alter existing navigation tabs, user sessions or ads in the avatar change', () => {
  const avatar = read('src/components/ProfileAvatar.tsx');
  assert.match(avatar, /get_buklod_profile_avatars_v1/);
  assert.match(avatar, /useAuth/);
  assert.match(avatar, /ProfileAvatarStatusIndicator/);
  assert.match(read('src/lib/buklodCircleRankBatch.ts'), /get_member_circle_ranks_v1/);
  assert.doesNotMatch(avatar, /navigate\(/);
});
