import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('scope feed uses same frame-gated player and one upcoming native ad slot',()=>{
 const scope=read('src/components/BuklodExclusiveScopeCommunity.tsx');
 assert.ok(scope.includes('registerVideoFrame(String(item.id),node)'));
 assert.ok(scope.includes('onVideoFrameLayout'));
 assert.ok(scope.includes('prefetch={preloadAdId===item.id}'));
 assert.ok(scope.includes('noteBuklodVideoScroll()'));
 assert.ok(scope.includes('onCommunityVideoViewableItemsChanged'));
});

test('scoped reel playback follows measured visibility and pauses on scroll',()=>{
 const scope=read('src/components/BuklodExclusiveScopeCommunity.tsx');
 assert.ok(scope.includes('active={visibleVideoPostId === String(item.id)}'));
 assert.ok(scope.includes('if (active) player.play()'));
 assert.ok(scope.includes('else player.pause()'));
 assert.ok(scope.includes('registerVideoFrame(String(item.id), node)'));
});
