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

test('Create Post from desktop Home opens the existing collapsed Wall composer', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  assert.match(wall, /Desktop Home -> Create Post:[\s\S]*?setCommunityComposerOpen\(true\)/);
  assert.match(wall, /focusCommunityComposerRef\.current = true/);
});

test('account switch masks old Connect preview on the first render', () => {
  assert.match(shell, /connectOwnerId === userId \? threads : \[\]/);
  assert.match(shell, /connectOwnerId === userId \? contacts : \[\]/);
  assert.match(shell, /<Contribution key=\{userId\} \/>/);
  assert.match(shell, /const sequence = \+\+requestId\.current/);
});

test('desktop detail routes never mount the mobile bottom nav pane', () => {
  const mobileShell = read('src/components/BuklodMobileWebShell.tsx');
  assert.match(mobileShell, /const desktopDetail = width >= BUKLOD_DESKTOP_DASHBOARD_MIN_WIDTH && eligibleForGlobalNav/);
  assert.match(mobileShell, /const showGlobalNav = eligibleForGlobalNav && !desktopDetail/);
  assert.match(mobileShell, /desktopDetail && styles\.desktopDetail/);
  assert.match(mobileShell, /maxWidth: 1190/);
});


test('desktop rail widths prioritize the routed content at all supported sizes', () => {
  const rails = policy.resolveBuklodDesktopRailWidths;
  assert.deepEqual(rails(1200), { left: 198, right: 270 });
  assert.deepEqual(rails(1399), { left: 198, right: 270 });
  assert.deepEqual(rails(1400), { left: 240, right: 318 });
  assert.deepEqual(rails(1920), { left: 240, right: 318 });
  for (const width of [1200, 1280, 1400, 1590, 1920]) {
    const frame = Math.min(width, 1590);
    const { left, right } = rails(width);
    // 24px frame padding and 24px inter-column gaps.
    assert.ok(frame - left - right - 48 >= 640, width + ' must keep a readable center');
  }
  const source = read('src/components/BuklodPublicDesktopDashboard.tsx');
  assert.match(source, /flexGrow: 0, flexShrink: 0/);
  assert.match(source, /width: railWidths.left, minWidth: railWidths.left/);
  assert.match(source, /width: railWidths.right, minWidth: railWidths.right/);
  assert.match(source, /flexGrow: 1, flexShrink: 1/);
});

test('top bar renders the approved BUKLOD image once without duplicate wordmark', () => {
  const main = read('src/components/BuklodPublicDesktopDashboard.tsx');
  const scoped = read('src/components/BuklodDesktopWebShell.tsx');
  for (const source of [main, scoped]) {
    assert.match(source, /source=\{require\('\.\.\/\.\.\/assets\/release\/buklod-main-canonical\.png'\)\}/);
    assert.doesNotMatch(source, /<Text style=\{\[styles\.brandText/);
  }
  assert.match(main, /brandLogo: \{ width: 66, height: 66/);
});


test('desktop Connect side dock is contextual, not a forced route', () => {
  const shell = read('src/components/BuklodPublicDesktopDashboard.tsx');
  const inbox = read('src/app/(tabs)/messages.tsx');
  const dock = read('src/lib/buklodDesktopContextDock.ts');
  assert.match(shell, /registerBuklodDesktopDockOpener/);
  assert.match(shell, /<BuklodConnectThread/);
  assert.match(shell, /onBackOverride=\{\(\) => setDockRequest\(null\)\}/);
  assert.match(shell, /position: 'absolute', top: 0, right: 0, bottom: 0/);
  assert.match(shell, /Expand conversation to full screen/);
  assert.match(shell, /Close conversation panel/);
  assert.match(shell, /dockRequest\?\.userId === userId/);
  assert.match(inbox, /if \(tryOpenBuklodDesktopDock\(\{/);
  assert.match(dock, /return false/);
  assert.match(dock, /activeDesktopOpener = null/);
});
