import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const thread = read('src/components/BuklodConnectThread.tsx');
const bubble = read('src/components/connect/ConnectMessageBubble.tsx');
const windowPolicy = read('src/lib/connectChatWindow.ts');
const pkg = JSON.parse(read('package.json'));

test('Connect layout and Seen changes do not create ad SDK requests in shared bubble/scroll helper', () => {
  assert.doesNotMatch(bubble, /react-native-google-mobile-ads|InterstitialAd\\.createForAdRequest/);
  assert.doesNotMatch(windowPolicy, /react-native-google-mobile-ads|showInterstitial/);
  assert.ok(pkg.dependencies['react-native-google-mobile-ads']);
});

test('Connect Latest remains gesture safe without replacing the tab or ad lifecycle', () => {
  assert.match(thread, /onScrollBeginDrag=\\{\\(\\) => \\{ userDraggingRef\\.current = true; \\}\\}/);
  assert.match(thread, /onMomentumScrollBegin=\\{\\(\\) => \\{ userMomentumRef\\.current = true; \\}\\}/);
  assert.match(thread, /requestAnimationFrame\\(followComposerToLatest\\)/);
  assert.match(thread, /keyboardVisible/);
});

// These source checks are supplementary only: the separate AdMob/first-view,
// navigation and compiled Android gates remain mandatory before any OTA.
