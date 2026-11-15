import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync(new URL('../src/components/BuklodNavSafeShell.tsx', import.meta.url), 'utf8');

test('Daily Bible and full Children Stories stay below Android system status bar', () => {
  for (const route of [
    "normalizedPath === '/bible'",
    "normalizedPath === '/bible/index'",
    "normalizedPath === '/bible/read'",
    "normalizedPath === '/children-stories'",
    "normalizedPath.startsWith('/children-stories/')",
  ]) assert.ok(shell.includes(route), 'Missing headerless route safe area: '+route);
  assert.match(shell, /const contentTopInset\s*=\s*immersiveIgpat[\s\S]*?reserveMyBuklodSystemInsets[\s\S]*?Math\.max\(insets\.top, 0\)/);
});
test('Keep status bar layouts for existing doors and radio; do not move public bottom nav', () => {
  assert.match(shell, /isMyBuklodDoorPath\(pathname\)/);
  assert.match(shell, /normalizedPath === '\/personal-home\/radio'/);
  assert.match(shell, /useBuklodPersistentNavOccupiedHeight\(\)/);
  assert.match(shell, /<BuklodPersistentBottomNav\s*\/>/);
  assert.match(shell, /paddingBottom: contentBottomInset/);
});
