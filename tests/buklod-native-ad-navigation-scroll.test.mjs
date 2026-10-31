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
 assert.equal((connect.match(/<FlatList\b/g) || []).length, 1);
 assert.match(connect,/ListHeaderComponent=\{renderHiblaHeader\(tab === 'community'\)\}/);
 assert.match(connect,/ListFooterComponent=\{!isSearching \? \(/);
 assert.match(connect,/removeClippedSubviews=\{false\}/);
 assert.doesNotMatch(read('src/app/connect/personal/[threadId].tsx'),/<BuklodNativeSponsoredCard/);
});

test('New native ads are Android-only; browser receives a no-op without media SDK',()=>{
 const android=read('src/components/BuklodNativeSponsoredCard.android.tsx');
 const web=read('src/components/BuklodNativeSponsoredCard.tsx');
 assert.match(android,/<BuklodCommunityInlineAd/);
 assert.match(web,/return null/);
 assert.doesNotMatch(web,/NativeAd|BannerAd|react-native-google-mobile-ads/);
});

test('Connect tab tap, direct chat and scoped chat have recoverable render containment',()=>{
 const inbox=read('src/app/(tabs)/messages.tsx');
 const direct=read('src/app/connect/personal/[threadId].tsx');
 const scoped=read('src/app/connect/community/[scopeId].tsx');
 const boundary=read('src/components/connect/ConnectRenderBoundary.tsx');
 assert.match(inbox,/<ConnectRenderBoundary surface="inbox">/);
 assert.match(direct,/<ConnectRenderBoundary surface="personal_thread">/);
 assert.match(scoped,/<ConnectRenderBoundary surface="community_thread">/);
 assert.match(boundary,/BUKLOD_CONNECT_RENDER_EXCEPTION/);
 assert.match(boundary,/Subukan muli/);
 assert.match(boundary,/Bumalik sa Wall/);
});
test('Connect Personal first-view and scoped ad opportunity remain independent',()=>{
 const inbox=read('src/app/(tabs)/messages.tsx');
 assert.match(inbox,/placement="messages"/);
 assert.match(inbox,/connect_personal_first_view/);
 assert.match(inbox,/connect_community_first_view/);
 assert.match(inbox,/connect-personal-native-media/);
 assert.match(inbox,/connect-community-native-media/);
 const banner=read('src/components/BuklodAdMobBanner.tsx');
 assert.match(banner,/if \(noFill && online\)/);
 assert.match(banner,/reserveBuklodPassiveAdRequest/);
});
