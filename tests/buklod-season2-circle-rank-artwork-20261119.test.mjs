import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const atlas = readFileSync(new URL('../assets/season2/circle-rank-atlas.webp', import.meta.url));
const art = read('src/lib/buklodCircleRankArtwork.ts');
const component = read('src/components/points/BuklodSeason2RankArtwork.tsx');
const avatar = read('src/components/ProfileAvatar.tsx');
const batch = read('src/lib/buklodCircleRankBatch.ts');

test('40 canonical rank names have one transparent 5x8 cell each; atlas is valid WebP', () => {
  assert.equal(atlas.toString('ascii', 0, 4), 'RIFF');
  assert.equal(atlas.toString('ascii', 8, 12), 'WEBP');
  assert.ok(atlas.length > 50_000 && atlas.length < 400_000);
  for (const family of ['Starter','Active','Steady','Builder','Impact','Vanguard','Prime','Prime Elite']) {
    assert.ok(art.includes("'" + family + "'"), family);
  }
  for (const level of ['V','IV','III','II','I']) assert.ok(art.includes("'" + level + "'"));
  assert.match(art, /row \* 5 \+ column \+ 1/);
  assert.match(component, /CIRCLE_RANK_ATLAS_COLUMNS = 5/);
  assert.match(component, /CIRCLE_RANK_ATLAS_ROWS = 8/);
  assert.match(component, /overflow: 'hidden'/);
  assert.match(component, /left: -badge\.column \* cell/);
  assert.match(component, /top: -badge\.row \* cell/);
});

test('Shared avatar has authoritative batched rank, dynamic border, 10-o-clock badge and online blue dot', () => {
  assert.match(avatar, /resolveBuklodCircleRank/);
  assert.match(avatar, /resolveCircleRankArtwork/);
  assert.match(avatar, /BuklodSeason2RankArtwork/);
  assert.match(avatar, /borderColor: badge\?\.borderColor/);
  assert.match(avatar, /left: -size \* 0\.27/);
  assert.match(avatar, /bottom: -size \* 0\.08/);
  assert.match(avatar, /isBuklodUserOnline/);
  assert.match(batch, /get_member_circle_ranks_v1/);
  assert.match(batch, /group\.length >= 32/);
  assert.doesNotMatch(batch, /\.from\(/);
});

test('Wall, Connect and Profile supply rank to shared unclipped avatar; rank roadmap preserved', () => {
  for (const p of ['src/components/BuklodTappableAvatar.tsx','src/components/connect/ConnectTappableAvatar.tsx']) {
    const c = read(p);
    assert.match(c, /rankName/);
    assert.match(c, /overflow: 'visible'/);
  }
  assert.match(read('src/app/(tabs)/buklod.tsx'), /rankName=\{item\.author_rank_name\}/);
  assert.match(read('src/components/connect/ConnectQuickContacts.tsx'), /rankName=\{contact\.rank_name\}/);
  assert.match(read('src/app/(tabs)/me.tsx'), /rankName=\{circleRank\}/);
  assert.match(read('src/app/points/progression.tsx'), /<BuklodCircleRankBadge/);
  assert.match(read('src/components/points/BuklodCircleRankBadge.tsx'), /BuklodSeason2RankArtwork/);
});
