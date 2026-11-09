import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Original, offline-rendered badges replace numerical rank circles', () => {
  const badge = read('src/components/points/BuklodCircleRankBadge.tsx');
  const roadmap = read('src/app/points/progression.tsx');
  assert.match(badge, /FAMILY_COLORS/);
  for (const family of ['starter','active','steady','builder','impact','vanguard','prime','prime elite']) {
    assert.ok(badge.includes(family), family);
  }
  assert.match(roadmap, /locked=\{!achieved && !current\}/);
  assert.match(roadmap, /<BuklodCircleRankBadge/);
  assert.doesNotMatch(roadmap, /\{order\}\s*<\/Text>/);
});

test('Rank-up recognition follows verified server rank and per-account durable baseline', () => {
  const roadmap = read('src/app/points/progression.tsx');
  assert.match(roadmap, /get_my_buklod_rank_progress/);
  assert.match(roadmap, /get_buklod_rank_ladder/);
  assert.match(roadmap, /buklod:circle-rank:last-seen:v1:/);
  assert.match(roadmap, /previous !== null/);
  assert.match(roadmap, /order > previous/);
  assert.match(roadmap, /AsyncStorage\.setItem/);
  assert.match(roadmap, /setRankUp\(verifiedProgress\)/);
  assert.match(roadmap, /onRequestClose=\{\(\) => setRankUp\(null\)\}/);
});

test('Rank entry points preserve character autonomy and navigate to the canonical roadmap', () => {
  const greetings = read('src/components/BuklodLivingGreetingsBanner.tsx');
  const card = read('src/components/BuklodRankCard.tsx');
  const selection = read('src/lib/buklodCharacterSelectionV2.ts');
  assert.match(greetings, /action:'Tingnan ang rank',route:'\/points\/progression'/);
  assert.match(card, /<BuklodCircleRankBadge/);
  assert.match(selection, /ATOMIC_RESET_LEVEL_1_V2/);
  assert.match(selection, /circle_rank_order/);
  assert.match(selection, /character_points_since_selection/);
  const recognition = read('src/components/points/BuklodCharacterLevelRecognition.tsx');
  const profile = read('src/components/points/BuklodProfileCharacterCard.tsx');
  assert.match(recognition, /buklod:character-level:last-seen:v1:/);
  assert.match(recognition, /baseline/);
  assert.match(recognition, /level > previous/);
  assert.match(profile, /<BuklodCharacterLevelRecognition userId=\{userId\} selection=\{selection\}/);
  assert.match(profile, /<BuklodCircleRankBadge rankName=\{rankLabel\}/);
});
