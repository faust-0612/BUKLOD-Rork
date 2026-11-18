import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const branch='rc/nov18-consolidated-current-fixes-android132';
const releasePath='.buklod/scopes/nov18-consolidated-current-fixes-android132.json';
const manifest=JSON.parse(readFileSync(releasePath,'utf8'));
const workflow=readFileSync('.github/workflows/engineering-accountability.yml','utf8');
const sourceGate=readFileSync('scripts/engineering-regression-gate.mjs','utf8');

test('Nov18 consolidated RC is explicitly recognized by fail-closed governance',()=>{
 assert.match(workflow,/rc\/nov18-consolidated-current-fixes-android132\)/);
 assert.match(workflow,/BUKLOD_SCOPE_MANIFEST=\.buklod\/scopes\/nov18-consolidated-current-fixes-android132\.json/);
 assert.match(sourceGate,/rc\/nov18-consolidated-current-fixes-android132/);
 assert.match(workflow,/BUKLOD_CONSOLIDATED_RC_GATE=true/);
 assert.equal(manifest.releaseMode,'consolidated-main-rc');
 assert.equal(manifest.scopeManifestPath,releasePath);
 assert.equal(manifest.baseRef,'main');
});

test('all currently approved Nov17/18 source workstreams are present without duplicate scope declarations',()=>{
 const expected=[
  '.buklod/scopes/android-instant-dashboard-tabs-20261117.json',
  '.buklod/scopes/fullscreen-video-all-area-reactions-20261117.json',
  '.buklod/scopes/fullscreen-video-fair-exposure-20261118.json',
  '.buklod/scopes/nov18-staging-apk-henry-mlkit.json',
  '.buklod/scopes/scoped-community-sidecar-video-render-20261118.json',
  '.buklod/scopes/video-handoff-connect-stability-20261117.json',
  '.buklod/scopes/weak-signal-login-profile-recovery-20261118.json',
 ].sort();
 assert.deepEqual([...manifest.componentScopePaths].sort(),expected);
 assert.equal(new Set(manifest.allowedPaths).size,manifest.allowedPaths.length);
 assert.equal(new Set(manifest.componentScopePaths).size,expected.length);
 for(const p of manifest.componentScopePaths){
  assert.ok(existsSync(p),p);
  assert.equal(JSON.parse(readFileSync(p,'utf8')).contractVersion,2,p);
  assert.ok(manifest.allowedPaths.includes(p),p);
 }
});

test('current source wires fair video, stable playback, scope video, dashboard tabs and Henry recovery',()=>{
 const wall=readFileSync('src/app/(tabs)/buklod.tsx','utf8');
 const layout=readFileSync('src/app/(tabs)/_layout.tsx','utf8');
 const videos=readFileSync('src/components/BuklodExclusiveScopeCommunity.tsx','utf8');
 const henry=readFileSync('src/lib/buklodHenryTranslation.ts','utf8');
 assert.match(wall,/arrangeCommunityVideosForFairExposure/);
 assert.match(wall,/buildReelsFeedWithInlineAds/);
 assert.match(wall,/setVideoViewerPosts\(\[target\]\)/);
 assert.match(layout,/BuklodAndroidDashboardTabs/);
 assert.match(videos,/communityWallVideoDescriptor|media_items|recoverScopedWallVideo/);
 assert.match(henry,/retry|Retry|model|Model/);
 for(const path of ['src/components/CommunityVideo.tsx',
    'src/components/BuklodConnectThread.tsx',
    'src/components/BuklodAndroidDashboardTabs.tsx',
    'src/lib/communityVideoHandoff.ts',
    'src/lib/buklodFullscreenVideoSwipe.ts',
    'src/app/bible/read.tsx']) assert.ok(existsSync(path),path);
});

test('all touched protected areas have changed, declared Node regression proof',()=>{
 const impacted=['app-runtime','wall-media','navigation-auth','connect-ptt-calls','cluster-faith','ads-finance-points','governance-lock','backend-security'];
 assert.deepEqual(manifest.lockedFeatureChanges.map(x=>x.id).sort(),impacted.sort());
 assert.ok(manifest.regressionTests.some(p=>p.includes('protected-feature-lock-nov18')));
 for(const x of manifest.lockedFeatureChanges) {
  assert.ok(x.reason.length>15);
  assert.ok(x.preservedBehaviors.length>0);
  for(const p of x.tests){
   assert.ok(p.startsWith('tests/')&&existsSync(p),p);
   assert.ok(manifest.regressionTests.includes(p),p);
  }
 }
 assert.ok(!manifest.releaseAuthorized);
 assert.equal(manifest.actualDeviceVerificationSkipped,true);
});

test('consolidated RC includes verified weak-signal login without weakening privacy, roles or AdMob',()=>{
 assert.ok(manifest.sourcePRs.includes(934));
 assert.ok(manifest.riskAreas.includes('auth-privacy'));
 for(const p of ['src/app/(auth)/login.tsx','src/providers/AuthProvider.tsx',
   'tests/weak-signal-login-profile-recovery-20261118.test.mjs',
   'tests/weak-signal-auth-security-profile-recovery-20261118.test.mjs']){
   assert.ok(manifest.allowedPaths.includes(p),p);
   assert.ok(existsSync(p),p);
 }
 const auth=readFileSync('src/providers/AuthProvider.tsx','utf8');
 const login=readFileSync('src/app/(auth)/login.tsx','utf8');
 const layout=readFileSync('src/app/(tabs)/_layout.tsx','utf8');
 assert.match(auth,/profileLoadState: BuklodProfileLoadState/);
 assert.match(auth,/clearAuthSnapshot\(userId\)/);
 assert.match(login,/resolveBuklodAccountLifecycleAfterLogin/);
 assert.match(layout,/BuklodDashboardAdWarmup/);
 assert.match(layout,/if \(requiresAcceptance\)/);
});
