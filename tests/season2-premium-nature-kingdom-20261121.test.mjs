import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const root=resolve(import.meta.dirname,'..');
const read=(p)=>readFileSync(resolve(root,p),'utf8');
const variants=[
 ['assets/season2/genesis/kingdom/kingdom-nature-panorama.webp',1536,864,'232c99e995fafde2e018a286f998a39917de32620ee502c8486ca58a1eabf8eb'],
 ['assets/season2/genesis/kingdom/kingdom-nature-panorama-compact.webp',960,540,'5e7ed0af9568aa6f9cc8d6753015b3c8ac36fd4e070541d43f017d88975fcc95'],
];
test('Bundled original nature-first assets have verified lossless transport and correct 16:9 dimensions',()=>{
 for(const [p,width,height,expectedHash] of variants){
  const b=readFileSync(resolve(root,p));
  assert.equal(b.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(b.subarray(8,12).toString('ascii'),'WEBP');
  const vp8=b.indexOf(Buffer.from([0x9d,0x01,0x2a]));
  assert.ok(vp8>=0,'WebP VP8 frame absent: '+p);
  assert.equal(b.readUInt16LE(vp8+3)&0x3fff,width,p);
  assert.equal(b.readUInt16LE(vp8+5)&0x3fff,height,p);
  assert.equal(createHash('sha256').update(b).digest('hex'),expectedHash,p);
 }
});
test('Season 2 Kingdom is a local nature-first panorama, not generic floral/remote-host wallpaper',()=>{
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 assert.match(portal,/KINGDOM_NATURE_HIGH/);
 assert.match(portal,/KINGDOM_NATURE_COMPACT/);
 assert.match(portal,/getGenesisDeviceQuality\('kingdom'\)/);
 assert.match(portal,/aspectRatio:16\/9/);
 assert.match(portal,/contentFit="cover"/);
 assert.match(portal,/Tropical Valleys · Winter Peaks/);
 assert.doesNotMatch(portal,/media\?\.background|uri:media\.background|getRorkGameMedia/);
 const games=read('src/app/games/index.tsx');
 assert.match(games,/genesisPreview \? <GenesisKingdomPortal \/> : <BuklodKingdomMap \/>/);
 assert.match(games,/BuklodKingdomAdSlot/);
});
test('Season 2 includes in-app Arena practice and preserves canonical production Kingdom',()=>{
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 const arena=read('src/app/games/empire-arena.tsx');
 assert.match(portal,/\/games\/empire-arena/);
 assert.equal(requireArenaRouteExists(),true,'Arena route is bundled in the existing app');
 assert.equal(requireArenaEngineExists(),true,'The deterministic practice engine is bundled');
 assert.match(arena,/EmpireArenaRouteGuard/);
 assert.match(arena,/isGenesisPreviewBuild\(\)/);
 assert.doesNotMatch(portal,/supabase\.|\.rpc\(|awardBp|awardDiamond|eas update/i);
});
function requireArenaRouteExists(){return existsSync(resolve(root,'src/app/games/empire-arena.tsx'));}
function requireArenaEngineExists(){return existsSync(resolve(root,'experiments/empire-arena-v2/arena-v2-engine.mjs'));}

test('Kingdom character motion is original local art, bounded by active/focus and Reduce Motion',()=>{
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 const idle=read('src/features/season2/genesis/GenesisRiveCharacter.tsx');
 assert.match(portal,/const animate = focused && foreground && !reduceMotion/);
 assert.match(portal,/GenesisRiveCharacter active={animate}/);
 assert.match(idle,/if \(!active\) return;/);
 assert.match(idle,/useNativeDriver:true/);
 assert.match(idle,/animation\.stop\(\)/);
 assert.match(idle,/fallback\?\?null/);
 assert.doesNotMatch(idle,/require\([^)]*\.riv/);
 assert.match(portal,/landmark:\{position:'absolute',width:44,height:44/);
});
