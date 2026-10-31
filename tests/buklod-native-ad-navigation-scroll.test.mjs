import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');

test('Home, Profile and Connect keep existing scroll hierarchy and only add fixed ad slots',()=>{
 const home=read('src/app/(tabs)/hub.tsx');
 const profile=read('src/app/(tabs)/me.tsx');
 const connect=read('src/app/(tabs)/messages.tsx');
 assert.match(home,/<ScrollView style=/);
 assert.match(profile,/<ScrollView\s+ref=\{profileScrollRef\}/);
 assert.match(connect,/<FlatList\s+ListHeaderComponent=\{renderHiblaHeader\(false\)\}/);
 assert.match(connect,/ListFooterComponent=\{!isSearching && tab === 'personal'/);
 assert.match(connect,/ListFooterComponent=\{!isSearching \? \(/);
 assert.doesNotMatch(read('src/app/connect/personal/[threadId].tsx'),/<BuklodNativeSponsoredCard/);
});

test('New native ads are Android-only; browser receives a no-op without media SDK',()=>{
 const android=read('src/components/BuklodNativeSponsoredCard.android.tsx');
 const web=read('src/components/BuklodNativeSponsoredCard.tsx');
 assert.match(android,/<BuklodCommunityInlineAd/);
 assert.match(web,/return null/);
 assert.doesNotMatch(web,/NativeAd|BannerAd|react-native-google-mobile-ads/);
});
