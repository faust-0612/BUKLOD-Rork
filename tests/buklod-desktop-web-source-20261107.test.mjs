import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const read = relative =>
  readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const policySource = read('src/lib/buklodWebResponsivePolicy.ts');
const policy = await import(
  'data:text/javascript,' +
  encodeURIComponent(stripTypeScriptTypes(policySource))
);

test('scope shell: 1100px threshold, never hijack public routes', () => {
  const p = policy.shouldUseBuklodDesktopScopedShell;
  assert.equal(p('/scope', 1100, 1100), true);
  assert.equal(p('/scope/cluster/home', 1600, 1100), true);
  assert.equal(p('/scope', 1099, 1100), false);
  assert.equal(p('/hub', 1600, 1100), false);
  assert.equal(p('/me', 1600, 1100), false);
  assert.equal(p('/scope', Number.NaN, 1100), false);
});

test('public centered canvas: Home/Wall only at >=1200px', () => {
  const p = policy.shouldUseBuklodDesktopPublicFeed;
  assert.equal(p('/hub', 1200), true);
  assert.equal(p('/buklod', 1920), true);
  assert.equal(p('/buklod/post', 1200), true);
  assert.equal(p('/hub', 1199), false);
  assert.equal(p('/messages', 1920), false);
  assert.equal(p('/scope', 1920), true);
  assert.equal(p('/me', 1920), false);
  assert.equal(p('/login', 1920), false);
  assert.equal(p('/buklod', Number.NaN), false);
  assert.equal(policy.BUKLOD_DESKTOP_PUBLIC_FEED_MAX_WIDTH, 940);
});

test('web shell retains minimal public route ownership and release anchor', () => {
  const src = read('src/components/BuklodNavSafeShell.web.tsx');
  assert.match(src, /BUKLOD_DESKTOP_WEB_MIN_WIDTH = 1100/);
  assert.match(src, /shouldUseBuklodDesktopScopedShell\(/);
  assert.match(src, /if \(!useDesktopScopedShell\)/);
  assert.match(src, /BuklodMobileWebShell/);
  assert.match(src, /BuklodDesktopWebShell/);
  assert.match(src, /BuklodFocusAppAdStrip/);
  assert.match(src, /useBuklodWebSessionSelfHeal/);
});

test('public desktop feed has one workspace and zero phantom sidebars', () => {
  const src = read('src/app/(tabs)/_layout.tsx');
  assert.match(src, /Platform\.OS === 'web' &&\s*shouldUseBuklodDesktopPublicFeed\(/);
  assert.match(src, /maxWidth: BUKLOD_DESKTOP_PUBLIC_FEED_MAX_WIDTH/);
  assert.equal((src.match(/\{workspaceStack\}/g) ?? []).length, 1);
  assert.doesNotMatch(src, /desktop-left-rail|desktop-right-rail/);
  assert.match(src, /<BuklodDashboardContextBar \/>/);
  assert.match(src, /<SwipeDashboardHeader \/>/);
  assert.match(src, /BUKLOD_LEGACY_VERIFICATION_REMOVAL_R22/);
});


test('desktop public dashboard routes preserve phone and scoped shell boundaries', () => {
  const p = policy.shouldUseBuklodPublicDesktopShell;
  assert.equal(p('/hub', 1200), true);
  assert.equal(p('/buklod', 1600), true);
  assert.equal(p('/messages', 1600), true);
  assert.equal(p('/me', 1600), true);
  assert.equal(p('/clusters', 1600), true);
  assert.equal(p('/bible/read', 1600), true);
  assert.equal(p('/scope', 1600), true);
  assert.equal(p('/login', 1600), false);
  assert.equal(p('/connect/personal/new', 1600), false);
  assert.equal(p('/hub', 1199), false);
  const nav = read('src/components/BuklodNavSafeShell.web.tsx');
  assert.match(nav, /BuklodPublicDesktopDashboard/);
  assert.match(nav, /shouldUseBuklodPublicDesktopShell\(pathname, width\)/);
});
test('desktop dashboard uses real feature surfaces without fake financial or online data', () => {
  const shell = read('src/components/BuklodPublicDesktopDashboard.tsx');
  for (const token of [
    "BuklodCommunityContributionCard", "BuklodSponsorSlot",
    "buklod_connect_personal_threads", "loadConnectSuggestedContacts",
    "readCachedConnectSuggestedContacts", "getOfflineCache", "userId",
    "setContacts([])", "setThreads([])", "'/hub'", "'/buklod'",
    "'/messages'", "'/me'", "'/clusters'", "'/bible/read'",
  ]) assert.ok(shell.includes(token), token);
  assert.doesNotMatch(shell, /Online Now \(12\)|Total Earnings|₱1,250|Youth for Christ/);
  assert.doesNotMatch(shell, /fixedLongLeftBanner|BuklodPersistentBottomNav/);
});
test('desktop Home offers real actions and canonical Wall composer handoff', () => {
  const home = read('src/app/(tabs)/hub.tsx');
  const wall = read('src/app/(tabs)/buklod.tsx');
  const messages = read('src/app/(tabs)/messages.tsx');
  assert.match(home, /desktopDashboard/);
  assert.match(home, /homeTodayIntent: String\(Date\.now\(\)\)/);
  assert.match(home, /\/bible\/read\?source=daily_plan/);
  assert.match(wall, /Desktop Home -> Create Post/);
  assert.match(messages, /desktopSearchParams/);
});
