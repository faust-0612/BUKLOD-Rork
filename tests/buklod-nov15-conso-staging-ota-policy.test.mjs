import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE, RELEASE_FILE, SOURCE_FILES, TARGET_PACKAGE, verifyReleaseScope, verifyNativeCreativeGate } from '../scripts/buklod-nov15-conso-staging-policy.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('consolidated staging release identity matches signed client and excludes clinical/native QA', () => {
  const r=JSON.parse(read(RELEASE_FILE));
  assert.equal(BASE,'2e7dc3aa69d2362b7b360013ccaac9917c353e2b');
  assert.equal(TARGET_PACKAGE,'org.mzbministry.buklod.staging');
  assert.doesNotThrow(()=>verifyReleaseScope(r));
  assert.equal(r.physicalDeviceAcceptance,'WAIVED/NOT TESTED');
  assert.equal(r.target.channel,'staging-user');
  assert.equal(r.target.environment,'preview');
  assert.equal(r.readyForOta,false);
  assert.equal(r.otaPublished,false);
  assert.equal(r.productionPublished,false);
});

test('staging policy fails closed for unsafe release identity or premature success declarations', () => {
  const r=JSON.parse(read(RELEASE_FILE));
  for(const field of [
    {target:{...r.target,channel:'production'}},
    {target:{...r.target,runtime:'1.4.0-nativeqa.1'}},
    {target:{...r.target,package:'org.mzbministry.buklod'}},
    {readyForOta:true},{otaPublished:true},{stageBeforeProduction:false},
    {excluded:r.excluded.filter(v=>!/saliksik/i.test(v))},
  ]) assert.throws(()=>verifyReleaseScope({...r,...field}));
});

test('exactly reviewed JS delta preserves NativeAd SDK-only impressions', () => {
  assert.equal(SOURCE_FILES.length,17);
  assert.equal(new Set(SOURCE_FILES).size,SOURCE_FILES.length);
  assert(SOURCE_FILES.every(path=>path.startsWith('src/')));
  const native=read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.doesNotThrow(()=>verifyNativeCreativeGate(native));
  assert.throws(()=>verifyNativeCreativeGate(native.replace('NativeAdEventType.IMPRESSION','NativeAdEventType.LOADED')));
});

test('release workflow requires exact SHA CI and avoids cross-channel publication', () => {
  const workflow=read('.github/workflows/buklod-nov15-conso-staging-ota-publish.yml');
  const scope=JSON.parse(read('.buklod/scopes/nov15-consolidated-video-ad-staging.json'));
  for(const anchor of [
    'Engineering Accountability',
    'BUKLOD Main - Report Door and Legacy Integration PR QA',
    'BUKLOD Nov15 Consolidated Staging Android Compile QA - No Publish',
    'update --channel staging-user --platform android --environment preview',
    'postpublish', 'staging-channel-after.json', 'production-channel-after.json',
    'head_commit.message', 'BUKLOD_CONSO_STAGE_20261115:',
  ]) assert.ok(workflow.includes(anchor),'Missing release gate: '+anchor);
  assert.ok(!workflow.includes('update --channel production'));
  for(const path of [RELEASE_FILE,'scripts/buklod-nov15-conso-staging-policy.mjs','tests/buklod-nov15-conso-staging-ota-policy.test.mjs']) assert(scope.allowedPaths.includes(path));
});
