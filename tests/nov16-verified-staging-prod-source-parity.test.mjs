import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const rel=JSON.parse(readFileSync(new URL('../release/nov16-staging-verified-prod-promotion.json',import.meta.url),'utf8'));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();

test('production source exactly preserves stage-verified JS assets/native/backend tree',()=>{
  assert.match(rel.stage.sourceSha,/^[0-9a-f]{40}$/);
  assert.equal(rel.stage.runtimeVersion,'1.3.2');
  assert.equal(rel.target.runtimeVersion,'1.3.2');
  assert.equal(git('rev-parse',rel.stage.sourceSha+'^{tree}'),rel.stage.sourceTreeSha);
  const protectedPaths=[
    'src/','assets/','android/','ios/','plugins/','supabase/','package.json',
    'package-lock.json','app.config.js','eas.json','metro.config.js',
    'src/providers/AdsProvider.tsx','.github/workflows/production_android_ota.yml'
  ];
  const changed=git('diff','--name-only',rel.stage.sourceSha,'HEAD','--',...protectedPaths);
  assert.equal(changed,'','Promotion may not change staged application source');
});
test('production promotion has an independently verified immutable staging EAS receipt',()=>{
  assert.equal(rel.stage.sourceSha,'1aebc901e77089c7f3e926c76dfff4a4a8e34972');
  assert.equal(rel.stage.updateId,'01a1e2c9-3ec3-76be-b931-84f5e0ebafc2');
  assert.equal(rel.stage.channel,'staging-user');
  assert.equal(rel.stage.package,'org.mzbministry.buklod.staging');
  assert.equal(rel.previousProduction.updateId,'01a1e10a-f043-7113-9a6c-673e91a58517');
  assert.equal(rel.stage.physicalDeviceVerified,false);
});
test('production OTA remains guarded by TypeScript, ad locks, freeze, verified EAS hash',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/production_android_ota.yml',import.meta.url),'utf8');
  const rc=readFileSync(new URL('../scripts/android-ota-rc.cjs',import.meta.url),'utf8');
  assert.match(workflow,/BUKLOD_CONSOLIDATED_PROD_20261108/);
  assert.match(workflow,/tests\/buklod-ads-appwide-permanent-lock-20261111.test.mjs/);
  assert.match(workflow,/node scripts\/android-ota-rc.cjs freeze/);
  assert.match(workflow,/node scripts\/android-ota-rc.cjs published/);
  assert.match(rc,/Served bundle differs from frozen RC/);
  assert.match(rc,/Android production.*OTA|VERIFIED ANDROID PRODUCTION OTA/);
});
