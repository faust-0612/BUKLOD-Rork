import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
const ids=catalog.characters.flatMap(c=>c.games.map(g=>g.id));
const atlas=read('src/features/games/kingdom/platform/KingdomGameSpriteAtlas.tsx');
const scene=read('src/features/games/kingdom/platform/KingdomCinematicScene.native.tsx');
test('39 original and pilot game IDs map to individually cropped image-generated local atlas cells',()=>{
 assert.equal(ids.length,39);
 assert.equal(new Set(ids).size,39);
 const all=[...atlas.matchAll(/^  "([^"]+)",?$/gm)].map(x=>x[1]);
 assert.deepEqual(all,ids);
 assert.match(atlas,/const COLS=6,ROWS=7,WIDTH=840,HEIGHT=815/);
 assert.match(atlas,/index%COLS/);
 assert.match(atlas,/Math.floor\(index\/COLS\)/);
 assert.match(scene,/<KingdomGameSpriteAtlas gameId=\{gameId\}/);
});
test('generated artwork is ACTUALLY bundled and has a valid RIFF/WEBP header; zero streaming',()=>{
 const data=readFileSync(new URL('../assets/season2/genesis/kingdom/kingdom-39-game-illustration-atlas.webp',import.meta.url));
 assert.equal(data.length,180638);
 assert.equal(data.toString('ascii',0,4),'RIFF');
 assert.equal(data.toString('ascii',8,12),'WEBP');
 assert.match(atlas,/require\('\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/assets\/season2\/genesis\/kingdom\/kingdom-39-game-illustration-atlas\.webp'\)/);
 assert.match(atlas,/onError=\{\(\)=>setFailed\(true\)\}/);
 assert.match(scene,/KingdomPremiumWorldArt/);
 assert.match(scene,/KingdomHeroArt/);
 assert.doesNotMatch(atlas,/https?:|fetch\(|supabase|awardBp|mintShards/);
});

test('special Christian and Mitch centers display the selected original/pilot illustration and preserve gameplay',()=>{
 const christian=read('src/app/games/christian-civic-leadership.tsx');
 const mitch=read('src/app/games/mitch-restore-mural.tsx');
 for(const s of [christian,mitch]){
   assert.match(s,/<KingdomCinematicScene key=\{activeArtGameId\} gameId=\{activeArtGameId\} compact/);
   assert.match(s,/playRorkSignatureSfx/);
   assert.match(s,/recordKingdomPreviewResult/);
   assert.match(s,/recordBuklodKingdomPreviewResult/);
   assert.doesNotMatch(s,/awardBp|mintShards|creditPoints/);
 }
});
