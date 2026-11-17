import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const wall=readFileSync(new URL('../src/app/(tabs)/buklod.tsx',import.meta.url),'utf8');
test('Wall navigation and author/report actions remain unchanged by transient network feedback',()=>{
 for(const marker of [
  'const openComments=', 'toggleAuthorFollow(', "openReport('post', item.id)",
  'const reportCommunityFailure=', 'router', 'useFocusEffect',
  'BuklodCommunityPostEngagement'
 ]) assert.ok(wall.includes(marker),marker);
 assert.match(wall,/\[showFeedback,wallNetworkStatus\]/);
 assert.match(wall,/\[user\?\.id,wallNetworkStatus,reportCommunityFailure\]/);
});
