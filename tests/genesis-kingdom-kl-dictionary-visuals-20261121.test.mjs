import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const motifs=read('src/features/season2/genesis/klKingdomVisualMotifs.ts');
const renderer=read('src/features/season2/genesis/GenesisKingdomStationScene.tsx');
const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
const canonical=read('src/lib/kabihasnang-ligaw/dictionary.ts')+
  read('src/lib/kabihasnang-ligaw/dictionaryExtras.ts');
const kingdom=read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
const stationDefs=kingdom.split('const STATIONS: readonly Station[] = [')[1].split('] as const;')[0];
const gameIds=[...stationDefs.matchAll(/\{ id: '([^']+)'/g)].map(x=>x[1]);
const mapping=[...motifs.matchAll(/'([a-z][a-z0-9-]+)':\{\s*dictionaryTerm:'([^']+)',visual:'([^']+)'/g)];
test('All 13 canonical original Kingdom station routes receive distinct dictionary-inspired scenery',()=>{
 assert.equal(gameIds.length,13);
 assert.equal(mapping.length,13);
 assert.deepEqual(new Set(mapping.map(m=>m[1])),new Set(gameIds));
 assert.equal(new Set(mapping.map(m=>m[3])).size,13);
});
test('Dictionary is authoritative for ALL visual source places, with no invented lore terms',()=>{
 for(const [,id,term,visual] of mapping){
  assert.ok(canonical.includes("'"+term+"'")||canonical.includes("name: '"+term+"'"),
    id+' uses location absent from KL dictionary: '+term);
  assert.match(visual,/^[a-z-]+$/);
 }
 assert.match(motifs,/NOT an amendment to unreleased KL lore/);
 assert.match(motifs,/They are NOT/);
});
test('Every dictionary environment is a detailed distinct native SVG landmark, not a text-only block',()=>{
 for(const [,id,,visual] of mapping){
  assert.ok(renderer.includes("case '"+visual+"':"),id+' scenic landmark missing');
 }
 for(const tag of ['Svg','SvgGradient','Polygon','Rect','Path','Circle','Ellipse'])
  assert.ok(renderer.includes(tag),'missing illustration layer '+tag);
 assert.match(renderer,/KingdomLandmark id=\{id\}/);
 assert.doesNotMatch(renderer,/fetch\(|supabase|new Audio|setTimeout|Animated.loop/);
});
test('Station scenes and selected Kingdom scenery are visible but do not leak unreleased glossary text',()=>{
 assert.match(portal,/<GenesisKingdomStationScene id=\{realm.id\}\/>/);
 assert.match(portal,/<GenesisKingdomStationScene id=\{selected.id\} mode="hero"\/>/);
 assert.match(portal,/KINGDOM_NATURE_HIGH/);
 assert.match(portal,/KINGDOM_NATURE_COMPACT/);
 assert.match(portal,/kingdomAdFooter/);
 assert.doesNotMatch(portal,/KL_KINGDOM_VISUAL_MOTIFS\[.*\]\.dictionaryTerm/);
 assert.doesNotMatch(portal,/dictionaryByName\(/);
});
test('No changes in earned BP, game results, character level or original routes',()=>{
 assert.match(portal,/router\.push\(\('\/games\/' \+ realm\.id\) as any\)/);
 assert.match(portal,/loadBuklodKingdomPreviewProgress\(userId\)/);
 assert.match(portal,/kingdom_map_footer/);
 assert.doesNotMatch(motifs+renderer,/awardBp|grantBp|supabase\.rpc|payment|diamondTransfer/i);
});
