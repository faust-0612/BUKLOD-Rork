import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const BRANCH = 'feature/system-admin-all-characters-r1';
const SELF = 'scripts/character-admin-unlock-freeze-r1.mjs';
const MIGRATION = 'supabase/migrations/20260918210500_buklod_character_system_admin_unlock_all_r1.sql';
const EXPECTED_BLOB = 'd4ff9dbc0a9ad98c589b2e0461f099d4d142d080';
const failures = [];

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    ...options,
  }).trim();
}

console.log('BUKLOD CHARACTER ADMIN UNLOCK FREEZE R1');
console.log('=======================================');

const branch = git(['branch', '--show-current']);
if (branch !== BRANCH) {
  failures.push(`Expected ${BRANCH}; current branch is ${branch || '(unknown)'}.`);
}

const full = path.join(ROOT, MIGRATION);
if (!fs.existsSync(full)) {
  failures.push(`Missing frozen migration: ${MIGRATION}`);
} else {
  const actual = git(['hash-object', `--path=${MIGRATION}`, MIGRATION]).toLowerCase();
  if (actual !== EXPECTED_BLOB) {
    failures.push(`FROZEN ADMIN CHARACTER MIGRATION CHANGED: expected=${EXPECTED_BLOB} actual=${actual}`);
  }
  const dirty = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', MIGRATION], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  if (dirty.status !== 0) {
    failures.push(`Frozen migration has uncommitted changes: ${MIGRATION}`);
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
  const expected = new Set([MIGRATION, SELF]);
  for (const rel of changed) {
    if (!expected.has(rel)) failures.push(`Unexpected edit in admin-character lock branch: ${rel}`);
  }
  for (const rel of expected) {
    if (!changed.includes(rel)) failures.push(`Expected frozen branch file missing from diff: ${rel}`);
  }
} catch (error) {
  failures.push(`Could not verify branch diff: ${error instanceof Error ? error.message : String(error)}`);
}

for (const failure of failures) console.error(`FAIL: ${failure}`);
if (failures.length) {
  console.error(`\nADMIN CHARACTER UNLOCK FREEZE FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log('Frozen migration: exact');
console.log('ADMIN CHARACTER UNLOCK FREEZE PASSED.');
