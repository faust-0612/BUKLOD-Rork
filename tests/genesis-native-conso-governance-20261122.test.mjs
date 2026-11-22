import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
const manifest=JSON.parse(read('.buklod/scopes/genesis-native-full-conso-gate-20261122.json'));

test('one exact staged native source gate declares all imported component scopes',()=>{
  assert.equal(manifest.contractVersion,2);
  assert.equal(manifest.baseRef,'dev/arena-godot-native-migration-20261122');
  assert.equal(manifest.releaseMode,'consolidated-staging-source-hold');
  assert.equal(manifest.releaseStatus,'DEV_SOURCE_ONLY_NEW_SIGNED_GODOT_APK_AND_ISOLATED_BACKEND_REQUIRED');
  const expected=[
    '.buklod/scopes/genesis-native-ad-cluster-conso-20261122.json',
    '.buklod/scopes/genesis-unified-godot-native-staging-20261122.json',
    '.buklod/scopes/genesis-unified-eas-signature-guard-20261122.json',
    '.buklod/scopes/genesis-native-premium-conso-20261122.json',
  ].sort();
  assert.deepEqual([...manifest.componentScopePaths].sort(),expected);
  assert.equal(new Set(manifest.componentScopePaths).size,expected.length);
  assert.equal(manifest.productionOtaAuthorized,false);
  assert.equal(manifest.signedReleaseReady,false);
});

test('new workflow selector is exact native staging-only and leaves prod OTA immutable',()=>{
  const workflow=read('.github/workflows/engineering-accountability.yml');
  const gate=read('scripts/engineering-regression-gate.mjs');
  assert.match(workflow,/integration\/genesis-unified-godot-native-staging-20261122/);
  assert.match(workflow,/genesis-native-full-conso-gate-20261122\.json/);
  assert.match(gate,/nativeGodotSourceHold/);
  assert.match(gate,/dev\/arena-godot-native-migration-20261122/);
  assert.match(gate,/DEV_SOURCE_ONLY_NEW_SIGNED_GODOT_APK_AND_ISOLATED_BACKEND_REQUIRED/);
  assert.doesNotMatch(read('.github/workflows/production_android_ota.yml'),/BUKLOD_UNIFIED_GODOT_QA/);
});

test('all necessary native art, Android bridge, audio and escrow source paths are explicitly protected',()=>{
  for(const key of [
    'app.config.js','eas.json','scripts/build-empire-godot-pack.mjs',
    'godot/empire-arena/scripts/arena_root.gd','godot/empire-arena/scripts/hero_animation.gd',
    'godot/empire-arena/scripts/arena_effects.gd','godot/empire-arena/shaders/arena_impact.gdshader',
    'modules/buklod-genesis-godot/android/src/main/java/expo/modules/buklodgenesisgodot/GenesisGodotActivity.java',
    'services/empire-arena/core.mjs',
    'src/lib/buklodNativeAdRecovery.ts', 'src/app/clusters/home-checkin-review.tsx',
    'src/components/LearningQuestionResponse.tsx',
    'supabase/migrations/20261122090000_cluster_scoped_home_checkin_review_v1.sql',
    'tests/protected-feature-lock.test.mjs',
    '.github/workflows/engineering-accountability.yml']) {
    assert.ok(manifest.allowedPaths.includes(key),'Unprotected native asset or security file: '+key);
  }
  const lockIds=new Set(manifest.lockedFeatureChanges.map(x=>x.id));
  for(const id of ['app-runtime','kingdom-character','production-release','governance-lock','navigation-auth','cluster-faith','backend-security'])assert.ok(lockIds.has(id),id);
  assert.equal(manifest.physicalDeviceQA,'WAIVED_BY_OWNER_UNTESTED');
  assert.match(read('scripts/genesis-unified-signed-stage-preflight.mjs'),/signedReleaseReady,true/);
});
