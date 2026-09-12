import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EXPECTED_BRANCH = 'fix/points-claim-list-r1-20260912';
const TARGET = path.join('src', 'app', 'points', 'index.tsx');
const V1 = path.join('scripts', 'APPLY_POINTS_CLAIM_LIST_R1.mjs');

function fail(message) {
  throw new Error(message);
}

function capture(command, args = [], shell = false) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell });
  if (result.error || result.status !== 0) {
    fail(`${command} ${args.join(' ')} failed.`);
  }
  return String(result.stdout ?? '').trim();
}

function run(command, args = [], shell = false) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited with code ${result.status}.`);
}

function loadPatchFunction(v1Text) {
  const helperStart = v1Text.indexOf('function replaceOnce(');
  const executionStart = v1Text.indexOf('\nlet original = null;');
  if (helperStart < 0 || executionStart < 0 || executionStart <= helperStart) {
    fail('Could not isolate guarded claim-list patch logic.');
  }

  const isolated = v1Text.slice(helperStart, executionStart);
  const factory = new Function('fail', `${isolated}\nreturn patch;`);
  const patch = factory(fail);
  if (typeof patch !== 'function') fail('Guarded claim-list patch function was not loaded.');
  return patch;
}

let original = null;
let wrote = false;
let committed = false;

try {
  const root = process.cwd();
  if (!fs.existsSync(path.join(root, 'package.json'))) {
    fail('Run this script from the BUKLOD-MAIN repository root.');
  }

  const branch = capture('git', ['branch', '--show-current']);
  if (branch !== EXPECTED_BRANCH) {
    fail(`Expected branch ${EXPECTED_BRANCH}, found ${branch || '(detached)'}.`);
  }

  const status = capture('git', ['status', '--porcelain']);
  if (status) {
    fail('Working tree is not clean. No Points edit was attempted.');
  }

  const targetPath = path.join(root, TARGET);
  const v1Path = path.join(root, V1);
  if (!fs.existsSync(targetPath)) fail(`Points screen missing: ${TARGET}`);
  if (!fs.existsSync(v1Path)) fail(`Guarded claim-list patcher missing: ${V1}`);

  original = fs.readFileSync(targetPath, 'utf8');
  const originalUsesCrLf = original.includes('\r\n');
  const normalizedSource = original.replace(/\r\n/g, '\n');
  const v1Text = fs.readFileSync(v1Path, 'utf8').replace(/\r\n/g, '\n');
  const patch = loadPatchFunction(v1Text);
  const patchedLf = patch(normalizedSource);

  if (patchedLf === normalizedSource) {
    fail('Points claim-list patch produced no change.');
  }

  const patched = originalUsesCrLf
    ? patchedLf.replace(/\n/g, '\r\n')
    : patchedLf;

  fs.writeFileSync(targetPath, patched, 'utf8');
  wrote = true;

  const changed = capture('git', ['diff', '--name-only'])
    .split(/\r?\n/)
    .map((value) => value.trim().replaceAll('\\', '/'))
    .filter(Boolean);

  if (changed.length !== 1 || changed[0] !== 'src/app/points/index.tsx') {
    fail(`Scope violation. Expected only src/app/points/index.tsx, found: ${changed.join(', ') || '(none)'}`);
  }

  console.log('\nSCOPE GATE: PASS - only src/app/points/index.tsx changed.');

  run('git', ['diff', '--check']);
  run(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsc', '--noEmit'],
    process.platform === 'win32',
  );

  // Character R31/R40 contract intentionally does NOT run in the raw source
  // branch. Canonical Character source/assets are supplied only by the approved
  // disposable recovery overlay during the canonical release-staging flow.
  console.log('\nCHARACTER GATE: DEFERRED to canonical R31/R40 release staging (expected).');

  run(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'game:contract'],
    process.platform === 'win32',
  );

  const finalChanged = capture('git', ['diff', '--name-only'])
    .split(/\r?\n/)
    .map((value) => value.trim().replaceAll('\\', '/'))
    .filter(Boolean);

  if (finalChanged.length !== 1 || finalChanged[0] !== 'src/app/points/index.tsx') {
    fail(`Final scope violation: ${finalChanged.join(', ') || '(none)'}`);
  }

  run('git', ['add', '--', TARGET]);
  run('git', ['commit', '-m', 'fix(points): show claimable activity lists by group']);
  committed = true;
  run('git', ['push', '-u', 'origin', EXPECTED_BRANCH]);

  console.log('\nPASS: Points claim list R1 V4 committed and pushed.');
  console.log('- Runtime diff: src/app/points/index.tsx only.');
  console.log('- Claimable completed activities are listed by group.');
  console.log('- Every group keeps its own CLAIM ALL action.');
  console.log('- Generic Retry card flow is removed from /points.');
  console.log('- TypeScript PASS.');
  console.log('- Kingdom contract PASS.');
  console.log('- Character contract deferred to canonical R31/R40 release staging.');
  console.log('- No backend migration.');
  console.log('- No native files/config/dependencies.');
  console.log('- No web deploy.');
  console.log('- No OTA.');
} catch (error) {
  console.error(`\nFAIL: ${error?.message ?? error}`);

  if (wrote && !committed && original != null) {
    try {
      fs.writeFileSync(TARGET, original, 'utf8');
      spawnSync('git', ['restore', '--staged', '--', TARGET], {
        stdio: 'ignore',
        shell: false,
      });
      console.error('ROLLBACK: restored Points screen and staging index.');
    } catch (restoreError) {
      console.error(`ROLLBACK WARNING: ${restoreError?.message ?? restoreError}`);
    }
  }

  process.exit(1);
}
