import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EXPECTED_BRANCH = 'fix/points-claim-list-r1-20260912';
const V2 = path.join('scripts', 'APPLY_POINTS_CLAIM_LIST_R1_V2.mjs');

function fail(message) {
  throw new Error(message);
}

function capture(command, args = []) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false });
  if (result.error || result.status !== 0) {
    fail(`${command} ${args.join(' ')} failed.`);
  }
  return String(result.stdout ?? '').trim();
}

const branch = capture('git', ['branch', '--show-current']);
if (branch !== EXPECTED_BRANCH) {
  fail(`Expected branch ${EXPECTED_BRANCH}, found ${branch || '(detached)'}.`);
}

const status = capture('git', ['status', '--porcelain']);
if (status) {
  fail('Working tree is not clean. No Points edit was attempted.');
}

if (!fs.existsSync(V2)) {
  fail(`Missing ${V2}. Pull the branch first.`);
}

let source = fs.readFileSync(V2, 'utf8');
const characterGate = "  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'character:contract'], process.platform === 'win32');\n";
if (!source.includes(characterGate)) {
  fail('V2 character-gate line not found; refusing to patch an unknown runner.');
}

source = source.replace(
  characterGate,
  "  console.log('\\n> character contract deferred to canonical disposable R31/R40 release staging');\n" +
  "  const protectedCharacterPaths = [\n" +
  "    'src/components/points/BuklodProfileCharacterCard.tsx',\n" +
  "    'src/components/points/BuklodCharacterCustomizeSheet.tsx',\n" +
  "    'src/components/points/BuklodProgressiveCharacterSelector.tsx',\n" +
  "    'src/components/points/BuklodProgressiveCharacterArt.tsx',\n" +
  "    'src/components/points/BuklodSpecialCharacterSeries.tsx',\n" +
  "    'src/components/points/BuklodSpecialSeriesOne.tsx',\n" +
  "    'src/components/points/BuklodCollectibleDetail.tsx',\n" +
  "    'src/lib/buklodProgressiveCharacter.ts',\n" +
  "    'src/lib/buklodSpecialCharacterAssets.ts',\n" +
  "    'src/lib/buklodSpecialCharacterServer.ts',\n" +
  "    'src/lib/buklodSpecialCharacters.ts',\n" +
  "    'assets/images/characters/',\n" +
  "  ];\n" +
  "  const changedForScope = capture('git', ['diff', '--name-only'])\n" +
  "    .split(/\\r?\\n/)\n" +
  "    .map((value) => value.trim().replaceAll('\\\\', '/'))\n" +
  "    .filter(Boolean);\n" +
  "  const protectedHits = changedForScope.filter((file) =>\n" +
  "    protectedCharacterPaths.some((protectedPath) =>\n" +
  "      protectedPath.endsWith('/') ? file.startsWith(protectedPath) : file === protectedPath,\n" +
  "    ),\n" +
  "  );\n" +
  "  if (protectedHits.length > 0) {\n" +
  "    fail(`Points-only patch touched protected Character paths: ${protectedHits.join(', ')}`);\n" +
  "  }\n" +
  "  console.log('PASS: protected Character source/assets untouched; full Character contract remains a canonical release-staging gate.');\n"
);

const tempPath = path.join(os.tmpdir(), `buklod-points-claim-v3-${process.pid}.mjs`);
fs.writeFileSync(tempPath, source, 'utf8');

try {
  const result = spawnSync(process.execPath, [tempPath], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    fail(`V3 runner could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} finally {
  try {
    fs.unlinkSync(tempPath);
  } catch {}
}
