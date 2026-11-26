import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');

test('Home, Profile and Connect keep their existing scroll hierarchy with one first-view ad slot',()=>{
 const home=read('src/app/(tabs)/hub.tsx');
 const profile=read('src/app/(tabs)/me.tsx');
 const connect=read('src/app/(tabs)/messages.tsx');
 assert.match(home,/<ScrollView\b/);
 assert.match(home,/\bstyle=\{\{/);
 assert.match(home,/reportBuklodDashboardScroll\('home'/);
 assert.match(home,/noteBuklodVideoScroll\(\)/);
 assert.match(home,/scrollEventThrottle=\{16\}/);
 assert.match(profile,/<ScrollView\b/);
 assert.match(profile,/\bref=\{profileScrollRef\}/);
 assert.equal((connect.match(/<FlatList\b/g) || []).length, 1);
 assert.match(connect,/ListHeaderComponent=\{renderHiblaHeader\(tab === 'community'\)\}/);
 // Preserve the newer Connect inline-ad contract.
 assert.equal((connect.match(/<BuklodNativeSponsoredCard\b/g) || []).length, 2);
 assert.match(connect,/slotId="connect_personal_inline_4"\s+prefetch/);
 assert.match(connect,/slotId="connect_community_inline_4"\s+prefetch/);

 // One first-view component, with mutually selected inbox placement IDs.
 assert.equal((connect.match(/<BuklodFirstViewAd\b/g) || []).length, 1);
 assert.match(connect,/connect_community_first_view/);
 assert.match(connect,/connect_personal_first_view/);

 // Home has separate desktop/mobile branches; Profile has one slot.
 assert.equal((home.match(/<BuklodFirstViewAd\b/g) || []).length, 2);
 assert.equal((home.match(/placementId="new_home_first_view"/g) || []).length, 2);
 assert.equal((profile.match(/<BuklodFirstViewAd\b/g) || []).length, 1);
 assert.match(profile,/placementId="profile_first_view"/);

 // No sponsored native media inside active scoped chat.
 assert.doesNotMatch(
   read('src/app/connect/community/[scopeId].tsx'),
   /<BuklodNativeSponsoredCard\b|<BuklodCommunityInlineAd\b/
 );
 assert.match(connect,/removeClippedSubviews=\{false\}/);
 assert.doesNotMatch(read('src/app/connect/personal/[threadId].tsx'),/<BuklodNativeSponsoredCard/);
});

test('Native ad components remain Android-only; browser receives a no-op without media SDK',()=>{
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

test('Connect first-view native ad stays in the inbox and never enters active chat threads',()=>{
 const inbox=read('src/app/(tabs)/messages.tsx');
 const first=read('src/components/BuklodFirstViewAd.android.tsx');
 assert.match(inbox,/connect_personal_first_view/);
 assert.match(inbox,/connect_community_first_view/);
 assert.doesNotMatch(inbox,/connect-personal-native-media|connect-community-native-media/);
 assert.match(first,/placement === 'messages'/);
 assert.match(first,/return 'connect'/);
 assert.doesNotMatch(read('src/app/connect/personal/[threadId].tsx'),/BuklodNativeSponsoredCard|BuklodCommunityInlineAd/);
});

