import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Wall monetization surfaces survive the rank/Notes hotfix',()=>{
  const wall=source('src/app/(tabs)/buklod.tsx');
  assert.match(wall,/BuklodNativeSponsoredCard/);
  assert.match(wall,/BuklodFirstViewAd/);
  assert.match(wall,/warmBuklodAdOpportunity|showBuklodAdOpportunity/);
});
test('Connect Note Header does not introduce its own AdMob lifecycle',()=>{
  const header=source('src/components/BuklodCommunityConnectHeader.web.tsx');
  assert.doesNotMatch(header, /AdsProvider|showBuklodAdOpportunity|warmBuklodAdOpportunity/);
});
