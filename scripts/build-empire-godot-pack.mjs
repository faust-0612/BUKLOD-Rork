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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.join(root, 'godot/empire-arena');
const output = process.argv.find(x => x.startsWith('--out='))?.slice(6) ||
  path.join(root, 'build/empire-arena/empire-arena.zip');
const catalog = { schema: 1, arena: 'OFFLINE_PRACTICE', engine: 'Godot 4.7.2',
  heroes: HEROES, starter: STARTER_HERO_KITS, modes: MODES, maps: ARENA_MAPS,
  costs: COSTS, buildings: BUILD_COSTS, buffs: BUFFS, pickups: ARENA_PICKUP_CATALOG };
assert.equal(Object.keys(catalog.heroes).length, 13);
assert.equal(Object.keys(catalog.maps).length, 3);
assert.equal(catalog.pickups.length, 300);
assert.equal(new Set(catalog.pickups.map(x => x.id)).size, 300);
assert.ok(catalog.pickups.every(x => !x.transferable && x.temporary));
assert.ok(output.endsWith('.zip'), 'Godot --main-pack requires a .zip archive');
const data = Buffer.from(JSON.stringify(catalog), 'utf8');
const entries = [{ name: 'data/catalog.json', bytes: data }];
function collect(dir, prefix = '') {
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '.godot' || name === 'data') continue;
      collect(full, prefix + name + '/');
      continue;
    }
    if (!/\.gd$|\.tscn$|^project\.godot$/.test(name)) continue;
    entries.push({ name: prefix + name, bytes: readFileSync(full) });
  }
}
collect(project);
const entryNames = new Set(entries.map(x => x.name));
for (const name of ['project.godot', 'scenes/Arena.tscn', 'scripts/arena_root.gd',
  'scripts/arena_hud.gd', 'scripts/arena_simulation.gd', 'data/catalog.json']) {
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
assert.ok(zip.length < 8 * 1024 * 1024, 'Procedural Godot pack unexpectedly large');
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, zip);
const hash = createHash('sha256').update(zip).digest('hex');
console.log(JSON.stringify({ result: 'BUKLOD_GODOT_OFFLINE_PACK_BUILT', output,
  sha256: hash, bytes: zip.length, entries: entries.length, heroes: 13, pickups: 300,
  ranked: false, serverAccess: false }, null, 2));
