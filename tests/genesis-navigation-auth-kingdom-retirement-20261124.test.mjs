import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getBuklodFeatureLinks,findBuklodFeatures} from '../src/lib/buklodNavigationV2.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Genesis filters game links before matching or restoring saved shortcuts, Season 1 retains the existing route',()=>{
 const genesis=getBuklodFeatureLinks(true),legacy=getBuklodFeatureLinks(false);
 assert.equal(genesis.some(x=>x.route==='/games'),false);
 assert.equal(findBuklodFeatures('laro',5,genesis).some(x=>x.route==='/games'),false);
 assert.equal(findBuklodFeatures('kingdom',5,genesis).some(x=>x.route==='/games'),false);
 assert.equal(findBuklodFeatures('laro',5,legacy)[0]?.route,'/games');
 for(const q of ['chat','basa','kontribusyon','tulong'])assert.equal(findBuklodFeatures(q,5,genesis)[0]?.route,findBuklodFeatures(q,5,legacy)[0]?.route);
 const finder=read('src/components/BuklodFeatureFinder.tsx');assert.ok(finder.includes('VISIBLE_FEATURE_LINKS.map(item => item.id)'));assert.ok(finder.includes('findBuklodFeatures(query, 5, VISIBLE_FEATURE_LINKS)'));assert.ok(finder.includes('if (!PINNABLE_FEATURE_IDS.includes(item.id)) return;'));
});
test('game routes are retired in Genesis before children mount; legacy game routes remain intact',()=>{
 const s=read('src/app/games/_layout.tsx');assert.match(s,/if \(isGenesisPreviewBuild\(\)\) return <Redirect href="\/\(tabs\)\/hub"/);assert.match(s,/return <Slot \/>/);
 const menu=read('src/components/BuklodNavigationSideMenu.tsx');assert.ok(menu.includes("!genesisMain || item.route !== '/games'"));assert.ok(menu.includes("if (genesisMain && item.route === '/games') return;"));
 const tabs=read('src/app/(tabs)/_layout.tsx');assert.ok(tabs.includes("? { initialRouteName: 'hub' }"));assert.ok(tabs.includes(": { initialRouteName: 'buklod' }"));
});
