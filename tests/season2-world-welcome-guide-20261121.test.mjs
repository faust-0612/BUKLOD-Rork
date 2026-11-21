import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('classic BUKLOD title bar survives with search, menu and notifications',()=>{
 const map=src('src/app/buklod-map.tsx'),bar=src('src/features/season2/world/BuklodMapHeader.tsx');
 assert.match(map,/<BuklodMapHeader \/>/);
 for(const key of ['BUKLOD','GENESIS_IDENTITY.title','BuklodNavigationSideMenu','/feature-search','/notifications'])assert.ok(bar.includes(key));
 assert.match(map,/Welcome sa BUKLOD!/);
 assert.doesNotMatch(map,/Ang bawat pintuan sa mapa|Isang mundo/);
});
test('one tap guide comes before untouched illustrated map and no ad steals first view',()=>{
 const map=src('src/app/buklod-map.tsx'),guide=src('src/features/season2/world/BuklodMapGuideDock.tsx');
 assert.ok(map.indexOf('<BuklodMapGuideDock')<map.indexOf('{mapNode}'));
 assert.doesNotMatch(map,/BuklodFirstViewAd|new_home_first_view|toggleMusic|musicButton/);
 assert.match(src('src/features/season2/genesis/GenesisValleyMap.tsx'),/buklod-season2-entry-map-approved.webp/);
 assert.match(map,/landscapeGuideColumn/);
 assert.match(guide,/BuklodActiveCharacterArt|isReduceMotionEnabled/);
});
test('seven true door shortcuts and Android audio on entry, without production changes',()=>{
 const guide=src('src/features/season2/world/BuklodMapGuideDock.tsx');
 for(const [name,route] of Object.entries({Home:'/hub',Community:'/buklod',Connect:'/messages',Profile:'/me',
   Cluster:'/clusters','Settings Engine':'/settings','My BUKLOD':'/season2/my-world'})){
  assert.ok(guide.includes("label:'"+name+"',route:'"+route+"'"),name);
  assert.ok(existsSync('src/app/'+route.slice(1)+'.tsx')||
    existsSync('src/app/'+route.slice(1)+'/index.tsx')||
    existsSync('src/app/(tabs)/'+route.slice(1)+'.tsx'),route);
 }
 assert.match(guide,/minHeight:44/);
 assert.match(src('src/app/buklod-map.tsx'),/useRorkGameAmbience\('kingdom-map',\{autoStart:true\}\)/);
 assert.doesNotMatch(src('src/app/(tabs)/hub.tsx'),/<Redirect href="\/buklod-map"/);
 assert.match(src('src/app/index.tsx'),/href=\{isGenesisPreviewBuild\(\) \? '\/buklod-map' : '\/\(tabs\)\/buklod'\}/);
});
