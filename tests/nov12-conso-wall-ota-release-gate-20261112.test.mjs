import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(p, 'utf8');
const workflow = read('.github/workflows/unified_rc_compiled_qa_20261108.yml');
const androidPublisher = read('.github/workflows/production_android_ota.yml');
const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
const controller = read('src/lib/buklodGlobalAdController.ts');
const player = read('src/components/CommunityVideo.tsx');

test('final single-source RC compiled Android and Web from immutable PR head, with real production env', () => {
  assert.match(workflow, /github\.head_ref == 'integration\/buklod-nov12-full-conso-wall-recovery-20261112'/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /env:pull --environment production/);
  assert.match(workflow, /verify-production-ads-env\.cjs/);
  assert.match(workflow, /expo export --platform android/);
  assert.match(workflow, /expo export --platform web/);
  assert.match(workflow, /git diff --exit-code/);
  assert.doesNotMatch(workflow, /eas update --channel production|eas deploy/);
});

test('production publishing remains on the canonical gated Main workflow', () => {
  assert.match(androidPublisher, /BUKLOD_CONSOLIDATED_PROD_20261108/);
  assert.match(androidPublisher, /verify-production-ads-env\.cjs/);
  assert.match(androidPublisher, /eas-cli@latest env:exec production/);
  assert.match(androidPublisher, /eas update/);
});

test('native post-sized video inventory survives and cannot be visible through temporary safety locks', () => {
  assert.match(native, /NativeMediaView/);
  assert.match(native, /FEED_AD_CARD_HEIGHT = 392/);
  assert.match(native, /BannerAdSize\.MEDIUM_RECTANGLE/);
  assert.match(native, /if \(!active \|\| !routeSafe\) return null/);
  assert.match(native, /if \(!keepNativeLifecycle \|\| !canStartNativeRef\.current/);
  assert.match(controller, /options\?\.retentionOnly === true \|\| !hasInteractionLock\(\)/);
  assert.match(player, /BuklodImaVideo/);
});
