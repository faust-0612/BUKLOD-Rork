import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';
import { HEROES, ARENA_MAPS, STARTER_HERO_KITS } from '../experiments/empire-arena-v2/arena-v2-engine.mjs';
import { ARENA_PICKUP_CATALOG } from '../experiments/empire-arena-v2/arena-v2-pickups.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function unpack(content) {
  const files = new Map();
  let pos = 0;
  while (content.readUInt32LE(pos) === 0x04034b50) {
    const method = content.readUInt16LE(pos + 8);
    const compressedLength = content.readUInt32LE(pos + 18);
    const filenameLength = content.readUInt16LE(pos + 26);
    const extraLength = content.readUInt16LE(pos + 28);
    const start = pos + 30;
    const name = content.subarray(start, start + filenameLength).toString('utf8');
    const compressed = content.subarray(start + filenameLength + extraLength, start + filenameLength + extraLength + compressedLength);
    files.set(name, method === 8 ? inflateRawSync(compressed) : compressed);
    pos = start + filenameLength + extraLength + compressedLength;
  }
  return files;
}

test('Godot project has a real playable scene, native physics, hero skills, unit AI, buildings and pickups', () => {
  const project = read('godot/empire-arena/project.godot');
  const scene = read('godot/empire-arena/scenes/Arena.tscn');
  const sim = read('godot/empire-arena/scripts/arena_simulation.gd');
  const root = read('godot/empire-arena/scripts/arena_root.gd');
  const hud = read('godot/empire-arena/scripts/arena_hud.gd');
  assert.match(project, /run\/main_scene="res:\/\/scenes\/Arena.tscn"/);
  assert.match(scene, /type="Camera2D"/);
  assert.match(scene, /ExtResource\("1_root"\)/);
  for (const feature of ['func begin(', 'func advance(', 'func action(', 'func _hit(',
    'func _skill(', 'func _bots(', 'func _automation(', 'func _try_drop(',
    'func _loot(', 'func _spend(', 'func _start_hunt(', 'func _finish_solo(']) {
    assert.ok(sim.includes(feature), 'Missing native Godot gameplay ' + feature);
  }
  for (const rendering of ['func _draw_actor(', 'func _draw_world(', 'func _draw(']) {
    assert.ok(root.includes(rendering), 'Missing Godot visual renderer ' + rendering);
  }
  assert.match(hud, /InputEventScreenTouch/);
  assert.match(hud, /InputEventScreenDrag/);
  assert.match(hud, /"ultimate"/);
  assert.match(hud, /"mine"/);
  assert.match(hud, /"train"/);
  assert.match(hud, /"build"/);
  for (const gd of [root, sim, hud]) {
    assert.doesNotMatch(gd, /https?:\/\/|supabase\s*\.|fetch\(|service_role\s*[=:]|signIn\(/i);
  }
});

test('Godot pack includes exact canonical 13 heroes, 3 maps and 300 match-only pickups', () => {
  const folder = mkdtempSync(join(tmpdir(), 'buklod-native-godot-'));
  try {
    const out = join(folder, 'empire-arena.zip');
    execFileSync(process.execPath, ['scripts/build-empire-godot-pack.mjs', '--out=' + out],
      {cwd: new URL('../', import.meta.url), timeout: 30000, stdio:'pipe'});
    const first = readFileSync(out);
    assert.equal(first.readUInt32LE(0), 0x04034b50);
    const pack = unpack(first);
    for (const expected of ['project.godot', 'data/catalog.json', 'scenes/Arena.tscn',
      'scripts/arena_root.gd', 'scripts/arena_hud.gd', 'scripts/arena_simulation.gd']) {
      assert.ok(pack.has(expected), expected);
    }
    const data = JSON.parse(pack.get('data/catalog.json').toString('utf8'));
    assert.deepEqual(data.heroes, HEROES);
    assert.deepEqual(data.maps, ARENA_MAPS);
    assert.deepEqual(data.starter, STARTER_HERO_KITS);
    assert.deepEqual(data.pickups, ARENA_PICKUP_CATALOG);
    assert.equal(data.arena, 'OFFLINE_PRACTICE');
    assert.equal(new Set(data.pickups.map(x => x.id)).size, 300);
    assert.equal(data.pickups.filter(x => x.category === 'exclusive').length, 156);
    assert.equal(data.pickups.filter(x => x.category === 'universal').length, 144);
    execFileSync(process.execPath, ['scripts/build-empire-godot-pack.mjs', '--out=' + out],
      {cwd: new URL('../', import.meta.url), timeout: 30000, stdio:'pipe'});
    assert.deepEqual(readFileSync(out), first, 'Godot pack must be byte-for-byte reproducible');
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('Android staging uses bundled pack, fails closed for all other app identities and changes native runtime', () => {
  const native = read('modules/buklod-genesis-godot/android/src/main/java/expo/modules/buklodgenesisgodot/BuklodGenesisGodotModule.kt');
  const activity = read('modules/buklod-genesis-godot/android/src/main/java/expo/modules/buklodgenesisgodot/GenesisGodotActivity.java');
  const bridge = read('modules/buklod-genesis-godot/index.ts');
  const plugin = read('plugins/withBuklodGodotArenaPack.js');
  const app = read('app.config.js');
  const screen = read('src/app/games/empire-arena.tsx');
  assert.match(native, /AsyncFunction\("openBundledArena"\)/);
  assert.match(native, /activity.packageName != "org.mzbministry.buklod.staging"/);
  assert.match(native, /activity.assets.open\("godot\/empire-arena.zip"\)/);
  assert.match(activity, /getBooleanExtra\(EXTRA_BUNDLED_ARENA, false\)/);
  assert.match(activity, /"--main-pack"/);
  assert.match(activity, /BUNDLED_ARENA_ASSET/);
  assert.match(bridge, /export async function openBundledEmpireArena/);
  assert.match(bridge, /EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED !== 'true'/);
  assert.match(plugin, /withDangerousMod/);
  assert.match(plugin, /process.env.APP_VARIANT !== 'staging'/);
  assert.match(plugin, /build-empire-godot-pack.mjs/);
  assert.match(app, /godotArenaNativePreview/);
  assert.match(app, /2\.0\.2-genesis-godot-arena/);
  assert.match(screen, /openBundledEmpireArena/);
  assert.match(screen, /PLAY GODOT EMPIRE ARENA/);
  assert.doesNotMatch(plugin, /curl|wget|fetch\(|supabase/);
  const saved = Object.fromEntries(['APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW','EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED','BUKLOD_APP_TARGET'].map(key => [key, process.env[key]]));
  try {
    for (const variant of ['production','staging']) {
      for (const godot of ['true','false']) {
        Object.assign(process.env, {APP_VARIANT:variant,EXPO_PUBLIC_APP_ENV:variant,
          EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true', EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED:godot,
          BUKLOD_APP_TARGET:'main'});
        const cfg = requireApp();
        const shouldEnable = variant === 'staging' && godot === 'true';
        assert.equal(cfg.android.package, shouldEnable ? 'org.mzbministry.buklod.staging' :
          variant === 'production' ? 'org.mzbministry.buklod' : 'org.mzbministry.buklod.staging');
        assert.equal(cfg.runtimeVersion, shouldEnable ? '2.0.2-genesis-godot-arena' :
          variant === 'production' ? '1.3.2' :
          process.env.EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3 === 'true' ? '2.0.1-genesis-sos' : '2.0.0-genesis-preview');
        assert.equal(cfg.plugins.includes('./plugins/withBuklodGodotArenaPack.js'), shouldEnable);
      }
    }
  } finally {
    for (const [key, value] of Object.entries(saved))
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
function requireApp() {
  const path = require.resolve('../app.config.js');
  delete require.cache[path];
  return require(path)({config:{extra:{}}});
}
