import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('owner signing and immutable per-baseline dev storage are fail-closed',()=>{
 const build=read('apps/buklod-empire/app/build.gradle');assert.match(build,/Durable Empire keystore required/);assert.match(build,/signingConfigs.owner/);
 const app=read('apps/buklod-empire/game/empire_ota.gd');assert.ok(app.includes('str(config.channel)+"/"+str(config.base)+"/"'));
 const store=read('scripts/buklod-empire-storage.mjs');assert.match(store,/assert.equal\(baseline.channel,'dev'\)/);assert.match(store,/Refusing downgrade/);assert.match(store,/Public pack mismatch/);assert.ok(store.indexOf('Public pack mismatch')<store.indexOf('DEV manifest publication'));
 const setup=read('scripts/setup-buklod-empire-dev-trust.sh');assert.match(setup,/Trust root mismatch/);assert.match(setup,/APK signer mismatch/);assert.doesNotMatch(setup,/gh secret set .*OTA_PRIVATE/);
 const wf=read('.github/workflows/buklod-empire-owner-signed-dev.yml');assert.match(wf,/environment: buklod-empire-dev/);assert.match(wf,/BUKLOD_EMPIRE_REQUIRE_RELEASE_SIGNING: 'true'/);assert.ok(wf.includes('[ "$actual" != "$expected" ]'));assert.ok(wf.includes('[ "$stored" != "$expected" ]'));assert.match(wf,/remote OTA canary still required/);
});
