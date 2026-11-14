import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('navigation remains unchanged while existing Home/Wall/Connect stop video on scroll',()=>{
 const home=read('src/app/(tabs)/hub.tsx');
 const wall=read('src/app/(tabs)/buklod.tsx');
 const connect=read('src/app/(tabs)/messages.tsx');
 assert.match(home,/noteBuklodVideoScroll\\(\\)/);
 assert.match(wall,/noteBuklodVideoScroll\\(\\)/);
 assert.match(wall,/!videoViewerScrollPaused/);
 assert.match(connect,/connect_personal_first_view/);
 assert.match(connect,/connect_community_first_view/);
 assert.match(connect,/connect_personal_inline_4/);
 assert.match(connect,/connect_community_inline_4/);
});
