import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const data = read('godot/kingdom-zero-assets/scripts/kingdom_data.gd');
const world = read('godot/kingdom-zero-assets/scripts/world.gd');
const scene = read('godot/kingdom-zero-assets/scenes/Main.tscn');
const cfg = read('godot/kingdom-zero-assets/project.godot');
const map = read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');

test('Exact 13 BUKLOD canonical station IDs and coordinates are retained', () => {
  const fromGodot = [...data.matchAll(/\{"id":"([^"]+)","name":"([^"]+)","x":(\d+),"y":(\d+),"color":"(#[a-f0-9]+)"\}/g)];
  assert.equal(fromGodot.length, 13);
  const originalBlock = map.slice(map.indexOf('const STATIONS:'), map.indexOf('const JOURNEY_PATH'));
  for (const record of fromGodot) {
    const [, id, , x, y] = record;
    const original = originalBlock.split('\n').find(line => line.includes("id: '" + id + "'"));
    assert.ok(original, 'Original station missing: ' + id);
    assert.match(original, new RegExp('x: ' + x + ', y: ' + y + ','));
  }
  assert.equal(new Set(fromGodot.map(record => record[1])).size, 13);
});

test('Exactly 13 Kingdom roads connect original map waypoints', () => {
  const stations = [...data.matchAll(/\{"id":"([^"]+)","name":"([^"]+)","x":(\d+),"y":(\d+),"color":"(#[a-f0-9]+)"\}/g)];
  const pairs = [...data.matchAll(/Vector2i\((\d+),(\d+)\)/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.equal(pairs.length, 13);
  const pathBlock = map.slice(map.indexOf('const JOURNEY_PATH'), map.indexOf('const FOREST_POINTS'));
  for (const [a, b] of pairs) {
    assert.ok(a >= 0 && a < stations.length && b >= 0 && b < stations.length && a !== b);
    const [x1, y1] = [stations[a][3], stations[a][4]];
    const [x2, y2] = [stations[b][3], stations[b][4]];
    assert.match(pathBlock, new RegExp('M ' + x1 + ' ' + y1 + ' C [0-9 ]+ ' + x2 + ' ' + y2));
  }
});

test('Godot project is actually linked to a single 3D implementation', () => {
  assert.match(cfg, /res:\/\/scenes\/Main.tscn/);
  assert.match(cfg, /gl_compatibility/);
  assert.match(scene, /res:\/\/scripts\/world.gd/);
  assert.match(world, /preload\("res:\/\/scripts\/kingdom_data.gd"\)/);
  assert.match(world, /_build_trees\(\)/);
  assert.match(world, /_spawn_workers\(\)/);
  assert.match(world, /_construct\(\)/);
  assert.match(world, /InputEventScreenTouch/);
  assert.match(world, /InputEventScreenDrag/);
  assert.match(world, /NOTIFICATION_APPLICATION_PAUSED/);
});

test('No unapproved cash, account, downloads, network or reward logic', () => {
  assert.match(world, /const MAX_SUPPLIES: int = 16/);
  assert.match(world, /const BUILD_COST: int = 4/);
  assert.match(world, /const SUPPLY_INTERVAL: float = 6.0/);
  assert.match(world, /const WORKER_COUNT: int = 8/);
  assert.match(world, /if constructed.has\(id\) or supplies < BUILD_COST:/);
  assert.match(world, /supplies -= BUILD_COST/);
  assert.doesNotMatch(world + data, /HTTPRequest|HTTPClient|fetch\(|supabase|AdMob|awardPoints|grantShards|user:\/\/|\.glb|\.ogg|\.riv/);
});
