import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Owner-authorized release is Android staging only and frozen-source isolated',()=>{
 const y=read('.github/workflows/genesis-conso-staging-ota-publish-20261120.yml');
 const scope=JSON.parse(read('.buklod/scopes/genesis-conso-staging-ota-publication-20261121.json'));
 assert.equal(scope.baseRef,'759741954cf487f6429c1cc49c4b23796e938687');
 assert.equal(scope.releaseMode,'staging-only-Android-EAS-OTA');
 for(const x of [
  'release/genesis-conso-staging-ota-candidate-20261121',
  'startsWith(github.event.head_commit.message',
  'BUKLOD_GENESIS_OTA_STAGE_20261121:',
  'APP_VARIANT: staging',
  'EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED',
  'org.mzbministry.buklod.staging',
  'season2-genesis-preview',
  '2.0.0-genesis-preview',
  'git diff',
  'Exact frozen verified app source',
  'Source gate',
  'npm ci --ignore-scripts --no-audit --no-fund',
  'npx tsc --noEmit',
  'tests/season2-premium-ad-navigation-guard-20261121.test.mjs',
  'tests/dashboard-ad-navigation-prewarm-20261116.test.mjs',
  'tests/kingdom-signature-missions-39-20261121.test.mjs',
  'npx expo export --platform android',
  'EXPO_MAX_WORKERS=2',
  'EXPO_TOKEN: ',
  'build:view "$BUILD_ID"',
  'channel:view production',
  'update --channel "$STAGING_CHANNEL" --platform android',
  'update:view',
  'u.gitCommitHash',
  'u.runtimeVersion',
  'productionChannelPreserved:true',
  'physicalDeviceVerified:false'
 ])assert.ok(y.includes(x),'Missing required owner staging protection: '+x);
 assert.match(y,/contents: read/);
 assert.match(y,/persist-credentials: false/);
 assert.match(y,/cancel-in-progress: false/);
 assert.doesNotMatch(y,/update --channel production|update --branch production|eas build --profile production|eas submit|service_role|sb_secret_/);
});
test('Existing app and protected finance remain outside release diff allowlist',()=>{
 const m=JSON.parse(read('.buklod/scopes/genesis-conso-staging-ota-publication-20261121.json'));
 assert.deepEqual(m.allowedPaths.sort(),[
 '.buklod/scopes/genesis-conso-staging-ota-publication-20261121.json',
 '.github/workflows/genesis-conso-staging-ota-publish-20261120.yml',
 'tests/genesis-conso-staging-ota-publication-20261121.test.mjs',
 ].sort());
 assert.equal(m.productionDeployment,'NONE');
 assert.ok(m.acceptanceChecks.some(x=>x.includes('NOT VERIFIED')));
 const y=read('.github/workflows/genesis-conso-staging-ota-publish-20261120.yml');
 assert.match(y,/BUKLOD_GENESIS_CONSO_STAGE_20261121_/);
 assert.match(y,/a\.ok\(matches\.length<=1/);
 assert.match(y,/branchMapping/);
 assert.match(y,/a\.notEqual\(stage\.id,prod\.id\)/);
});
