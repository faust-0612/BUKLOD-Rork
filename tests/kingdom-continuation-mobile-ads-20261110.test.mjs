import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const map = read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
const oldMap = read('src/features/games/kingdom/BuklodKingdomMap.tsx');
const companion = read('src/features/games/runtime/BuklodGameCharacterCompanion.tsx');
const center = read('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');
const mastery = read('src/features/games/kingdom/platform/KingdomMasteryCheck.tsx');
const ads = read('src/lib/buklodGlobalAdController.ts');
const events = read('src/lib/buklodAdOpportunities.ts');

const segment = (text, start, end) => {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, 'valid geometry section');
  return text.slice(from, to);
};

test('map zoom is bounded and preserves every old station and route coordinate', () => {
  assert.equal(segment(map, 'const STATIONS:', 'const JOURNEY_PATH'),
    segment(oldMap, 'const STATIONS:', 'const JOURNEY_PATH'));
  assert.equal(segment(map, 'const JOURNEY_PATH', 'const FOREST_POINTS'),
    segment(oldMap, 'const JOURNEY_PATH', 'const FOREST_POINTS'));
  assert.match(map, /Math\.pow\(1\.2, zoomStep\)/);
  assert.match(map, /Math\.min\(3, value \+ 1\)/);
  assert.match(map, /Math\.max\(-2, value - 1\)/);
  assert.match(map, /initialFocusRef\.current\) focus\(selectedStation, false\)/);
  assert.match(map, /Math\.max\(24, insets\.top\) \+ 10/);
});

test('companion drag is clamped and original active character art remains unchanged', () => {
  assert.match(companion, /PanResponder\.create/);
  assert.match(companion, /translation\.setValue\(next\)/);
  assert.match(companion, /Math\.min\(width - 88/);
  assert.match(companion, /Math\.min\(35/);
  assert.match(companion, /BuklodActiveCharacterArt/);
  assert.match(companion, /BuklodCharacterMotion/);
  assert.doesNotMatch(companion, /setInterval|navigator\.geolocation/);
});

test('Kingdom BP display uses the authoritative server and a bounded 39-game reward', () => {
  assert.match(center, /get_my_buklod_kingdom_mastery_progress_v1/);
  assert.match(center, /masteries\s*\?\?\s*'—'/);
  assert.match(center, /recordKingdomPreviewResult\(owner, sessionId, result\)/);
  assert.match(center, /NEXT CHALLENGE/);
  assert.match(mastery, /onVerified\?\.\(\)/);
  assert.match(mastery, /finish_my_buklod_kingdom_mastery_v1/);
  assert.doesNotMatch(center, /insert\(\{\s*points:/);
});

test('Kingdom ads do not open generic sensitive routes or grant BP', () => {
  assert.match(ads, /placementId\.startsWith\('kingdom-game-center-'\)/);
  assert.match(ads, /placement === 'content'/);
  assert.match(ads, /route\.startsWith\('\/games\/'\)/);
  assert.match(ads, /placementId === 'interstitial_kingdom_game_completed'/);
  assert.match(ads, /placementId === 'interstitial_kingdom_mastery_verified'/);
  assert.match(events, /kingdom_game_completed: \{ reason: 'game_session_completed'/);
  assert.match(center, /offeredAds\.current\.has\(receiptKey\)/);
  assert.match(center, /result\.status === 'won'/);
  assert.match(center, /<BuklodAdMobBanner placement="content"/);
  assert.doesNotMatch(events, /kingdom_game_completed[^\n]+rewarded/);
});
