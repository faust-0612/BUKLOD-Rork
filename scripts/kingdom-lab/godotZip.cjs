'use strict';
/** Self-contained STORE-format ZIP pack accepted as Godot --main-pack.
 * Text-only procedural game; no Android SDK, asset service or new npm package.
 * ZIP entries are fixed and sorted to prevent unrelated repository contents
 * from entering the separately signed lab APK. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const FILES = Object.freeze([
  'project.godot',
  'scenes/Main.tscn',
  'scripts/kingdom_data.gd',
  'scripts/world.gd',
]);

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let n = i;
    for (let j = 0; j < 8; j++) {
      n = (n & 1) ? (0xedb88320 ^ (n >>> 1)) : (n >>> 1);
    }
    table[i] = n >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function godotPack(rootDirectory) {
  const chunks = [];
  const directory = [];
  let offset = 0;
  for (const entry of FILES) {
    const fullPath = path.resolve(rootDirectory, entry);
    const base = path.resolve(rootDirectory) + path.sep;
    if (!fullPath.startsWith(base)) throw Error('Path escaped the Godot root');
    if (!fs.existsSync(fullPath)) throw Error('Required procedural game file missing: ' + entry);
    const body = fs.readFileSync(fullPath);
    const name = Buffer.from(entry, 'utf8');
    if (body.length > 1024 * 1024) throw Error('Unexpected large Godot source file: ' + entry);
    const crc = crc32(body);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // STORE, not deflate. Godot reads uncompressed resources.
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const dirLength = directory.reduce((n, chunk) => n + chunk.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(FILES.length, 8);
  eocd.writeUInt16LE(FILES.length, 10);
  eocd.writeUInt32LE(dirLength, 12);
  eocd.writeUInt32LE(offset, 16);
  const buffer = Buffer.concat([...chunks, ...directory, eocd]);
  return {
    buffer,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    entries: FILES,
  };
}
module.exports = { FILES, godotPack, crc32 };
