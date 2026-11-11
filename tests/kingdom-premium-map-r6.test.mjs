/**
 * R6 Kingdom map presentation contract:
 * the visual world can improve, but station coordinates, names, routes,
 * progression/read-only status and the in-app /games entry must not regress.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const read = filename => fs.readFileSync(new URL('../' + filename, import.meta.url), 'utf8');
const legacy = read('src/features/games/kingdom/BuklodKingdomMap.tsx');
const premium = read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
const gameRoute = read('src/app/games/index.tsx');
const catalog = JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));

function between(source, start, end) {
  const s = source.indexOf(start), e = source.indexOf(end, s + start.length);
  assert.ok(s >= 0 && e > s, 'missing station-layout source anchors');
  return source.slice(s, e);
}

test('Kingdom map remains inside the existing BUKLOD App at /games', () => {
  assert.ok(gameRoute.includes('BuklodKingdomMapPremium'));
  // The in-app map may now be composed with a noninteractive footer ad.
  assert.match(gameRoute, /<BuklodKingdomMap \/>/);
  assert.match(gameRoute, /<BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner" \/>/);
  assert.ok(!gameRoute.includes('WebView'));
  assert.ok(!gameRoute.includes('https://'));
  assert.ok(premium.includes("router.push(station.href as any)"));
  assert.ok(premium.includes('router.back()'));
  assert.ok(premium.includes('INSIDE THE BUKLOD APP'));
});

test('Map visual redesign preserves all 13 original coordinates, names, routes and journey segments EXACTLY', () => {
  const stations = between(legacy, 'const STATIONS:', 'const JOURNEY_PATH');
  const newStations = between(premium, 'const STATIONS:', 'const JOURNEY_PATH');
  assert.equal(newStations, stations, 'never alter canonical station geometry or names under visual-only scope');
  assert.equal(
    between(premium, 'const JOURNEY_PATH', 'const FOREST_POINTS'),
    between(legacy, 'const JOURNEY_PATH', 'const FOREST_POINTS'),
    'original route curves must remain exact',
  );
  const data = catalog.characters.flatMap(center => center.games);
  assert.equal(catalog.characters.length, 13);
  assert.equal(data.length, 39);
  assert.equal(data.filter(game => game.status === 'existing').length, 13);
  for (const center of catalog.characters) {
    assert.ok(premium.includes(center.stationId), center.stationId + ' is on the map');
    assert.ok(premium.includes("href: '/games/" + center.stationId + "'"),
      center.stationId + ' opens original route');
  }
});

test('R6 premium map improves performance and meaningful mobile input without changing game rules', () => {
  assert.ok(premium.includes('IllustratedRealm'));
  assert.ok(premium.includes('KingdomStation'));
  assert.ok(premium.includes('onLongPress={() => onFocus(station)}'));
  assert.ok(premium.includes('onPress={() => onEnter(station)}'));
  assert.ok(premium.includes("setMode(current => current === 'detail' ? 'fit' : 'detail')"));
  assert.ok(premium.includes('horizontalRef.current?.scrollTo('));
  assert.ok(premium.includes('verticalRef.current?.scrollTo('));
  assert.ok(premium.includes('accessibilityLabel'));
  assert.ok(premium.includes('useSafeAreaInsets'));
  assert.ok(!premium.includes('BuklodGameBackdrop'));
  assert.ok(!premium.includes('Animated.loop'));
  assert.ok(!premium.includes('supabase.'));
  assert.ok(!premium.includes('.rpc('));
  assert.ok(!premium.includes('showBuklodInterstitial'));
  assert.ok(premium.includes('LOCAL CLEARS'));
});

test('R6 design is reversible: canonical R5 map still intact as safe fallback', () => {
  const sha = createHash('sha1')
    .update('blob ' + Buffer.byteLength(legacy) + '\0')
    .update(legacy).digest('hex');
  assert.equal(sha, '88a4b1b4a70fc4acd59579419058b47f21be2554');
  for (const token of [
    'BUKLOD KINGDOM', 'A SMALL BEGINNING', 'A BRIGHTER TOMORROW',
    'COMING SOON', 'SCRIPTURE GARDEN', 'BUKLOD CITADEL', 'EXPLORE THE KINGDOM',
  ]) assert.ok(premium.includes(token), token + ' missing in premium map');
});
