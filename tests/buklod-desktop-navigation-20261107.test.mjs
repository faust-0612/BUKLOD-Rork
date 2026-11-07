import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const shell = read('src/components/BuklodPublicDesktopDashboard.tsx');
const route = read('src/components/BuklodNavSafeShell.web.tsx');
const tabs = read('src/app/(tabs)/_layout.tsx');
const policy = await import('data:text/javascript,' +
  encodeURIComponent(stripTypeScriptTypes(read('src/lib/buklodWebResponsivePolicy.ts'))));

test('navigation uses left rail on desktop without mounting mobile bottom nav', () => {
  assert.match(route, /if \(shouldUseBuklodPublicDesktopShell\(pathname, width\)\)/);
  assert.match(route, /<BuklodPublicDesktopDashboard>/);
  assert.match(route, /<BuklodMobileWebShell>/);
  assert.match(shell, /LEFT_NAV\.map/);
  assert.doesNotMatch(shell, /BuklodPersistentBottomNav/);
  assert.match(tabs, /!desktopWebShell \? <SwipeDashboardHeader \/>/);
});

test('navigation isolates mobile, scoped, media and authentication routes', () => {
  const check = policy.shouldUseBuklodPublicDesktopShell;
  assert.equal(check('/hub', 1199), false);
  assert.equal(check('/hub', 1200), true);
  assert.equal(check('/messages', 1920), true);
  assert.equal(check('/scope', 1920), false);
  assert.equal(check('/scope/my-cluster', 1920), false);
  assert.equal(check('/login', 1920), false);
  assert.equal(check('/reels', 1920), false);
  assert.equal(check('/connect/personal/new', 1920), false);
});

test('navigation preserves scroll boundaries with a single routed center', () => {
  assert.match(shell, /styles\.leftRail/);
  assert.match(shell, /styles\.center/);
  assert.match(shell, /styles\.rightRail/);
  assert.match(shell, /maxWidth: 1590/);
  assert.match(shell, /ScrollView style=\{\[styles\.leftRail/);
  assert.match(shell, /ScrollView style=\{\[styles\.rightRail/);
  assert.equal((shell.match(/\{children\}/g) ?? []).length, 2); // authenticated and bootstrap shells
  assert.doesNotMatch(shell, /position: 'fixed'/);
});
