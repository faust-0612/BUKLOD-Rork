#!/usr/bin/env node
// Global Stability change scope guard: compare against the selected base ref.
// Explicitly fail closed for all source modifications until the allowlist is reviewed.
import { execFileSync } from 'node:child_process';
const base = process.env.BUKLOD_SCOPE_BASE_REF;
if (!base) {
  console.error('SCOPE HOLD: set BUKLOD_SCOPE_BASE_REF to verified production baseline ref.');
  process.exit(2);
}
let files;
try {
  files = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMRT', base, 'HEAD', '--'], {encoding:'utf8'}).trim().split('\n').filter(Boolean);
} catch {
  console.error('SCOPE HOLD: baseline ref unavailable. No fallback to main.');
  process.exit(2);
}
const allowed = [
  /^docs\/engineering\/global-stability-scope-lock-r1\.md$/,
  /^scripts\/global-stability-scope-guard\.mjs$/,
  /^src\/lib\/supabase\.ts$/,
  /^src\/lib\/auth\//,
  /^src\/lib\/network\//,
  /^src\/lib\/recovery\//,
  /^scripts\/global-stability-[\w-]+\.mjs$/,
];
const blocked = files.filter(file => !allowed.some(rule => rule.test(file)));
if (blocked.length) {
  console.error('SCOPE BLOCK: unrelated files changed:\n' + blocked.join('\n'));
  process.exit(1);
}
console.log('GLOBAL STABILITY SCOPE PASS:', files.length, 'allowlisted files; baseline:', base);
