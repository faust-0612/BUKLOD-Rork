import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {BUKLOD_FEATURE_LINKS,findBuklodFeatures} from '../src/lib/buklodNavigationV2.ts';
import {GENESIS_KINGDOM_ROUTES,isGenesisKingdomRoute} from '../src/lib/buklodKingdomRoutePolicy.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Kingdom search and menu return without Arena or retired world doors',()=>{
 assert.equal(findBuklodFeatures('laro')[0]?.route,'/games');
 assert.equal(findBuklodFeatures('kingdom')[0]?.route,'/games');
 assert.ok(BUKLOD_FEATURE_LINKS.every(x=>! /empire-arena|buklod-map|my-world|community-village/.test(x.route)));
 for(const q of ['chat','basa','kontribusyon','tulong'])assert.ok(findBuklodFeatures(q)[0]?.route);
 assert.ok(read('src/components/BuklodNavigationSideMenu.tsx').includes("route: '/games'"));
 const finder=read('src/components/BuklodFeatureFinder.tsx');assert.ok(finder.includes("BUKLOD_FEATURE_LINKS.map(item => item.id)"));assert.ok(finder.includes("'kingdom'"));
});
test('All 13 Kingdom stations and four support routes are allowed; Arena and unknown routes fail closed',()=>{
 const routes=readdirSync(new URL('../src/app/games/',import.meta.url)).filter(x=>x.endsWith('.tsx')&&!['_layout.tsx','empire-arena.tsx'].includes(x)).map(x=>x==='index.tsx'?'/games':'/games/'+x.slice(0,-4)).sort();
 assert.equal(routes.length,18);assert.deepEqual([...GENESIS_KINGDOM_ROUTES].sort(),routes);
 for(const p of routes){assert.ok(isGenesisKingdomRoute(p));assert.ok(isGenesisKingdomRoute(p+'/'));}
 for(const p of ['/games/empire-arena','/games/empire-arena/','/games/unknown','/games/empire-arena/anything','/buklod-map','/season2/my-world','/community-village'])assert.equal(isGenesisKingdomRoute(p),false);
 const layout=read('src/app/games/_layout.tsx');assert.ok(layout.includes('isGenesisPreviewBuild() && !isGenesisKingdomRoute(pathname)'));assert.ok(layout.includes('return <Slot />'));
});
test('Kingdom retains original 13 stations, local progression, ads and direct Home return',()=>{
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 assert.doesNotMatch(portal,/Empire Arena|\/games\/empire-arena|\/buklod-map/);
 assert.ok(portal.includes("router.replace('/(tabs)/hub')"));
 for(const t of ['13 CHARACTER STATIONS','loadBuklodKingdomPreviewProgress','getMyBuklodCharacterSelectionV2','kingdom_map_footer','/games/genesis-collection','/games/legacy'])assert.ok(portal.includes(t),t);
 assert.ok(read('src/app/games/index.tsx').includes('<GenesisKingdomPortal />'));
 const tabs=read('src/app/(tabs)/_layout.tsx');assert.ok(tabs.includes("? { initialRouteName: 'hub' }"));assert.ok(tabs.includes(": { initialRouteName: 'buklod' }"));
});
