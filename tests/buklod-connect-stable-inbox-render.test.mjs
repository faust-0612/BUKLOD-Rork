import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');

test('Personal, Cluster, Org and Requests share one mounted Connect FlatList', () => {
  const inbox = read('src/app/(tabs)/messages.tsx');
  assert.equal((inbox.match(/<FlatList\\b/g) || []).length, 1);
  assert.match(inbox, /ListHeaderComponent=\\{renderHiblaHeader\\(tab === 'community'\\)\\}/);
  assert.match(inbox, /data=\\{tab === 'community' \\? filteredRooms : personalListData\\}/);
  assert.match(inbox, /removeClippedSubviews=\\{false\\}/);
  assert.match(inbox, /<ConnectInboxTabs/);
  assert.match(inbox, /onCommunityFilterChange=\\{setCommunityFilter\\}/);
  assert.match(inbox, /tab === 'requests'/);
  assert.match(inbox, /matchesCommunityFilter\\(room, communityFilter\\)/);
});

test('Connect keeps both types of authentic ad opportunity without adding request loops', () => {
  const inbox = read('src/app/(tabs)/messages.tsx');
  assert.match(inbox, /placement="messages"/);
  assert.match(inbox, /connect_personal_first_view/);
  assert.match(inbox, /connect_community_first_view/);
  assert.match(inbox, /connect-personal-native-media/);
  assert.match(inbox, /connect-community-native-media/);
  assert.match(inbox, /connect-scope-native-media:/);
  const banners = read('src/components/BuklodAdMobBanner.tsx');
  assert.match(banners, /reserveBuklodPassiveAdRequest/);
  assert.match(banners, /if \\(noFill && online\\)/);
  assert.doesNotMatch(inbox, /setInterval\\(.*Ad|requestAd\\(/);
});

test('Connect recoverable boundary covers inbox, personal and community; reports no chat text', () => {
  const inbox = read('src/app/(tabs)/messages.tsx');
  const personal = read('src/app/connect/personal/[threadId].tsx');
  const room = read('src/app/connect/community/[scopeId].tsx');
  const fallback = read('src/components/connect/ConnectRenderBoundary.tsx');
  assert.match(inbox, /<ConnectRenderBoundary surface="inbox">/);
  assert.match(personal, /<ConnectRenderBoundary surface="personal_thread">/);
  assert.match(room, /<ConnectRenderBoundary surface="community_thread">/);
  assert.match(fallback, /BUKLOD_CONNECT_RENDER_EXCEPTION/);
  assert.match(fallback, /CONNECT_/);
  assert.match(fallback, /localSelfHealAttempted: false/);
  assert.match(fallback, /Bumalik sa Wall/);
  assert.doesNotMatch(fallback, /supabase|messageBody|recipientId|NativeAd/);
});
