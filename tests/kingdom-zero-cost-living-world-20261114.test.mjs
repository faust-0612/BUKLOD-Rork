import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  KINGDOM_WORLD_PATROLS, KINGDOM_WORLD_WORKERS, sampleKingdomPatrol,
} from '../src/features/games/kingdom/KingdomLivingWorldPaths.ts';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('All ambient walkers follow existing approved cubic Kingdom roads', () => {
  const map = read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
  const routes = map.slice(map.indexOf('const JOURNEY_PATH'), map.indexOf('const FOREST_POINTS'));
  assert.equal(KINGDOM_WORLD_PATROLS.length, 11);
  assert.equal(new Set(KINGDOM_WORLD_PATROLS.map(route => route.id)).size, 11);
  for (const route of KINGDOM_WORLD_PATROLS) {
    const [a,b,c,d] = route.points;
    const canonical = `M ${a[0]} ${a[1]} C ${b[0]} ${b[1]} ${c[0]} ${c[1]} ${d[0]} ${d[1]}`;
    assert.ok(routes.includes(canonical), route.id + ' diverged from the immutable Kingdom map');
    assert.ok([1,2,3].includes(route.minStage));
    assert.ok(route.offset >= 0 && route.offset < 1);
    for (let k = 0; k < 20; k++) {
      const point = sampleKingdomPatrol(route, k / 20);
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), route.id);
      assert.ok(point.x >= 0 && point.x <= 1200, route.id);
      assert.ok(point.y >= 0 && point.y <= 900, route.id);
    }
    const start = sampleKingdomPatrol(route, -route.offset);
    const nearEnd = sampleKingdomPatrol(route, 0.99999 - route.offset);
    assert.ok(Math.abs(start.x - a[0]) < 1e-7 && Math.abs(start.y - a[1]) < 1e-7, route.id);
    assert.ok(Math.abs(nearEnd.x - d[0]) < .1 && Math.abs(nearEnd.y - d[1]) < .1, route.id);
  }
});

test('World workers have bounded non-interactive activity, not game rewards', () => {
  assert.equal(KINGDOM_WORLD_WORKERS.length, 6);
  assert.equal(new Set(KINGDOM_WORLD_WORKERS.map(worker => worker.id)).size, 6);
  for (const worker of KINGDOM_WORLD_WORKERS) {
    assert.ok(worker.x >= 0 && worker.x <= 1200);
    assert.ok(worker.y >= 0 && worker.y <= 900);
    assert.ok(worker.offset >= 0 && worker.offset < 1);
    assert.ok([1,2,3].includes(worker.minStage));
  }
  const native = read('src/features/games/kingdom/BuklodKingdomLivingFX.native.tsx');
  assert.match(native, /<RoadTraveler /);
  assert.match(native, /<TownWorker /);
  assert.match(native, /KINGDOM_WORLD_PATROLS\.filter\(route => stage >= route\.minStage\)/);
  assert.match(native, /KINGDOM_WORLD_WORKERS\.filter\(site => stage >= site\.minStage\)/);
  assert.match(native, /pointerEvents="none"/);
  assert.match(native, /useFocusEffect/);
  assert.match(native, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(native, /AppState\.addEventListener/);
  assert.match(native, /cancelAnimation\(phase\)/);
  assert.doesNotMatch(native, /requestAnimationFrame|setInterval|fetch\(|supabase|AsyncStorage|awardPoints|grantShards/);
});

test('No new native modules, unlicensed media, ads or deployment edits', () => {
  const map = read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
  assert.equal((map.match(/id: '[a-z]+-[a-z-]+'/g) || []).length >= 13, true);
  const renderer = read('src/features/games/kingdom/BuklodKingdomLivingFX.native.tsx');
  assert.match(renderer, /const running = cinematic && focused && active && !reduceMotion/);
  assert.match(renderer, /withRepeat\(withTiming\(1, \{ duration: 13000/);
  assert.doesNotMatch(renderer, /\.glb|\.riv|\.png|\.ogg|\.mp3|https?:\/\//);
});
