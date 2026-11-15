import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Executive staging publisher is gated and never publishes production',()=>{
 const w=read('.github/workflows/buklod-executive-ui-staging-132-ota-20261115.yml');
 const p=read('scripts/buklod-executive-staging-132-policy.mjs');
 assert.match(w,/BUKLOD_EXECUTIVE_STAGING_132_PUBLISH/);
 assert.match(w,/pull_number:827/);
 assert.match(w,/Engineering Accountability/);
 assert.match(w,/BUKLOD Main - Report Door and Legacy Integration PR QA/);
 assert.match(w,/expo export --platform android/);
 assert.match(w,/update --channel staging-user --platform android/);
 assert.doesNotMatch(w,/update --channel production/);
 assert.match(p,/PREVIOUS_UPDATE = '01a1ddc3-57fe-7652-abac-3393952aeea1'/);
 assert.match(p,/Current staging OTA advanced; do not overwrite/);
 assert.match(p,/Production changed after publish/);
 assert.match(p,/deviceVerification:'SKIPPED BY OWNER'/);
});
