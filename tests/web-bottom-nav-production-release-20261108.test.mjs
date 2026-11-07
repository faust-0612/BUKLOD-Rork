import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const web = readFileSync('src/components/BuklodPersistentBottomNav.web.tsx', 'utf8');
const native = readFileSync('src/components/BuklodPersistentBottomNav.tsx', 'utf8');
const shell = readFileSync('src/components/BuklodMobileWebShell.tsx', 'utf8');
const webWorkflow = readFileSync('.github/workflows/production_web_deploy.yml', 'utf8');
const androidWorkflow = readFileSync('.github/workflows/production_android_ota.yml', 'utf8');

test('mobile web uses its own five-target bottom nav and never changes native touch handling', () => {
  assert.match(web, /BUKLOD_MOBILE_WEB_BOTTOM_NAV_FAST_R1/);
  assert.match(web, /import \{ Keyboard, Pressable, StyleSheet, Text, View \} from 'react-native'/);
  assert.doesNotMatch(web, /BuklodPressable|onResponderMove|onTouchMove|unstable_pressDelay/);
  assert.match(web, /touchAction: 'manipulation'/);
  for (const route of ["'/hub'", "'/clusters'", "'/buklod'", "'/messages'", "'/me'"]) {
    assert.ok(web.includes('route: ' + route), route + ' is available');
  }
  assert.match(shell, /BuklodPersistentBottomNav/);
  assert.match(native, /const openGlobalDestination = async/);
});

test('web tab change gives visual feedback and routes without waiting for a server', () => {
  assert.match(web, /latestRouteRef\.current = route;\s*setPendingRoute\(route\)/);
  assert.match(web, /if \(inFlightRef\.current\) return;/);
  assert.match(web, /if \(!needsScopeReset\) \{\s*complete\(\);/);
  assert.match(web, /void selectScope\(publicScope\.scope_id\)\.then\(complete, fail\)/);
  assert.match(web, /const destination = latestRouteRef\.current \?\? route/);
  assert.match(web, /buklodInstantReplace\(destination\)/);
  assert.match(web, /shouldShowBuklodPublicBottomNav\(pathname\)/);
  assert.match(web, /accessibilityState=\{\{ selected \}\}/);
});

test('special production marker can deploy web without authorizing Android OTA', () => {
  assert.match(webWorkflow, /BUKLOD_WEB_NAV_ONLY_20261108/);
  assert.doesNotMatch(androidWorkflow, /BUKLOD_WEB_NAV_ONLY_20261108/);
  assert.match(webWorkflow, /node --test tests\/web-bottom-nav-production-release-20261108\.test\.mjs/);
});
