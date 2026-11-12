import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(file,'utf8');
const marker = JSON.parse(read('.buklod/scopes/nov12-2026-consolidated-android-web-production-marker.json'));

test('Nov12 marker changes metadata only, not active video or finance runtime',()=>{
  assert.deepEqual(marker.allowedPaths,['.buklod/scopes/nov12-2026-consolidated-android-web-production-marker.json','tests/nov12-2026-consolidated-production-marker.test.mjs']);
  assert.equal(marker.baseRef,'3569fe85a56ff30812ef1d3ced1a4a9e68ecb8a3');
  assert.equal(marker.sourceMergeSha,marker.baseRef);
  assert.equal(marker.rc.checksPassed,6);
  assert.equal(marker.rc.compiledAndroidWebQaRun,43144593151);
  assert.equal(marker.backend.databaseContractsPassed,3);
  assert.equal(marker.backend.financeSwitchesRemainOff,true);
});
test('retain exact canonical guarded Android OTA and Web publishers',()=>{
  const android=read('.github/workflows/production_android_ota.yml');
  const web=read('.github/workflows/production_web_deploy.yml');
  assert.equal(marker.releasePrefix,'BUKLOD_CONSOLIDATED_PROD_20261108');
  for (const workflow of [android,web]) {
    assert.ok(workflow.includes("startsWith(github.event.head_commit.message, 'BUKLOD_CONSOLIDATED_PROD_20261108')"));
    assert.match(workflow,/github\.event_name == 'push'/);
    assert.doesNotMatch(workflow,/^  workflow_dispatch:/m);
    assert.match(workflow,/ref: \$\{\{ github.sha \}\}/);
  }
  assert.match(android,/node scripts\/android-ota-rc\.cjs freeze/);
  assert.match(android,/node scripts\/android-ota-rc\.cjs verify/);
  assert.match(android,/node scripts\/android-ota-rc\.cjs published/);
  assert.match(web,/sha256sum -c web-rc-sha256.txt/);
  assert.match(web,/eas-cli@latest deploy --prod --export-dir dist/);
  assert.equal(marker.target.runtimeVersion,'1.3.2');
  assert.equal(marker.target.androidVersionCode,30);
  assert.equal(marker.target.androidPackage,'org.mzbministry.buklod');
});
test('critical current Main features and finance isolation are present in marker source',()=>{
  const video=read('src/components/CommunityVideo.tsx');
  const budget=read('src/lib/buklodPassiveVideoBudget.ts');
  const bible=read('src/app/bible/read.tsx');
  const identity=read('src/app/admin/buklod-official.tsx');
  const revenue=read('supabase/migrations/20261112094000_buklod_admob_only_member_revenue_v1.sql');
  assert.match(video,/passiveAllowed/);
  assert.match(video,/<ExpoCommunityVideo/);
  assert.match(budget,/registerBuklodPassiveVideoSlot/);
  assert.match(bible,/get_automatic_bible_reading_for_cluster/);
  assert.ok(identity.length>200);
  assert.match(revenue,/admob_preliminary_is_cash/);
  assert.match(revenue,/sponsorship/i);
});
