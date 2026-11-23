const test=require('node:test'),a=require('assert/strict'),fs=require('fs');
const w=fs.readFileSync('.github/workflows/buklod-word-staging-ota-20261123.yml','utf8');
const m=JSON.parse(fs.readFileSync('.buklod/scopes/word-bible-pressable-20261123.json','utf8'));
test('staging release targets only staging-user with verified build and production isolation',()=>{
 a.match(w,/branches: \[dev\/word-pressable-scripture-20261123\]/);
 a.match(w,/BUKLOD_WORD_STAGING_20261123:/);
 a.match(w,/--channel staging-user --platform android --environment preview/);
 a.match(w,/org\.mzbministry\.buklod\.staging/);
 a.match(w,/verifyBuild\(r\('build\.json'\)\)/);
 a.match(w,/verifyChannels\(/);
 a.match(w,/Production changed during staging OTA/);
 a.doesNotMatch(w,/eas-cli[^\n]*update --channel production/);
});
test('staging release preserves main and current staging feature parity and ad/nav coverage',()=>{
 a.match(w,/git merge-base --is-ancestor/);
 a.match(w,/staging source changes are not cumulatively reconciled/);
 a.match(w,/BUKLOD Compact Layout Source QA \(No OTA\)/);
 a.match(w,/tests\/dashboard-ad-navigation-prewarm-20261116/);
 a.match(w,/tests\/word-bible-navigation-20261123/);
 a.match(w,/tests\/connect-cluster-open-latest-20261123/);
 a.match(w,/--platform android --output-dir/);
 a.ok(m.allowedPaths.includes('.github/workflows/buklod-word-staging-ota-20261123.yml'));
 a.ok(m.regressionTests.includes('tests/word-staging-ota-release-20261123.test.cjs'));
 a.ok(m.lockedFeatureChanges.some(x=>x.id==='production-release'));
});
