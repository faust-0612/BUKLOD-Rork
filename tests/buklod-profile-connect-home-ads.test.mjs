import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');

test('Profile and new lightweight Home use one first-view NativeAd opportunity instead of a later duplicate',()=>{
  const profile=read('src/app/(tabs)/me.tsx');
  const home=read('src/app/(tabs)/hub.tsx');
  assert.match(profile,/<BuklodFirstViewAd placement="profile" placementId="profile_first_view"/);
  assert.doesNotMatch(profile,/BuklodNativeSponsoredCard/);
  assert.match(home,/<BuklodFirstViewAd placement="home" placementId="new_home_first_view"/);
  assert.doesNotMatch(home,/BuklodNativeSponsoredCard/);
  assert.match(home,/focused && foreground/);
});

test('Connect advertising remains in inbox header, outside active message threads and search',()=>{
  const inbox=read('src/app/(tabs)/messages.tsx');
  assert.match(inbox,/placement="messages"/);
  assert.match(inbox,/connect_personal_first_view/);
  assert.match(inbox,/connect_community_first_view/);
  assert.doesNotMatch(inbox,/BuklodNativeSponsoredCard/);
  assert.match(inbox,/!isSearching \? \(\s*<BuklodFirstViewAd/);
  assert.doesNotMatch(read('src/app/connect/personal/[threadId].tsx'),/BuklodCommunityInlineAd/);
});

test('Cluster directory and managed dashboards use first-view native inventory without duplicate lower cards',()=>{
  const directory=read('src/app/clusters/index.tsx');
  const managed=read('src/components/BuklodScopeHomeDashboard.tsx');
  const command=read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
  for(const s of [directory,managed,command]){
    assert.match(s,/<BuklodFirstViewAd/);
    assert.doesNotMatch(s,/BuklodNativeSponsoredCard/);
  }
});

test('Native sponsored card renderer retains scope-aware unit selection and real provider callbacks',()=>{
  const source=read('src/components/BuklodCommunityInlineAd.android.tsx');
  for(const name of ['home','profile','connect','cluster_dashboard']){
    assert.ok(source.includes("'" + name + "'"));
  }
  assert.match(source,/surface === 'connect'/);
  assert.match(source,/surface === 'profile'/);
  assert.match(source,/NativeAdEventType.IMPRESSION/);
  assert.match(source,/getBuklodBannerUnitId\(bannerPlacement\)/);
  assert.match(source,/NativeMediaView/);
  assert.match(source,/FEED_AD_CARD_HEIGHT/);
});

test('Android first-view wrapper maps placement to native surface and keeps kill-switch identity',()=>{
  const first=read('src/components/BuklodFirstViewAd.android.tsx');
  assert.match(first,/resolveSurface/);
  assert.match(first,/resolveInventory/);
  assert.match(first,/surface=\{surface\}/);
  assert.match(first,/inventory=\{inventory\}/);
  assert.match(first,/placementIdOverride=\{placementId\}/);
  assert.match(first,/diagnosticName=\{diagnosticPlacementFor\(placement\)\}/);
  assert.match(first,/firstView/);
});
