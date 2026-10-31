import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');

test('Profile and new lightweight Home have stable visible first-view and genuine native media opportunities',()=>{
  const profile=read('src/app/(tabs)/me.tsx');
  const home=read('src/app/(tabs)/hub.tsx');
  assert.match(profile,/<BuklodFirstViewAd placement="profile" placementId="profile_first_view"/);
  assert.match(profile,/<BuklodNativeSponsoredCard\s+surface="profile"/);
  assert.match(home,/<BuklodFirstViewAd placement="home" placementId="new_home_first_view"/);
  assert.match(home,/<BuklodNativeSponsoredCard\s+surface="home"/);
  assert.match(home,/focused && foreground/);
});

test('Connect advertising is only in inbox surfaces, outside message threads and search',()=>{
  const inbox=read('src/app/(tabs)/messages.tsx');
  assert.match(inbox,/placement="messages"/);
  assert.match(inbox,/<BuklodNativeSponsoredCard\s+surface="connect"/);
  assert.match(inbox,/ListFooterComponent=\{!isSearching/);
  assert.match(inbox,/!isSearching \? \(\s*<BuklodFirstViewAd/);
  assert.doesNotMatch(read('src/app/connect/personal/[threadId].tsx'),/BuklodCommunityInlineAd/);
});

test('Cluster directory and both managed dashboard implementations offer native media cards',()=>{
  const directory=read('src/app/clusters/index.tsx');
  const managed=read('src/components/BuklodScopeHomeDashboard.tsx');
  const command=read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
  for(const s of [directory,managed,command]){
    assert.match(s,/<BuklodFirstViewAd/);
    assert.match(s,/<BuklodNativeSponsoredCard/);
    assert.match(s,/surface="cluster_dashboard"/);
  }
  assert.match(managed,/scope-home-native-media:\$\{scope.scope_id\}/);
  assert.match(command,/cluster-command-native-media:\$\{scope.scope_id\}/);
});

test('Native sponsored card uses scoped placement and fallback without fake provider impressions',()=>{
  const source=read('src/components/BuklodCommunityInlineAd.android.tsx');
  for(const name of ['home','profile','connect','cluster_dashboard']){
    assert.ok(source.includes("'"+name+"'"));
  }
  assert.match(source,/surface === 'connect'/);
  assert.match(source,/surface === 'profile'/);
  assert.match(source,/NativeAdEventType.IMPRESSION/);
  assert.match(source,/getBuklodBannerUnitId\(bannerPlacement\)/);
  assert.match(source,/NativeMediaView/);
  assert.match(source,/FEED_AD_CARD_HEIGHT/);
});
