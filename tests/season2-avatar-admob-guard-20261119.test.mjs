import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Rank avatar changes never create a new ad request or block Community first-view ads',()=>{
 const avatar=read('src/components/ProfileAvatar.tsx');
 const presence=read('src/lib/buklodAvatarPresence.ts');
 const badge=read('src/components/points/BuklodCircleRankBadge.tsx');
 const wall=read('src/app/(tabs)/buklod.tsx');
 for(const source of [avatar,presence,badge]){
   assert.doesNotMatch(source,/from ['"]@\/providers\/AdsProvider|from ['"]@\/lib\/buklodAds|NativeAdView|InterstitialAd|rewardedAd/i);
 }
 assert.match(wall,/import BuklodFirstViewAd/);
 assert.match(wall,/import BuklodCommunityInlineAd/);
 assert.match(wall,/useAds/);
 assert.match(avatar,/getBuklodCircleRankArt/);
});
