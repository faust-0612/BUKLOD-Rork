import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
const games=catalog.characters.flatMap(c=>c.games.map(g=>g.id));
const art=read('src/features/games/kingdom/platform/KingdomPremiumWorldArt.tsx');
const cinematic=read('src/features/games/kingdom/platform/KingdomCinematicScene.native.tsx');
test('each of 39 Kingdom games has its OWN authored vector motif with consistent environment',()=>{
 assert.equal(games.length,39);
 assert.equal(new Set(games).size,39);
 for(const id of games){
   assert.match(art,new RegExp("'"+id+"': \\{biome:"));
 }
 assert.equal((art.match(/: \\{biome:/g)||[]).length,39);
 assert.equal((art.match(/motif:'/g)||[]).length,39);
 const motifs=[...art.matchAll(/motif:'([^']+)'/g)].map(x=>x[1]);
 assert.equal(new Set(motifs).size,39);
 assert.match(cinematic,/<KingdomPremiumWorldArt gameId=\{gameId\}/);
 assert.match(cinematic,/KingdomHeroArt/);
 assert.match(cinematic,/KineticGlyph/);
});
test('premium art is locally authored, offline-capable and financial authority neutral',()=>{
 assert.match(art,/react-native-svg/);
 assert.match(art,/pointerEvents="none"/);
 assert.match(art,/preserveAspectRatio="xMidYMid slice"/);
 assert.doesNotMatch(art,/https?:|fetch\(|supabase|awardBp|grantBp|qmp|diamond|setInterval/);
});
