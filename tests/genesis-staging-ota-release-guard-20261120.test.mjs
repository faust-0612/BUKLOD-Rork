import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const workflow=read('.github/workflows/genesis-conso-staging-ota-publish-20261120.yml');

test('publish entry is exact staging-only owner-triggered, not automatic after ordinary source merge',()=>{
  assert.match(workflow,/branches:\s*\n\s*- release\/genesis-conso-staging-ota-candidate-20261120/);
  assert.match(workflow,/startsWith\(github\.event\.head_commit\.message, 'BUKLOD_GENESIS_STAGING_OTA_PUBLISH_20261120:'\)/);
  assert.match(workflow,/FROZEN_SOURCE: ded6a45f80130314f9335bb0706dd5f826697171/);
  assert.match(workflow,/APK_SOURCE: 5bd80dbcafd85b0e8dc3c78f8d555b4aff2193d0/);
  assert.match(workflow,/STAGING_CHANNEL: season2-genesis-preview/);
  assert.match(workflow,/STAGING_PACKAGE: org\.mzbministry\.buklod\.staging/);
  assert.match(workflow,/STAGING_RUNTIME: 2\.0\.0-genesis-preview/);
  assert.match(workflow,/FROZEN_SOURCE" HEAD\)" = "\$EXPECTED"/);
  assert.match(workflow,/unreviewed source drift since approved consolidated Genesis candidate/);
  assert.doesNotMatch(workflow,/(?:update|build)\s+--(?:channel|profile)\s+production|--platform all/);
});

test('frozen approved Genesis candidate has exact matching native config with installed signed APK',()=>{
  const paths=['app.config.js','eas.json','package.json','package-lock.json','modules','plugins'];
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
  for(const path of paths){
    assert.equal(git('diff','--name-only','5bd80dbcafd85b0e8dc3c78f8d555b4aff2193d0','ded6a45f80130314f9335bb0706dd5f826697171','--',path),'','Native drift '+path);
  }
  const installed=execFileSync('git',['show','5bd80dbcafd85b0e8dc3c78f8d555b4aff2193d0:app.config.js'],{encoding:'utf8'});
  assert.equal(read('app.config.js'),installed,'Byte-for-byte native Expo config parity with signed staging APK');
});

test('startup correction and app-wide ad/navigation release gates are still required',()=>{
  assert.match(workflow,/tests\/dashboard-ad-navigation-prewarm-20261116\.test\.mjs/);
  assert.match(workflow,/tests\/ad-dashboard-focus-performance-20261116\.test\.mjs/);
  assert.match(workflow,/tests\/buklod-ads-appwide-permanent-lock-20261111\.test\.mjs/);
  assert.match(workflow,/npx tsc --noEmit/);
  assert.match(workflow,/node scripts\/genesis-conso-staging-ota-preflight\.mjs/);
  assert.match(workflow,/expo export --platform android/);
  assert.match(workflow,/update --channel "\$STAGING_CHANNEL" --platform android/);
  assert.match(workflow,/update:list --branch "\$STAGE_BRANCH"/);
  assert.match(workflow,/Ambiguous duplicate update; fail closed/);
  assert.match(workflow,/Production channel mapping unchanged/);
  assert.match(workflow,/EAS staging\/production channel mapping did not stabilize/);
  assert.match(workflow,/SKIPPED_EXPLICITLY_BY_OWNER_NOT_TESTED/);
  assert.match(read('src/features/season2/genesis/GenesisCinematicStartup.tsx'),/centeredBrandGroup/);
});
