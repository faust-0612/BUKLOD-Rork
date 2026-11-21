import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fx=read('src/features/season2/genesis/GenesisDimensionalMapEffects.tsx');
const image=read('src/features/season2/genesis/GenesisReliablePortraitImage.tsx');
const entry=read('src/features/season2/genesis/GenesisApprovedEntryMap.tsx');
const page=read('src/app/buklod-map.tsx');
const hotspot=JSON.parse(read('src/features/season2/genesis/genesisApprovedEntryHotspots.json'));
test('cosmic animation cannot intercept taps or change approved artwork/fallback',()=>{
 assert.match(fx,/pointerEvents="none"/);
 assert.match(fx,/accessible=\{false\}/);
 assert.doesNotMatch(fx,/router\.push|onPress=|fetch\(|setInterval\(|requestAnimationFrame\(/);
 assert.match(image,/mode!=='safe'&&loaded\?<GenesisDimensionalMapEffects/);
 assert.match(image,/onError=\{onFailed\}/);
 assert.match(image,/GENESIS_PORTRAIT_RESCUE_URI/);
 assert.equal(hotspot.hotspots.length,9);
 assert.match(entry,/DOORS\.map\(door=><Pressable/);
 assert.match(entry,/doorTarget\(door\)/);
 assert.match(entry,/PROMPTS\.map\(prompt=><Pressable/);
 assert.match(page,/<BuklodMapHeader/);
 assert.match(page,/<BuklodMapGuideDock/);
});
test('animation is smooth native-driver looping with cleanup and power safeguards',()=>{
 assert.match(fx,/useGenesisMotionAllowed\(/);
 assert.match(fx,/getGenesisDeviceQuality\('home'\)/);
 assert.match(fx,/if\(!run\)return/);
 assert.match(fx,/Animated\.loop\(Animated\.timing\(orbit/);
 assert.match(fx,/duration:36000/);
 assert.match(fx,/easing:Easing\.linear/);
 assert.ok((fx.match(/useNativeDriver:true/g)||[]).length>=5);
 assert.match(fx,/orbital\.stop\(\)/);
 assert.match(fx,/glowing\.stop\(\)/);
 assert.match(fx,/drifting\.stop\(\)/);
 assert.match(fx,/height:landscape\?'100%':'64%'/);
});
test('nine existing feature routes and preview-only security checks remain',()=>{
 const routes=hotspot.hotspots.map(h=>h.route);
 for(const route of ['/games','/games/empire-arena','/season2/learnings',
   '/season2/university','/season2/my-world','/season2/church',
   '/season2/community-village','/profile/focus-apps','/season2/special-events'])
   assert.ok(routes.includes(route),route);
 assert.match(page,/if \(!isGenesisPreviewBuild\(\)\)/);
 assert.match(page,/requiresAcceptance/);
 assert.match(page,/config\?\.update_required/);
 assert.match(page,/useRorkGameAmbience/);
});
