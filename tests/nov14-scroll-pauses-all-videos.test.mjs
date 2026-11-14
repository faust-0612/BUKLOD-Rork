import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('scroll start pauses all video and audio before viewport exit',()=>{
 const signal=read('src/lib/buklodVideoScrollSignal.ts');
 assert.match(signal,/BUKLOD_VIDEO_SCROLL_IDLE_MS = 180/);
 assert.match(signal,/listener\(true\)/);
 const wall=read('src/app/(tabs)/buklod.tsx');
 const marites=read('src/components/BuklodMaritesBoard.tsx');
 const scope=read('src/components/BuklodExclusiveScopeCommunity.tsx');
 assert.match(wall,/noteBuklodVideoScroll\(\)/);
 assert.match(wall,/!videoViewerScrollPaused/);
 assert.match(scope,/noteBuklodVideoScroll\(\)/);
 assert.match(marites,/!scrollPaused/);
 assert.match(marites,/noteBuklodVideoScroll\(\)/);
 assert.match(read('src/components/BuklodCommunitySponsoredAd.tsx'),/visible=\{screenFocused&&videoVisible&&!scrollPaused\}/);
});
