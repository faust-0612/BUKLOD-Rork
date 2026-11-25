#!/usr/bin/env node
/**
 * Deterministic bundled/OTA Godot content from the SAME reviewed art and
 * 70 audio cues. No external downloads, rewards, backend edits or APK signing.
 * MUST execute before the staging 2.0.6 JS bundle / EAS local build / OTA export.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'assets/season2/genesis/ota/empire-arena.zip');
const manifest = path.join(root, 'src/features/season2/genesis/godotPackManifest.generated.ts');
mkdirSync(path.dirname(dest), { recursive: true });
mkdirSync(path.dirname(manifest), { recursive: true });
execFileSync(process.execPath, [path.join(root, 'scripts/build-empire-godot-pack.mjs'), '--out=' + dest], {
  cwd: root, timeout: 120000, stdio: 'inherit',
});
const bytes = statSync(dest).size;
assert.ok(bytes > 500 && bytes < 256 * 1024 * 1024, 'Unexpected OTA Godot ZIP size');
const files = execFileSync('unzip', ['-Z1', dest], { encoding: 'utf8', timeout: 60000 })
  .trim().split(/\r?\n/);
for (const entry of [
  'project.godot', 'scenes/Arena.tscn', 'scenes/WorldPreview.tscn',
  'scenes/LivingKingdom.tscn', 'scripts/living_kingdom.gd', 'scripts/kingdom_mission_state.gd', 'data/kingdom_realms.json', 'tests/living_kingdom_smoke.gd',
  'data/kingdom_original_media.json', 'kingdom-original/heroes/phan.glb', 'kingdom-original/audio/complete.wav', 'kingdom-original/ambience/phan.wav', 'shaders/kingdom_original_water.gdshader', 'scripts/kingdom_cinematic_fx.gd',
  'scripts/world_explore_controller.gd', 'scripts/arena_root.gd',
  'world-art/kingdom.webp', 'world-art/house.webp', 'splash/buklod-green-b.png',
  'world-audio/kingdom_ambience.wav', 'world-audio/house_ambience.wav'
]) assert.ok(files.includes(entry), 'Godot OTA pack missing ' + entry);
assert.equal(files.filter(x => /^art\/(fullbody|sprite|scene)\/.*\.png$/.test(x)).length, 68);
assert.equal(files.filter(x => /^audio\/sfx\/.*\.wav$/.test(x)).length, 70);
assert.equal(files.filter(x => /^kingdom-items\/(badge|bond|book|chest|crystal|light|relic)-[1-6]\.webp$/.test(x)).length, 42);
if(process.env.BUKLOD_GENESIS_PREMIUM_3D === 'true') {
  assert.equal(files.filter(x=>/^3d\/kenney\/[a-z0-9_]+\.glb$/.test(x)).length,20);
  assert.equal(files.filter(x=>/^3d\/kaykit\/rig_[a-z0-9_]+\.glb$/.test(x)).length,2);
  assert.ok(files.includes('scenes/PremiumWorld3D.tscn'));
  assert.ok(files.includes('data/3d_manifest.json'));
}
const sha256 = createHash('sha256').update(readFileSync(dest)).digest('hex');
writeFileSync(manifest, `/** GENERATED from exact reviewed Genesis Godot source; do not edit manually. */
export const GENESIS_GODOT_OTA_PACK = {
  schema: 1 as const,
  engine: '4.7.2',
  sha256: '${sha256}',
  bytes: ${bytes},
} as const;
`);
console.log('GENESIS_GODOT_OTA_PACK_PREPARED '+JSON.stringify({bytes,sha256,assets:68,kingdomItems:42,cues:70}));
