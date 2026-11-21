import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const importer = join(ROOT, 'scripts/ingest-buklod-visual-baseline.mjs');
const route = readFileSync(join(ROOT, 'src/app/games/empire-arena.tsx'), 'utf8');
const index = readFileSync(join(ROOT, 'src/features/season2/genesis/GenesisKingdomPortal.tsx'), 'utf8');
const baseline = readFileSync(join(ROOT, 'src/features/games/empire/arenaVisualBaseline.ts'), 'utf8');
const engine = readFileSync(join(ROOT, 'experiments/empire-arena-v2/arena-v2-engine.mjs'), 'utf8');

test('Arena is an Expo Router screen inside the ONE BUKLOD app, using original offline engine', () => {
  assert.match(index, /router\.push\('\/games\/empire-arena'/);
  assert.match(route, /isGenesisPreviewBuild\(\) \? <EmpireArenaInApp \/> : <Redirect href="\/games"\/>/);
  assert.match(route, /createPractice/);
  assert.match(route, /command\(game, 'A0'/);
  assert.match(route, /tick\(state\)/);
  assert.match(route, /expo-screen-orientation/);
  assert.match(route, /OrientationLock\.LANDSCAPE/);
  assert.match(route, /ARENA_GENERATED_ART/);
  assert.match(engine, /OFFLINE PRACTICE/);
});

test('Never credit production wallets or ranked results from native offline practice', () => {
  assert.doesNotMatch(route, /supabase\.|\.rpc\(|wallet|awardBp|awardDiamond|settleWorldTrade/i);
  assert.match(route, /diamonds:\s*0, verifiedItems:\s*\[\]/);
  assert.match(route, /No BP, diamonds, XP, cash, or ranked effects/);
});

test('All thirteen canonical character portraits are available to the in-app Arena', () => {
  const heroes = ['phan', 'quin', 'van', 'christian', 'lhen', 'ace', 'ellusur', 'jawo', 'mitch', 'niel', 'angel', 'vhen', 'trudice'];
  for (const id of heroes) assert.match(baseline, new RegExp('^\\s*' + id + ': require\\(', 'm'));
});

test('Generated artwork is committed to an immutable SHA-addressed baseline, no manual image library', () => {
  const work = mkdtempSync(join(tmpdir(), 'buklod-arena-art-'));
  try {
    const source = join(work, 'sample.png');
    // One-pixel valid PNG. Only used to prove deterministic ingestion, not as a game asset.
    writeFileSync(source, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/A+UAAAAASUVORK5CYII=', 'base64'));
    const args = ['--root', work, '--source', source, '--kind', 'scene', '--id', 'genesis_rift'];
    const run = () => spawnSync(process.execPath, [importer, ...args], { encoding: 'utf8' });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const receipt = JSON.parse(first.stdout);
    assert.equal(receipt.registered, 'scene:genesis_rift');
    assert.match(receipt.file, /genesis_rift-[a-f0-9]{12}\.png$/);
    const manifestPath = join(work, 'assets/season2/arena/generated-manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.assets.length, 1);
    assert.equal(manifest.assets[0].sha256, receipt.sha256);
    const nativeAssetRegistry = readFileSync(join(work, 'src/features/games/empire/arenaGeneratedAssets.ts'), 'utf8');
    assert.ok(nativeAssetRegistry.includes("require('../../../../" + receipt.file + "')"));
    const again = run();
    assert.equal(again.status, 0, again.stderr);
    assert.equal(JSON.parse(readFileSync(manifestPath, 'utf8')).assets.length, 1);
    const unsafe = spawnSync(process.execPath, [importer, '--root', work, '--source', source, '--kind', 'scene', '--id', '../escape'], { encoding: 'utf8' });
    assert.notEqual(unsafe.status, 0);
    const wrongType = spawnSync(process.execPath, [importer, '--root', work, '--source', source, '--kind', 'hero', '--id', 'unknown-character'], { encoding: 'utf8' });
    assert.notEqual(wrongType.status, 0);
    const invalid = join(work, 'not-an-image.png');
    writeFileSync(invalid, Buffer.alloc(64, 0));
    const rejected = spawnSync(process.execPath, [importer, '--root', work, '--source', invalid, '--kind', 'scene', '--id', 'aurora_foundry'], { encoding: 'utf8' });
    assert.notEqual(rejected.status, 0);
    assert.equal(JSON.parse(readFileSync(manifestPath, 'utf8')).assets.length, 1);
  } finally { rmSync(work, { recursive: true, force: true }); }
});
