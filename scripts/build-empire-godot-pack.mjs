#!/usr/bin/env node
/**
 * Deterministic, dependency-free Godot main-pack ZIP. The 13 hero identities,
 * 300 temporary pickups and all canonical gameplay constants are imported
 * from their reviewed JS sources; no duplicate hand-maintained rosters.
 * This is a native 2D offline PRACTICE pack, not a ranked game/client.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { HEROES, MODES, COSTS, BUFFS, STARTER_HERO_KITS, ARENA_MAPS, BUILD_COSTS } from '../experiments/empire-arena-v2/arena-v2-engine.mjs';
import { ARENA_PICKUP_CATALOG } from '../experiments/empire-arena-v2/arena-v2-pickups.mjs';
import { ARENA_SFX_IDS, arenaSfxEntries } from './arena-library-audio-pack.mjs';
import { buildLivingKingdomCatalog } from './kingdom-living-realms-catalog.mjs';
import { originalKingdomEntries } from './kingdom-original-media.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.join(root, 'godot/empire-arena');
const output = process.argv.find(x => x.startsWith('--out='))?.slice(6) ||
  path.join(root, 'build/empire-arena/empire-arena.zip');
const catalog = { schema: 1, arena: 'OFFLINE_PRACTICE', engine: 'Godot 4.7.2',
  heroes: HEROES, starter: STARTER_HERO_KITS, modes: MODES, maps: ARENA_MAPS,
  costs: COSTS, buildings: BUILD_COSTS, buffs: BUFFS, pickups: ARENA_PICKUP_CATALOG };
// Owner Library data becomes bounded, practice-only match configuration.
// Never run the uploaded Node2D combat scripts alongside this authority.
const libraryIntake = JSON.parse(readFileSync(path.join(project,
  'library/arena_intake_20261122.json'), 'utf8'));
assert.equal(libraryIntake.schema, 1);
assert.equal(libraryIntake.practiceOnly, true);
assert.equal(Object.keys(libraryIntake.heroes).length, 7);
assert.equal(Object.keys(libraryIntake.minions).length, 5);
assert.equal(Object.keys(libraryIntake.villagers).length, 2);
assert.deepEqual(new Set(Object.keys(libraryIntake.heroes)), new Set(Object.keys(HEROES)
  .filter(id => !Object.hasOwn(STARTER_HERO_KITS, id))));
assert.ok(Object.entries(libraryIntake.heroes).every(([id, kit]) =>
  Object.hasOwn(HEROES, id) && Number.isInteger(kit.unlockRank) &&
  Number.isFinite(kit.basic.damage) && kit.basic.damage > 0 &&
  ['primary','secondary','ultimate'].every(slot =>
    typeof kit[slot].id === 'string' && kit[slot].cd > 0)));
assert.ok(libraryIntake.waves.length >= 3 && libraryIntake.waves.every(w =>
  w.units.every(role => Object.hasOwn(libraryIntake.minions, role))));
assert.ok(Object.values(libraryIntake.villagers).every(f => f.villagers.length === 6));
catalog.library = libraryIntake;
catalog.starter = { ...STARTER_HERO_KITS, ...libraryIntake.heroes };
// Owner Library's four game choices stay OFFLINE practice. Never use the
// original ranked=true flags to mint server outcomes on a client.
catalog.modes = {
  ...MODES,
  classic_conquest: {...MODES.grand, minutes: 15, offline: true},
  genesis_rift: {...MODES.cluster, minutes: 8, offline: true},
  dominion_frontier: {...MODES.grand, minutes: 20, offline: true},
  special_event: {...MODES.grand, minutes: 20, offline: true},
};
catalog.libraryModes = {
  classic_conquest: {playersPerTeam:5, ranked:false, pve:false, lanes:['top','mid','bottom'], waveSeconds:30},
  genesis_rift: {playersPerTeam:3, ranked:false, pve:false, lanes:['mid'], waveSeconds:20, lightCore:true},
  dominion_frontier: {playersPerTeam:5, ranked:false, pve:true, lanes:['mid'], waveSeconds:25},
  special_event: {playersPerTeam:5, ranked:false, pve:false, lanes:['top','mid','bottom'], waveSeconds:30},
};


assert.equal(Object.keys(catalog.heroes).length, 13);
assert.equal(Object.keys(catalog.maps).length, 3);
assert.equal(catalog.pickups.length, 300);
assert.equal(new Set(catalog.pickups.map(x => x.id)).size, 300);
assert.ok(catalog.pickups.every(x => !x.transferable && x.temporary));
assert.ok(output.endsWith('.zip'), 'Godot --main-pack requires a .zip archive');
const data = Buffer.from(JSON.stringify(catalog), 'utf8');
const entries = [{ name: 'data/catalog.json', bytes: data }];
const kingdom = buildLivingKingdomCatalog(JSON.parse(readFileSync(path.join(root,'src/features/games/kingdom/platform/game-catalog.json'),'utf8')));
entries.push({name:'data/kingdom_realms.json',bytes:Buffer.from(JSON.stringify(kingdom),'utf8')});
const originalKingdom = originalKingdomEntries();
assert.equal(originalKingdom.manifest.heroes.length,13);
assert.equal(originalKingdom.manifest.cues.length,7);
entries.push(...originalKingdom.entries,{name:'data/kingdom_original_media.json',bytes:Buffer.from(JSON.stringify(originalKingdom.manifest))});
const splashSource = path.join(root,'assets/season2/genesis/genesis-green-b-transparent.png');
const nativeSplash = readFileSync(splashSource);
assert.ok(nativeSplash.length > 1024 &&
  nativeSplash.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
  'Missing signed BUKLOD Genesis green-B native Godot splash asset');
entries.push({name:'splash/buklod-green-b.png',bytes:nativeSplash});
function collect(dir, prefix = '') {
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '.godot' || name === 'data') continue;
      collect(full, prefix + name + '/');
      continue;
    }
    if (!/\.gd$|\.gdshader$|\.tscn$|^project\.godot$/.test(name)) continue;
    entries.push({ name: prefix + name, bytes: readFileSync(full) });
  }
}
collect(project);

// Optional real glTF 3D content: release-controlled, provenance-verified and
// strictly capped. Existing 2D packs remain supported if this flag is off.
if (process.env.BUKLOD_GENESIS_PREMIUM_3D === 'true') {
  const modelManifest = JSON.parse(readFileSync(path.join(project,
    'library/verified_cc0_3d_manifest.json'),'utf8'));
  const built = JSON.parse(readFileSync(path.join(root,
    'build/genesis-206-imported-3d/manifest.json'),'utf8'));
  assert.equal(modelManifest.models.length,20);
  assert.equal(modelManifest.rigs.length,2);
  assert.equal(built.schema,2);
  assert.equal(built.models.length,22);
  assert.equal(built.license,'CC0-1.0');
  let total = 0;
  for(const item of [...modelManifest.models,...modelManifest.rigs]) {
    const record = built.models.find(x=>x.id===item.id);
    assert.ok(record && record.sourceGitBlob===item.gitBlob,
      'Unapproved 3D mesh '+item.id);
    const bytes=readFileSync(path.join(root,'build/genesis-206-imported-3d',item.id+'.glb'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
    assert.equal(bytes.length,item.bytes);
    entries.push({name:(item.id.startsWith('rig_')?'3d/kaykit/':'3d/kenney/')+item.id+'.glb',bytes});
    total += bytes.length;
  }
  assert.ok(total>6*1024*1024 && total<16*1024*1024,'Incorrect 3D+rigged source set');
  entries.push({name:'data/3d_manifest.json',
    bytes:Buffer.from(JSON.stringify(built))});
  console.log('BUKLOD_206_3D_GLTF_REAL_MESHES_EMBEDDED '+JSON.stringify({count:22,rigged:2,bytes:total}));
}

// Embed exactly the 70 character skill, ultimate and team-event audio cues
// from the Library's 2026-11-22 file inventory. Original uploaded audio
// requires separate binary-art reconciliation; these procedural placeholders
// preserve event identity without network downloads or a hidden subscription.
const {cues:audioEntries,manifest:audioManifest} = arenaSfxEntries(root);
assert.equal(audioEntries.length, 70);
entries.push({name:'data/audio_manifest.json',
  bytes:Buffer.from(JSON.stringify(audioManifest))});
for (const cue of audioEntries) {
  assert.ok(cue.bytes.length > 44 && cue.bytes.subarray(0,4).toString() === 'RIFF');
  assert.ok(!entries.some(x => x.name === cue.name), 'Duplicate Arena native audio cue');
  entries.push(cue);
}

// Carry the SAME approved bitmap assets already shipped by the existing BUKLOD
// Arena source. No mockup replacement, stock image, new license or asset URL.
const manifestDir = path.join(root, 'src/features/games/empire');
const visualManifest = readFileSync(path.join(manifestDir, 'arenaGeneratedAssets.ts'), 'utf8');
const imageRoot = path.join(root, 'assets/season2/arena/generated') + path.sep;
const artCounts = { fullbody: 0, scene: 0, sprite: 0 };
for (const match of visualManifest.matchAll(/'(fullbody|scene|sprite):([^']+)':\s*require\('([^']+)'\)/g)) {
  const [, group, key, relative] = match;
  const filename = path.resolve(manifestDir, relative);
  assert.ok(filename.startsWith(imageRoot), 'Arena pack image escapes approved art inventory');
  const ext = path.extname(filename);
  assert.ok((group === 'scene' && ext === '.png') || (group !== 'scene' && ext === '.webp'),
    'Unexpected asset format for ' + group);
  assert.match(key, /^[a-z0-9_]+$/, 'Unsafe asset key');
  // Animated WebP cannot decode in Godot 4.7.2. Native atlases have
  // already been exported and reviewed as repository source files, not
  // generated with external codecs during EAS/native prebuild.
  const vendored = path.join(project, 'art', group, key + '.png');
  const bytes = readFileSync(group === 'scene' ? filename : vendored);
  assert.ok(bytes.length > 100 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'Native Arena art PNG validation failed for ' + key);
  entries.push({ name: 'art/' + group + '/' + key + '.png', bytes });
  artCounts[group]++;
}
assert.deepEqual(artCounts, { fullbody: 52, scene: 3, sprite: 13 },
  'Never publish a partial hero-animation/map art inventory into Godot');
const artManifest = JSON.parse(readFileSync(path.join(project, 'art/art_manifest.json'), 'utf8'));
assert.equal(Object.keys(artManifest.assets || {}).length, 65, 'Missing approved art atlas metadata');
entries.push({ name: 'art/art_manifest.json',
  bytes: readFileSync(path.join(project, 'art/art_manifest.json')) });

// The same native pack includes owner-approved Kingdom, Community and House
// visuals/SFX already in BUKLOD MAIN (no network download or external license).
// These remain PREVIEWS; no property or reward authority is in the pack.
// Use the original 42 approved, individually authored Kingdom items already
// transferred from the owner's Library into the audited MAIN repository.
// These are cosmetic previews ONLY, not client-owned inventory or rewards.
const KINGDOM_ITEM_CLASSES = ['badge','bond','book','chest','crystal','light','relic'];
let kingdomItemCount = 0;
for(const category of KINGDOM_ITEM_CLASSES) {
  for(let variant = 1; variant <= 6; variant++) {
    const filename = category + '-' + variant + '.webp';
    const image = readFileSync(path.join(root, 'assets/images/kingdom-classes', filename));
    assert.ok(image.length > 500 && image.length < 500000 &&
      image.subarray(0, 4).toString('ascii') === 'RIFF' &&
      image.subarray(8, 12).toString('ascii') === 'WEBP',
      'Invalid reviewed Kingdom class art: ' + filename);
    entries.push({name: 'kingdom-items/' + filename, bytes:image});
    kingdomItemCount++;
  }
}
assert.equal(kingdomItemCount,42,'Partial owner Kingdom item collection');

const originalWorldMedia = [
  ['world-art/kingdom.webp', 'assets/season2/genesis/kingdom/kingdom-nature-panorama.webp', 'RIFF'],
  ['world-art/community.webp', 'assets/season2/genesis/world/buklod-community-village-stage1.webp', 'RIFF'],
  ['world-art/house.webp', 'assets/season2/genesis/world/buklod-my-home-stage1.webp', 'RIFF'],
  ['world-audio/navigation.wav', 'assets/sounds/estate-premium/navigation.wav', 'RIFF'],
  ['world-audio/build_start.wav', 'assets/sounds/estate-premium/build_start.wav', 'RIFF'],
  ['world-audio/build_complete.wav', 'assets/sounds/estate-premium/build_complete.wav', 'RIFF'],
  ['world-audio/claim.wav', 'assets/sounds/estate-premium/claim.wav', 'RIFF'],
  ['world-audio/kingdom_ambience.wav', 'assets/sounds/buklod-kingdom-ambient-original.wav', 'RIFF'],
  ['world-audio/house_ambience.wav', 'assets/sounds/buklod-kingdom-cinematic-ambient.wav', 'RIFF'],
];
for (const [name, relative, magic] of originalWorldMedia) {
  const binary = readFileSync(path.join(root, relative));
  assert.ok(binary.length > 100 && binary.length < 1500000,
    'Invalid native world media size: ' + relative);
  assert.equal(binary.toString('ascii', 0, 4), magic,
    'Unexpected native world media format: ' + relative);
  entries.push({ name, bytes: binary });
}

const entryNames = new Set(entries.map(x => x.name));
assert.equal(ARENA_SFX_IDS.filter(id => entryNames.has('audio/sfx/'+id+'.wav')).length,70);
for (const name of ['project.godot', 'scenes/Arena.tscn', 'scripts/arena_root.gd',
  'scripts/arena_hud.gd', 'scripts/arena_simulation.gd',
  'scripts/arena_effects.gd', 'scripts/hero_animation.gd',
  'shaders/arena_impact.gdshader',
  'scripts/arena_library_skills.gd', 'scripts/arena_library_actors.gd',
  'data/catalog.json', 'scripts/arena_audio.gd', 'splash/buklod-green-b.png',
  'scenes/WorldPreview.tscn', 'scripts/world_preview.gd', 'tests/world_smoke.gd',
  'scenes/PremiumWorld3D.tscn', 'scripts/premium_world_3d.gd',
  ...originalWorldMedia.map(x => x[0])]) {
  assert.ok(entryNames.has(name), 'Missing Godot Arena pack resource: ' + name);
}
const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let crc = n;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  table[n] = crc >>> 0;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = table[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const parts = [];
const directory = [];
let offset = 0;
for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
  const name = Buffer.from(entry.name, 'utf8');
  const compressed = deflateRawSync(entry.bytes, { level: 9 });
  const crc = crc32(entry.bytes);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(entry.bytes.length, 22);
  header.writeUInt16LE(name.length, 26);
  parts.push(header, name, compressed);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(entry.bytes.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  directory.push(central, name);
  offset += header.length + name.length + compressed.length;
}
const dirBytes = Buffer.concat(directory);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(dirBytes.length, 12);
end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...parts, dirBytes, end]);
assert.ok(zip.length < 256 * 1024 * 1024, 'Godot pack exceeds verified native bridge bound');
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, zip);
const hash = createHash('sha256').update(zip).digest('hex');
console.log(JSON.stringify({ result: 'BUKLOD_GODOT_OFFLINE_PACK_BUILT', output,
  sha256: hash, bytes: zip.length, entries: entries.length, heroes: 13, pickups: 300,
  ranked: false, serverAccess: false, art: artCounts, kingdomItems:kingdomItemCount, sfxCues:70, offlineModes:4 }, null, 2));
