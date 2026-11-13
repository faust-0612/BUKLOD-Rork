import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Navigation V2 retains all approved Home passive and first-view ad surfaces',()=>{
  const home=read('src/app/(tabs)/hub.tsx');
  assert.match(home,/BuklodCommunitySponsoredAd audience="public" placement="home"/);
  assert.match(home,/BuklodFirstViewAd placement="home" placementId="new_home_first_view"/);
  assert.match(home,/BuklodNativeSponsoredCard surface="home" slotId="hub_mid_native"/);
  assert.match(home,/BuklodScreenBottomBanner placement="home" variant="large"/);
});
test('Profile ads remain mounted and UX additions do not change AdMob policy',()=>{
  const profile=read('src/app/(tabs)/me.tsx');
  assert.match(profile,/BuklodFirstViewAd placement="profile" placementId="profile_first_view"/);
  assert.match(profile,/BuklodNativeSponsoredCard surface="profile" slotId="profile_mid_native"/);
  assert.match(profile,/BuklodScreenBottomBanner placement="profile" variant="large"/);
  const scope=read('.buklod/scopes/navigation-v2-staging-initial-20261113.json');

  assert.ok(!scope.includes('src/providers/AdsProvider'));

});
