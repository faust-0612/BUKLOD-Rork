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
if(process.env.BUKLOD_GENESIS_PRIVATE_ASSETS === 'true') {
  const manifestText=execFileSync('unzip',['-p',dest,'data/private_3d_manifest.json'],{encoding:'utf8',maxBuffer:1024*1024});
  const approved=JSON.parse(manifestText);
  assert.ok(approved.models.length>0&&approved.models.length<=16);
  const imported=files.filter(x=>/^3d\/private\/private_[a-z0-9_]+\.glb$/.test(x));
  assert.equal(imported.length,approved.models.length);
  for(const model of approved.models)
    assert.ok(files.includes('3d/private/'+model.id+'.glb'));
}
if(process.env.BUKLOD_GENESIS_PRIVATE_FX === 'true') {
  const fxText=execFileSync('unzip',['-p',dest,'data/private_fx_manifest.json'],
    {encoding:'utf8',maxBuffer:4*1024*1024});
  const fx=JSON.parse(fxText);
  assert.equal(fx.schema,1);
  assert.equal(fx.rightsStatus,'REVIEWED_IN_GAME_USE_ONLY');
  assert.equal(fx.releaseAuthority,'DEV_PREVIEW_ONLY');
  assert.ok(fx.assets.length>0&&fx.assets.length<=50);
  const packed=files.filter(x=>/^private-fx\/[a-z0-9_]+\.png$/.test(x));
  assert.equal(packed.length,fx.assets.length);
  for(const item of fx.assets) {
    assert.ok(files.includes(item.file));
    const data=execFileSync('unzip',['-p',dest,item.file],{maxBuffer:3*1024*1024});
    assert.equal(data.length,item.bytes);
    assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256);
  }
  for(const lic of fx.licenseProof) assert.ok(files.includes(lic.file));
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
