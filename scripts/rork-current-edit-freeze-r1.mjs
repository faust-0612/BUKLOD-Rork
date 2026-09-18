import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SELF = 'scripts/rork-current-edit-freeze-r1.mjs';
const BRANCH = 'feature/rork-home-kingdom-native-integration-r1';
const LOCK_MODE = 'git hash-object';
const failures = [];

const EXPECTED_BLOBS = {
  ".gitignore": "14a3f512ace15de4970d7f45e1dd34cbf3efc271",
  "package.json": "f1f6bed4b3de7c1e48de21f9053c90b3775c73d3",
  "scripts/buklod-city-release-gate.mjs": "a52f660fc6206aec19d3a18e9ccbd6b27a0c58b8",
  "scripts/character-release-contract.mjs": "d375b42b1ceffa2bed3d98585f7378fd61ab385c",
  "scripts/game-kingdom-release-contract.mjs": "567ca398484db57e40bdd73d57683f3c6b85e6a3",
  "scripts/rork-integration-qa.ps1": "8b8bf2dbcfe6e41c7dd6bd3e336fced9d233c1de",
  "scripts/rork-integration-static-gate.mjs": "77933b4758a76abfcd18bb4bdc553cf347190119",
  "scripts/rork-media-contract-test.mjs": "272fe5b8a31ba339aab04f0c8b03c860774575dc",
  "src/components/home/BuklodPersonalHomeE2E.tsx": "bb517eb6abfc198e204e95daa6b50280176bc40e",
  "src/components/home/BuklodRorkHomeAtlas.tsx": "190e5d50685c00f7b295b64826ea64212d9de823",
  "src/components/points/BuklodCharacterMotion.tsx": "81e37a4d4702a26882c85693a718183172cef724",
  "src/components/points/BuklodSpecialCharacterLayerStage.tsx": "363c7d1d73d2325a562aa317f002d7786198e81f",
  "src/components/points/BuklodSpecialCharacterSeries.tsx": "36426e47eec76b21697b07e1eebd5029d2932690",
  "src/features/games/kingdom/BuklodKingdomMap.tsx": "88a4b1b4a70fc4acd59579419058b47f21be2554",
  "src/features/games/runtime/BuklodGameBackdrop.tsx": "32a43e7db7ba8b21ce180c8b7a901865d552562c",
  "src/features/games/runtime/BuklodGameCharacterCompanion.tsx": "a34ffabb5af54c5c6a7986f76da7e274fc4b7b3f",
  "src/features/games/runtime/BuklodGameFeedback.native.ts": "bb3d8e9f5ba28e031e49601f4b8989b20db95038",
  "src/features/games/runtime/BuklodGameFeedback.web.ts": "07cc1691058b21ae6f233b6fcf66a2ed1974e796",
  "src/features/games/runtime/BuklodGameStage.native.tsx": "d61bb9cac83402c9f586ea53b4e40472f2c7d342",
  "src/features/games/runtime/BuklodGameStage.web.tsx": "d163a1dd7893c6aad519491fc9eb39e0b8e8fa68",
  "src/features/games/runtime/__tests__/rorkMedia.test.ts": "9a82f4f6df5fb662836159d8a2ce4bbddc03d546",
  "src/features/games/runtime/characterMotionBus.ts": "c1c5731f75b597285ae45a24a765ca6db0d84035",
  "src/features/games/runtime/rorkAudio.ts": "9340355bd9a94eba8b8e048aa1dc1e74373a9421",
  "src/features/games/runtime/rorkMedia.ts": "164013dc10f2e2e1d701271576dd57253ccaa5e8",
};

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    ...options,
  }).trim();
}

console.log('BUKLOD CURRENT EDIT FREEZE R1');
console.log('=============================');

let branch = '';
try {
  branch = git(['branch', '--show-current']);
} catch (error) {
  failures.push(`Could not resolve current branch: ${error instanceof Error ? error.message : String(error)}`);
}

if (branch !== BRANCH) {
  failures.push(`Freeze gate must run on ${BRANCH}; current branch is ${branch || '(detached/unknown)'}.`);
}

for (const [rel, expected] of Object.entries(EXPECTED_BLOBS)) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Frozen file is missing: ${rel}`);
    continue;
  }

  try {
    const actual = git(['hash-object', `--path=${rel}`, rel]).toLowerCase();
    if (actual !== expected.toLowerCase()) {
      failures.push(`FROZEN EDIT CHANGED: ${rel} expected=${expected} actual=${actual}`);
    }
  } catch (error) {
    failures.push(`Could not compute frozen blob for ${rel}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const dirty = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', rel], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  if (dirty.status !== 0) {
    failures.push(`Frozen file has uncommitted changes: ${rel}`);
  }
}

try {
  let base = 'main';
  try {
    execFileSync('git', ['rev-parse', '--verify', 'main'], { cwd: ROOT, stdio: 'ignore' });
  } catch {
    base = 'origin/main';
  }

  const changed = git(['diff', '--name-only', `${base}...HEAD`])
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  const expectedChanged = new Set([...Object.keys(EXPECTED_BLOBS), SELF]);

  for (const rel of changed) {
    if (!expectedChanged.has(rel)) {
      failures.push(`Unexpected edit outside frozen snapshot: ${rel}`);
    }
  }
  for (const rel of expectedChanged) {
    if (!changed.includes(rel)) {
      failures.push(`Frozen snapshot file is no longer part of the integration diff: ${rel}`);
    }
  }
} catch (error) {
  failures.push(`Could not verify frozen branch diff: ${error instanceof Error ? error.message : String(error)}`);
}

for (const failure of failures) console.error(`FAIL: ${failure}`);
if (failures.length) {
  console.error(`\nCURRENT EDIT FREEZE FAILED with ${failures.length} blocker(s).`);
  console.error('Do not overwrite or re-baseline without an explicit reviewed change.');
  process.exit(1);
}

console.log(`Freeze mode: ${LOCK_MODE}`);
console.log(`Frozen files: ${Object.keys(EXPECTED_BLOBS).length}`);
console.log('CURRENT EDIT FREEZE PASSED.');
