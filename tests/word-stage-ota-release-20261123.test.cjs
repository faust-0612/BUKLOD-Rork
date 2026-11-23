const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const w=fs.readFileSync('.github/workflows/buklod-word-live-stage-ota-20261123.yml','utf8');
const m=JSON.parse(fs.readFileSync('.buklod/scopes/word-live-staging-20261123.json','utf8'));
test('live Season2 source is immutable and Word changes are exact-scope only',()=>{
 a.equal(m.baseRef,'cd8efbc8a7bf7deb8940764696a7f7d2412183a8');
 a.match(w,/STAGE_BASE: cd8efbc8a7bf7deb8940764696a7f7d2412183a8/);
 a.match(w,/dev\/word-live-staging-20261123/);
 a.match(w,/git diff --exit-code "\$STAGE_BASE" "\$GITHUB_SHA" -- app.config.js/);
 a.match(w,/Unexpected changed file from live Season2 staging/);
 a.match(w,/source: 'my_bible'/);
 a.ok(m.allowedPaths.includes('.github/workflows/buklod-word-live-stage-ota-20261123.yml'));
});
test('stage OTA protects ads, existing update, package, runtime and production',()=>{
 a.match(w,/--channel staging-user --platform android --environment preview/);
 a.match(w,/verifyBuild\(r\('build.json'\)\)/);
 a.match(w,/verifyChannels\(/);
 a.match(w,/BLOCK: live staging source moved/);
 a.match(w,/Concurrent stage update/);
 a.match(w,/tests\/dashboard-ad-navigation-prewarm-20261116/);
 a.match(w,/tests\/nov16-wall-nav-ads-prewarm-integration/);
 a.match(w,/Production changed during staging OTA/);
 a.doesNotMatch(w,/eas-cli[^\n]*update --channel production/);
 a.ok(m.lockedFeatureChanges.some(x=>x.id==='production-release'));
});
