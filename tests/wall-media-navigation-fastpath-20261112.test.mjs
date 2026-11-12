import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const wall=source('src/app/(tabs)/buklod.tsx');
const music=source('src/components/BuklodPostMusicPicker.tsx');

test('Wall composer stays on the canonical tab and publishes with its existing background queue',()=>{
  assert.match(wall,/useFocusEffect/);
  assert.match(wall,/enqueueCommunityPublish\(/);
  assert.match(wall,/setCommunityComposerOpen\(false\); \/\/ Return to compact posting bar immediately/);
  assert.match(wall,/<BuklodPostMusicPicker visible=\{composerMusicPickerOpen\}/);
  assert.match(wall,/onClose=\{\(\)=>\{wallComposerScrubRef\.current=null/);
});

test('Music overlay keeps safe-area bounds and scrollable choices without changing bottom navigation',()=>{
  assert.match(music,/useSafeAreaInsets/);
  assert.match(music,/onRequestClose=\{onClose\}/);
  assert.match(music,/height:'90%',maxHeight:720,minHeight:0/);
  assert.match(music,/nestedScrollEnabled style=\{\{flex:1,minHeight:84\}\}/);
  assert.doesNotMatch(music,/createNativeStackNavigator|router\.replace/);
});
