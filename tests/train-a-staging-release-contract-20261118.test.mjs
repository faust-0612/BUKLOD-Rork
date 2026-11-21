import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const w=readFileSync('.github/workflows/buklod-train-a-staging-ota-20261118.yml','utf8');
const m=JSON.parse(readFileSync('.buklod/scopes/train-a-noauth-verified-client-fixes-20261118.json','utf8'));
test('Train A stage is isolated and checks exact tested source while preserving main auth',()=>{
 assert.match(w,/branches: \[rc\/train-a-nonauth-safe-20261118\]/);
 assert.match(w,/APPROVED: 053a4dde28461ef103429aff18be06e2ce7388ff/);
 assert.match(w,/git diff --exit-code "\$MAIN" "\$GITHUB_SHA" -- 'src\/app\/\(auth\)\/login\.tsx' src\/providers\/AuthProvider\.tsx/);
 assert.match(w,/update --channel staging-user --platform android/);
 assert.doesNotMatch(w,/update --channel production|update --branch production/);
});
test('signed EAS staging proof, isolated production manifest and ad regression are mandatory',()=>{
 for(const value of ['verifyBuild(read','verifyChannels(read','manifest(','npx tsc --noEmit',
  'BUKLOD Performance R1 QA','APP_VARIANT=staging','physicalDeviceVerified:false',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY','actualAdFillVerified:false'])
   assert.ok(w.includes(value),value);
 assert.ok(m.lockedFeatureChanges.some(x=>x.id==='production-release'));
 assert.ok(m.regressionTests.includes('tests/train-a-staging-release-contract-20261118.test.mjs'));
});
