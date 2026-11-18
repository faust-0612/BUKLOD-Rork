import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(p,'utf8');
test('Train A leaves login and auth provider on canonical main; no weak-signal auth modifications',()=>{
 const login=load('src/app/(auth)/login.tsx');
 const provider=load('src/providers/AuthProvider.tsx');
 const layout=load('src/app/(tabs)/_layout.tsx');
 assert.doesNotMatch(provider,/profileLoadState/);
 assert.doesNotMatch(layout,/profileLoadState|refreshProfile|useNetwork/);
 assert.doesNotMatch(login,/setSlowLogin|Sign-in is taking longer than usual/);
 assert.match(login,/resolveBuklodAccountLifecycleAfterLogin/);
 assert.match(provider,/clearAuthSnapshot/);
 assert.match(layout,/if \(requiresAcceptance\)/);
 assert.match(layout,/<Redirect href="\/onboarding" \/>/);
});
test('Train A retains only Android persistent dashboard tabs, never bypasses compliance or AdMob warmup',()=>{
 const layout=load('src/app/(tabs)/_layout.tsx');
 const tabs=load('src/components/BuklodAndroidDashboardTabs.tsx');
 assert.match(layout,/Platform\.OS === 'android' \? \(/);
 assert.match(layout,/<BuklodAndroidDashboardTabs showPrayer=\{showPrayer\} sceneStyle=\{tabSceneStyle\} \/>/);
 assert.match(layout,/if \(!session\)/);
 assert.match(layout,/if \(requiresAcceptance\)/);
 assert.match(layout,/<BuklodDashboardAdWarmup \/>/);
 assert.match(tabs,/freezeOnBlur/);
});
test('Train A preserves video first-view controls and Connect recovery from isolated RC',()=>{
 const wall=load('src/app/(tabs)/buklod.tsx');
 const video=load('src/components/CommunityVideo.tsx');
 const connect=load('src/components/BuklodConnectThread.tsx');
 assert.match(wall,/videoViewer/);
 assert.match(video,/onFirstFrameRender/);
 assert.match(connect,/scrollToEnd/);
 assert.match(load('src/components/BuklodExclusiveScopeCommunity.tsx'),/scopedCommunityVideoMedia/);
});
