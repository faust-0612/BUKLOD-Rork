import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');

test('No-fill collapses banner slots and retries only after the quiet period', () => {
  const banner = read('src/components/BuklodAdMobBanner.tsx');
  const first = read('src/components/BuklodFirstViewAd.tsx');
  assert.match(banner, /if \(noFill && adNetworkAvailable\) \{[\s\S]*?setFailed\(true\)/);
  assert.match(banner, /BANNER_LOAD_TIMEOUT_MS = 8_000/);
  assert.match(banner, /BANNER_AD_LOAD_TIMEOUT/);
  assert.match(banner, /AD_SLOT_REMOUNT_COOLDOWN_MS/);
  assert.match(banner, /isConnected && isInternetReachable !== false/);
  assert.match(banner, /One bounded retry after the shared quiet period/);
  assert.doesNotMatch(first, /minHeight: BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT/);
});

test('Native first-view and feed probes stay compact and terminal fallback failures collapse', () => {
  const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.match(native, /const AD_PENDING_SLOT_HEIGHT = 8/);
  assert.match(native, /viewportProbe:\s*\{[\s\S]*?minHeight: AD_PENDING_SLOT_HEIGHT/);
  assert.match(native, /pendingBannerShell:\s*\{[\s\S]*?minHeight: AD_PENDING_SLOT_HEIGHT/);
  assert.match(native, /pendingArea:\s*\{[\s\S]*?minHeight: 8/);
  assert.match(native, /if \(!bannerUnitId \|\| bannerFailed\) return null;/);
  assert.match(native, /bannerFailedAt.current = Date.now\(\)/);
  assert.match(native, /const AD_LOAD_TIMEOUT_MS = 8_000/);
  assert.match(native, /AD_SLOT_REMOUNT_COOLDOWN_MS/);
  assert.match(native, /isConnected && isInternetReachable !== false/);
});
