import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('exact original approved image and 39 game atlas stay included',()=>{
 assert.ok(existsSync('assets/season2/genesis/world/buklod-approved-entry-map-1672x941.webp'));
 assert.ok(existsSync('assets/season2/genesis/kingdom/kingdom-39-game-illustration-atlas.webp'));
 assert.match(src('src/features/season2/genesis/GenesisApprovedEntryMap.tsx'),/availableWidth/);
 const map=JSON.parse(src('src/features/season2/genesis/genesisApprovedEntryHotspots.json'));
 assert.equal(map.coordinateSystem,'responsive-landmark-grid');
 assert.equal(map.hotspots.length,9);
 assert.equal(map.hotspots.find(x=>x.id==='character-kingdom').route,'/games');
 assert.equal(map.hotspots.find(x=>x.id==='hero-arena').route,'/games/empire-arena');
 assert.equal(map.hotspots.find(x=>x.id==='my-community').route,'/season2/community-village');
 assert.equal(map.hotspots.find(x=>x.id==='my-house').route,'/season2/my-world');
});
test('first view is one-tap, preserves full BUKLOD bar and puts speaking guide outside artwork',()=>{
 const map=src('src/app/buklod-map.tsx'),guide=src('src/features/season2/world/BuklodMapGuideDock.tsx');
 assert.match(map,/<BuklodMapHeader \/>/);
 assert.match(src('src/features/season2/genesis/GenesisApprovedEntryMap.tsx'),/Welcome Guide/);
 const portrait=map.slice(map.indexOf('portraitFirstView'));
 assert.ok(portrait.indexOf('{mapNode}')>=0 &&
  portrait.lastIndexOf('{mapNode}')<portrait.lastIndexOf('<BuklodMapGuideDock'),'map above guide in portrait');
 assert.match(map,/onOpen=\{\(door, route\)/);
 assert.match(map,/router.push\(route as any\)/);
 assert.match(map,/landscapeGuideColumn/);
 assert.doesNotMatch(map,/BuklodFirstViewAd|toggleMusic|musicButton/);
 for(const label of ['Gusto mong may makasama?','Maglaro?','Matuto?','Makipag-usap?','Settings Engine','My BUKLOD'])assert.ok(guide.includes(label));
 assert.match(guide,/assets\/buklod-guide\/wave\.png/);
});
test('protected Village and Home preview portals never issue financial or profile writes',()=>{
 const gate=src('src/features/season2/world/GuardedSeason2DevelopmentWorld.tsx');
 for(const guard of ['!session','requiresAcceptance','update_required','maintenance_mode','!profile','isGenesisPreviewBuild()'])assert.ok(gate.includes(guard));
 const dev=src('src/features/season2/world/Season2DevelopmentMap.tsx');
 assert.doesNotMatch(dev,/supabase\.rpc|mintBp|awardBp|withdrawQMP/);
 assert.match(dev,/buklod-community-village-stage1.webp/);
 assert.match(dev,/buklod-my-home-stage1.webp/);
 assert.match(src('src/app/(tabs)/hub.tsx'),/BuklodFirstViewAd/);
 assert.doesNotMatch(src('src/app/(tabs)/hub.tsx'),/<Redirect href="\/buklod-map"/);
 assert.match(src('src/features/games/runtime/rorkAudio.ts'),/controlledAutoStart/);
 assert.match(src('src/features/games/runtime/rorkAudio.ts'),/getPremiumKingdomSfx/);
});
