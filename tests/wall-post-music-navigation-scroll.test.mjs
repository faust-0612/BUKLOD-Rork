import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wall=readFileSync(new URL('../src/app/(tabs)/buklod.tsx',import.meta.url),'utf8');

test('Optional Wall music leaves the existing feed pagination, scroll and ad visibility intact',()=>{
  assert.match(wall,/maintainVisibleContentPosition=\{\{ disabled: true \}\}/);
  assert.match(wall,/onScroll=\{\(event:any\) => \{/);
  assert.match(wall,/onEndReachedThreshold=\{0\.45\}/);
  assert.match(wall,/onCommunityWallViewableItemsChanged=useRef/);
  assert.match(wall,/communityViewabilityListener\.current\(event\)/);
  assert.match(wall,/viewabilityConfigCallbackPairs=\{communityViewabilityPairs\}/);
  assert.match(wall,/viewabilityConfig: communityAdViewabilityConfig/);
});

test('Audio stops when post leaves the visible window without changing native feed ordering',()=>{
  const view=wall.slice(wall.indexOf('const onCommunityWallViewableItemsChanged=useRef'),wall.indexOf('const maritesVisibilityRefreshRef'));
  assert.match(view,/wallAudioOwnerRef\.current\|\|wallAudioPendingOwnerRef\.current/);
  assert.match(view,/!event\.viewableItems\.some\(/);
  assert.match(view,/wallAudioRequestEpochRef\.current\+\+/);
  assert.match(view,/wallAudioForVisibility\.current\(\)/);
  assert.match(view,/communityViewabilityListener\.current\(event\)/);
});

test('Leaving Wall cancels loading and pauses music; existing navigation stays mounted',()=>{
  const part=wall.slice(wall.indexOf('const onCommunityWallViewableItemsChanged=useRef'),wall.indexOf('const maritesVisibilityRefreshRef'));
  assert.match(part,/useFocusEffect\(useCallback\(\(\)=>\{/);
  assert.match(part,/wallAudioPendingOwnerRef\.current=''/);
  assert.match(part,/pauseWallAudio\(\)/);
  assert.match(wall,/<FlashList/);
});

test('New ambient photo overlays follow the original FlashList visibility and route focus',()=>{
  assert.match(wall,/setVisibleCreativePostIds\(nextIds\)/);
  assert.match(wall,/wallScreenFocused&&visibleCreativePostIds\.includes\(String\(item\.id\)\)/);
  assert.match(wall,/extraData=\{communityCreativeExtraData\}/);
  assert.match(wall,/setWallScreenFocused\(false\)/);
  assert.match(wall,/communityViewabilityListener\.current\(event\)/);
  assert.match(wall,/maintainVisibleContentPosition=\{\{ disabled: true \}\}/);
});
