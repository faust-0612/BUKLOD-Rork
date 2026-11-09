import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Profile Circle Rank links to the server-backed progression, not an About alert', () => {
  const profile = read('src/app/(tabs)/me.tsx');
  const card = read('src/components/points/BuklodProfileCharacterCard.tsx');
  assert.match(profile, /subtitle="View 40-level Circle Rank progression"/);
  assert.match(profile, /onPress=\{\(\) => router\.push\('\/points\/progression' as any\)\}/);
  assert.match(card, /accessibilityLabel="Open Circle Rank progression"/);
  assert.match(card, /Circle progression →/);
  assert.match(card, /View ranking →/); // The existing Top 10 remains separate.
});

test('Circle Rank roadmap reads the canonical 40-rank ladder and authenticated progress', () => {
  const route = read('src/app/points/progression.tsx');
  assert.match(route, /get_my_buklod_rank_progress/);
  assert.match(route, /get_buklod_rank_ladder/);
  assert.match(route, /FULL RANK ROADMAP/);
  assert.match(route, /ladder\.map\(\(item, index\)/);
  assert.match(route, /item\.min_points/);
  assert.match(route, /item\.max_points/);
  assert.match(route, /progress\.points_to_next/);
  assert.match(route, /progress\.next_rank_name/);
  assert.match(route, /progress\.progress_percent/);
  assert.doesNotMatch(route, /get_buklod_points_leaderboard/);
});

test('Rank route recovers from stale requests, network errors and handles the max rank', () => {
  const route = read('src/app/points/progression.tsx');
  assert.match(route, /requestId\.current/);
  assert.match(route, /request !== requestId\.current/);
  assert.match(route, /Refreshing|refreshing/);
  assert.match(route, /TRY AGAIN/);
  assert.match(route, /Maximum Circle Rank reached/);
  assert.match(route, /rank_order/);
  assert.match(route, /as `\$\{number\}\%`/);
});

test('Existing points claims and leaderboard remain unchanged and reachable', () => {
  const points = read('src/components/points/BuklodPointsRewardsScreen.tsx');
  assert.match(points, /VIEW 40-RANK PROGRESSION/);
  assert.match(points, /get_buklod_points_leaderboard/);
  assert.match(points, /Claim all verified BUKLOD Points/);
  assert.match(points, /Claim all verified/);
});
