import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const workflow=read('.github/workflows/buklod-bible-v4-review-staging-qa-20261116.yml');
const scope=JSON.parse(read('.buklod/scopes/bible-v4-quiz-review-clarity-20261116.json'));
test('staging OTA preflight is isolated, runtime-locked and does not publish',()=>{
 assert.match(workflow,/branches: \[fix\/bible-v4-review-clarity-20261116\]/);
 assert.match(workflow,/org\.mzbministry\.buklod\.staging/);
 assert.match(workflow,/config\.runtimeVersion,'1\.3\.2'/);
 assert.match(workflow,/eas\.build\['staging-user'\]\.channel/);
 assert.match(workflow,/npx expo export --platform android/);
 assert.match(workflow,/npx tsc --noEmit/);
 assert.match(workflow,/ad-native-lifecycle-retention/);
 assert.match(workflow,/nov14-connect-green-profile-posts-ota/);
 assert.doesNotMatch(workflow,/eas-cli.*update|eas update|EXPO_TOKEN|--channel production|expo publish/);
});
test('exact path scope includes security, quiz and staging release gates',()=>{
 const paths=['.github/workflows/buklod-bible-v4-review-staging-qa-20261116.yml','tests/buklod-bible-v4-review-ota-20261116.test.mjs','src/components/bible/BuklodBibleQuizV4.tsx','supabase/migrations/20261116025500_buklod_bible_v4_review_transparency.sql'];
 for(const path of paths)assert.ok(scope.allowedPaths.includes(path),path);
 for(const lock of ['app-runtime','backend-security','quiz-classroom','production-release'])
  assert.ok(scope.lockedFeatureChanges.some(change=>change.id===lock),lock);
 assert.ok(scope.riskAreas.includes('release-identity'));
 assert.ok(scope.regressionTests.includes('tests/buklod-bible-v4-review-ota-20261116.test.mjs'));
});
