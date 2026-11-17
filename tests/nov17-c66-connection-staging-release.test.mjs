import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const w=readFileSync('.github/workflows/buklod-nov17-c66-connection-staging-ota.yml','utf8');
const scope=JSON.parse(readFileSync('.buklod/scopes/nov17-c66-connection-staging-release.json','utf8'));
test('frozen exact main and seven reviewed connectivity patches',()=>{
 assert.equal(scope.baseRef,'c66d2c5cc7c65a75e63eaabc91a5438cb5af97cd');
 assert.equal(scope.allowedPaths.length,10);
 for(const token of ['RELEASE_MAIN_SHA: c66d2c5cc7c65a75e63eaabc91a5438cb5af97cd','release/nov17-c66-connection-staging132','Reviewed network integration blob changed: ','number:908','number:911','networkPr.head.sha']) assert.ok(w.includes(token),token);
 assert.ok(w.includes('git diff --exit-code "$RELEASE_MAIN_SHA" "$GITHUB_SHA" -- assets/'));
});
test('staging-only Android runtime and production pre-post manifest isolation',()=>{
 for(const token of ['APP_VARIANT: staging','EXPO_PUBLIC_APP_ENV: staging','channel:view staging-user','channel:view production','org.mzbministry.buklod.staging',"runtimeVersion,'1.3.2'",'--channel staging-user --platform android --environment preview','Production changed during staging OTA','physicalDeviceVerified:false']) assert.ok(w.includes(token),token);
 assert.doesNotMatch(w,/update --channel production|--profile production|eas submit|supabase db push|npx vercel deploy/);
});
test('CI gates, source tests, idempotent publish and readback',()=>{
 for(const token of ['Engineering Accountability','BUKLOD Compact Layout Source QA (No OTA)','BUKLOD Performance R1 QA','tests/offline-global-sync-quiet-20261117.test.cjs','tests/wall-header-navigation-20261117.test.mjs','tests/wall-network-feedback-20261117.test.mjs','tests/wall-network-navigation-20261117.test.mjs','tests/protected-feature-lock.test.mjs','BUKLOD_NOV17_C66_CONN_','verifyUpdate','existing-group',"manifest('staging-user')",'Verify public artwork manifest']) assert.ok(w.includes(token),token);
});
