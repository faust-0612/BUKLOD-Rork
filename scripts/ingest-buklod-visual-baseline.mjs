#!/usr/bin/env node
/**
 * BUKLOD Season 2 asset-first visual baseline ingestion.
 * Converts LOCAL generated image bytes into repo-owned versioned native assets and
 * regenerates a Metro-resolvable static require() registry.
 * No manual library saving or externally hosted image required.
 *
 * Usage: node scripts/ingest-buklod-visual-baseline.mjs --source /tmp/approved.webp --kind scene --id genesis_rift
 * Other kinds: hero, sprite, building, effect, ui.
 *
 * This is a DEV tool, not an in-app upload endpoint. It never writes BP/DB data.
 */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VALID_KINDS = new Set(['scene', 'hero', 'sprite', 'fullbody', 'building', 'effect', 'ui']);
const SCENES = new Set(['genesis_rift', 'aurora_foundry', 'verdant_fracture']);
const HEROES = new Set(['phan', 'quin', 'van', 'christian', 'lhen', 'ace', 'ellusur', 'jawo', 'mitch', 'niel', 'angel', 'vhen', 'trudice']);
const MAX_BYTES = 28 * 1024 * 1024;
const MANIFEST = 'assets/season2/arena/generated-manifest.json';
const REGISTRY = 'src/features/games/empire/arenaGeneratedAssets.ts';

function argsOf(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!/^--(source|kind|id|root)$/.test(k) || !argv[i + 1]) throw new Error('Expected --source, --kind and --id. --root is test-only.');
    args[k.slice(2)] = argv[++i];
  }
  if (!args.source || !args.kind || !args.id) throw new Error('Missing source, kind, or id');
  return args;
}

function imageType(data) {
  const hex = data.subarray(0, 12).toString('hex');
  if (hex.startsWith('89504e470d0a1a0a')) {
    if (data.length < 24 || !data.readUInt32BE(16) || !data.readUInt32BE(20)) throw new Error('Invalid PNG dimensions');
    return 'png';
  }
  if (hex.startsWith('ffd8ff') && data.subarray(-2).toString('hex') === 'ffd9') return 'jpg';
  if (data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return 'webp';
  throw new Error('Only valid PNG, JPEG or WEBP artwork is accepted');
}

function atomicWrite(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = path + '.new-' + process.pid;
  writeFileSync(temp, content);
  renameSync(temp, path);
}

function ensureRepoPath(root, relative) {
  const absolute = resolve(root, relative);
  if (!absolute.startsWith(root + sep)) throw new Error('Invalid destination path');
  return absolute;
}

function main() {
  const args = argsOf(process.argv.slice(2));
  const kind = String(args.kind);
  const id = String(args.id);
  if (!VALID_KINDS.has(kind) || !/^[a-z][a-z0-9_-]{1,60}$/.test(id)) throw new Error('Invalid kind or slug');
  if (kind === 'scene' && !SCENES.has(id)) throw new Error('Unknown official Arena battlefield');
  if (kind === 'hero' && !HEROES.has(id)) throw new Error('Unknown canonical BUKLOD character');
  if (kind === 'fullbody' && !/^(phan|quin|van|christian|lhen|ace|ellusur|jawo|mitch|niel|angel|vhen|trudice)_(idle|walk|attack|skill)$/.test(id)) throw new Error('Unknown character full-body pose');
  const root = resolve(args.root || DEFAULT_ROOT);
  const src = resolve(args.source);
  const st = lstatSync(src);
  if (!st.isFile() || st.isSymbolicLink() || st.size < 24 || st.size > MAX_BYTES) throw new Error('Unsafe image file or size');
  const data = readFileSync(src);
  const ext = imageType(data);
  const sha256 = createHash('sha256').update(data).digest('hex');
  const relative = `assets/season2/arena/generated/${kind}/${id}-${sha256.slice(0,12)}.${ext}`;
  const dest = ensureRepoPath(root, relative);
  mkdirSync(dirname(dest), { recursive: true });
  if (!existsSync(dest)) atomicWrite(dest, data);
  else if (createHash('sha256').update(readFileSync(dest)).digest('hex') !== sha256) throw new Error('Checksum conflict');

  const manifestPath = ensureRepoPath(root, MANIFEST);
  const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { schema: 1, assets: [] };
  if (old.schema !== 1 || !Array.isArray(old.assets)) throw new Error('Manifest schema mismatch');
  const key = `${kind}:${id}`;
  const entries = old.assets.filter(e => e.key !== key);
  entries.push({ key, kind, id, file: relative, sha256, bytes: data.length, status: 'dev-baseline' });
  entries.sort((a, b) => a.key.localeCompare(b.key));
  // Never let unexpected manually-edited paths enter generated require() expressions.
  for (const e of entries) {
    if (!VALID_KINDS.has(e.kind) || !/^[a-z][a-z0-9_-]{1,60}$/.test(e.id) ||
      e.key !== `${e.kind}:${e.id}` ||
      !new RegExp(`^assets/season2/arena/generated/${e.kind}/${e.id}-[a-f0-9]{12}\\.(png|jpg|webp)$`).test(e.file)) {
      throw new Error('Unsafe manifest entry');
    }
  }
  const registry = [
    '/** GENERATED by scripts/ingest-buklod-visual-baseline.mjs; do not edit. */',
    "import type { ImageSourcePropType } from 'react-native';",
    'export const ARENA_GENERATED_ART: Record<string, ImageSourcePropType> = {',
    ...entries.map(e => `  '${e.key}': require('../../../../${e.file}'),`),
    '};', '',
  ].join('\\n').replaceAll('\\n', '\n');
  atomicWrite(manifestPath, JSON.stringify({ schema: 1, assets: entries }, null, 2) + '\n');
  atomicWrite(ensureRepoPath(root, REGISTRY), registry);
  process.stdout.write(JSON.stringify({ registered: key, file: relative, sha256, bytes: data.length, registry: REGISTRY }) + '\n');
}

try { main(); } catch (error) { process.stderr.write(String(error instanceof Error ? error.message : error) + '\n'); process.exitCode = 1; }
