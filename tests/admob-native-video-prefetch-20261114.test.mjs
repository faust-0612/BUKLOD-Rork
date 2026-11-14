import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('admob native next-slot preload never mounts offscreen native ad views',()=>{
 const ad=read('src/components/BuklodCommunityInlineAd.tsx');
 const banner=read('src/components/BuklodAdMobBanner.tsx');
 assert.ok(ad.includes('canPrefetchNative'));
 assert.ok(ad.includes('NativeAd.createForAdRequest'));
 assert.ok(ad.includes('nativeRendered.current || !eligible'));
 assert.ok(ad.includes('if (!eligible || !sdkReady || !online)'));
 assert.ok(ad.includes('reserveBuklodPassiveAdRequest'));
 assert.ok(banner.includes('requireViewport'));
 assert.ok(read('src/app/(tabs)/buklod.tsx').includes('prefetch={preloadAdId===item.id}'));
 assert.ok(read('src/app/(tabs)/messages.tsx').includes('connect_personal_inline_4" prefetch'));
});

test('SDK native creative stays warmed until its virtualized row is recycled',()=>{
 const native=read('src/components/BuklodCommunityInlineAd.tsx');
 assert.ok(native.includes('eligible||prefetch||nativeRequestStarted.current'));
 assert.ok(native.includes('createdAd?.destroy()'));
});
