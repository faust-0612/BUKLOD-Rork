import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const wall=read('src/app/(tabs)/buklod.tsx');
const component=read('src/components/BuklodCommunitySponsoredAd.tsx');
const desktop=read('src/app/(tabs)/hub.tsx');

test('paid sponsorship is a single nonblocking Wall header card, never a new feed row or duplicate post',()=>{
  const list=wall.slice(wall.indexOf('<FlashList'),wall.indexOf('ListHeaderComponent=')+200);
  assert.match(list,/maintainVisibleContentPosition=\{\{ disabled: true \}\}/);
  assert.match(wall,/onEndReached=\{\(\) => \{/);
  assert.match(wall,/onRefresh=\{refreshCommunity186L\}/);
  assert.match(wall,/keyExtractor=\{\(i: any\)=>i.id\}/);
  assert.match(wall,/ListHeaderComponent=/);
  assert.match(wall,/<BuklodCommunitySponsoredAd audience="public" placement="community" \/>/);
  assert.equal((wall.match(/<BuklodCommunitySponsoredAd audience="public"/g)||[]).length,1);
  assert.doesNotMatch(component,/create_buklod_community_post|\.from\('buklod_community_posts'\)/);
});

test('sponsorship makes no full-screen navigation or scroll ownership changes',()=>{
  assert.match(component,/return null;/);
  assert.match(component,/style=\{s\.shell\}/);
  assert.doesNotMatch(component,/router\.replace|router\.push|scrollToOffset|scrollToIndex/);
  assert.match(desktop,/if \(desktopDashboard\)/);
  assert.match(desktop,/<BuklodCommunitySponsoredAd audience="public" placement="home" \/>/);
  assert.match(component,/ROTATE_MS = 12_000/);
});
