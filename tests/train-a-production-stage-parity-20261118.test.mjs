import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const embargo=require('../scripts/buklod-season2-production-embargo.cjs');
const m=JSON.parse(readFileSync('.buklod/scopes/train-a-production-rc-20261118.json','utf8'));
const wf=readFileSync('.github/workflows/buklod-train-a-production-rc-qa-20261118.yml','utf8');
test('season2 production embargo remains active and no Season2 runtime is present',()=>{
  assert.equal(embargo.NOT_BEFORE_UTC,'2026-12-05T16:00:00.000Z');
  assert.deepEqual(embargo.runtimeEvidence(),[]);
  assert.equal(m.season2Included,false);
});
test('Login/authorization unchanged and Android ads and dashboard mounted safely',()=>{
 const login=readFileSync('src/app/(auth)/login.tsx','utf8');
 const auth=readFileSync('src/providers/AuthProvider.tsx','utf8');
 const layout=readFileSync('src/app/(tabs)/_layout.tsx','utf8');
 assert.doesNotMatch(auth,/profileLoadState/);
 assert.doesNotMatch(layout,/profileLoadState|refreshProfile|useNetwork/);
 assert.doesNotMatch(login,/setSlowLogin|Sign-in is taking longer than usual/);
 assert.match(layout,/BuklodDashboardAdWarmup/);
 assert.match(layout,/BuklodAndroidDashboardTabs/);
 assert.match(layout,/if \(requiresAcceptance\)/);
});
test('Production RC workflow is build/test only; no EAS publish or unsafe marker',()=>{
 assert.match(wf,/APP_VARIANT: production/);
 assert.match(wf,/EXPO_PUBLIC_APP_ENV: production/);
 assert.match(wf,/env:pull --environment production/);
 assert.match(wf,/npx expo export --platform android/);
 assert.match(wf,/verify-production-ads-env.cjs/);
 assert.doesNotMatch(wf,/eas-cli.* update |eas update|update --channel production|BUKLOD_ANDROID_ONLY_PROD_20261114:/);
 assert.equal(m.productionStatus,'BLOCKED_AWAITING_DEVICE_EVIDENCE');
 assert.equal(m.releaseAuthorized,false);
});
