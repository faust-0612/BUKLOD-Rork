import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');

test('No-fill collapses banner slots and retries only after the quiet period', () => {
  const banner = read('src/components/BuklodAdMobBanner.tsx');
  const first = read('src/components/BuklodFirstViewAd.tsx');
  assert.match(banner, /if \(noFill && adNetworkAvailable\) \{[\s\S]*?setFailed\(true\)/);
  assert.match(banner, /AD_SLOT_REMOUNT_COOLDOWN_MS/);
  assert.match(banner, /One bounded retry after the shared quiet period/);
  assert.doesNotMatch(first, /minHeight: BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT/);
});

test('Native feed placeholders are measurable but never become a 392dp blank card', () => {
  const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.match(native, /viewportProbe:\s*\{[\s\S]*?height: 8/);
  assert.match(native, /pendingArea:\s*\{[\s\S]*?minHeight: 8/);
  assert.match(native, /if \(nativeFailed && \(!bannerUnitId \|\| bannerFailed\)\) return null;/);
  assert.doesNotMatch(native, /bannerOnlyFrame/);
  assert.match(native, /const AD_LOAD_TIMEOUT_MS = 8_000/);
  assert.match(native, /AD_SLOT_REMOUNT_COOLDOWN_MS/);
});
