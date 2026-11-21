import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const src=p=>readFileSync(resolve(root,p),'utf8');
const image=p=>readFileSync(resolve(root,p));
const metadata=JSON.parse(src('src/features/season2/genesis/genesisValleyHotspots.json'));
const districts=src('src/features/season2/genesis/genesisMapDistricts.ts');
const img='assets/season2/genesis/world/';

test('The actual 1448 and 1024 WebP image bytes are bundled with pinned SHA256',()=>{
 const samples=[
  ['buklod-community-map.webp','1ecc69c1886eebc18ad5cc3971c944e3bceee65a757b85a2fcf1c91bf5d2dd0c',606068],
  ['buklod-community-map-compact.webp','226465e86d69b99a4666ba934c1b90690dc04d2fce4a768ea4e6cda0a089f88a',340178],
 ];
 for(const [name,digest,bytes] of samples){
  const raw=image(img+name);
  assert.equal(raw.length,bytes);
  assert.equal(raw.toString('ascii',0,4),'RIFF');
  assert.equal(raw.toString('ascii',8,12),'WEBP');
  assert.equal(createHash('sha256').update(raw).digest('hex'),digest);
 }
});

test('All 14 tappable targets match owner map positions, district taxonomy and real routes',()=>{
 const hs=metadata.hotspots;
 assert.equal(metadata.coordinateSystem,'normalized-image-top-left');
 assert.equal(hs.length,14);
 assert.equal(new Set(hs.map(h=>h.id)).size,hs.length);
 for(const h of hs){
  assert.ok(h.x>0.07&&h.x<0.95&&h.y>0.10&&h.y<0.80,h.id);
  assert.match(h.route,/^\/[a-z/-]+$/);
  assert.ok(districts.includes("id: '"+h.districtId+"'"),h.districtId);
  assert.ok(districts.includes("route: '"+h.route+"'"),h.route);
  const path='src/app/'+h.route.slice(1);
  assert.ok(existsSync(resolve(root,path+'.tsx'))||existsSync(resolve(root,path+'/index.tsx'))
   ||existsSync(resolve(root,path+'.native.tsx'))||existsSync(resolve(root,'src/app/(tabs)/'+h.route.slice(1)+'.tsx')),h.route);
 }
 assert.deepEqual(hs.filter(h=>h.faithOnly).map(h=>h.id),['faith-center']);
 assert.equal(hs.find(h=>h.id==='community-wall-plaza')?.route,'/buklod');
 assert.equal(hs.find(h=>h.id==='government-hall')?.route,'/profile/focus-apps');
 assert.equal(metadata.positionAuthority.includes('gold-icon centers'),true);
 assert.deepEqual([hs.find(h=>h.id==='cluster-village')?.x,hs.find(h=>h.id==='cluster-village')?.y],[0.057,0.318]);
});

test('Map is imagery-first with touch/zoom, visual selected state, faith gating and accessible directory',()=>{
 const comp=src('src/features/season2/genesis/GenesisValleyMap.tsx');
 const gateway=src('src/app/buklod-map.tsx');
 assert.match(comp,/HIGH_RES = require\(/);
 assert.match(comp,/LOW_RAM = require\(/);
 assert.match(comp,/horizontal/);
 assert.match(comp,/scrollTo\(/);
 assert.match(comp,/accessibilityRole="button"/);
 assert.match(comp,/!h.faithOnly \|\| showFaith/);
 assert.match(comp,/Animated\.loop/);
 assert.match(comp,/isReduceMotionEnabled/);
 assert.match(comp,/getGenesisDeviceQuality/);
 assert.match(gateway,/GENESIS_VALLEY_HOTSPOTS/);
 assert.match(gateway,/selectedHotspot\?\.route \?\? district.destination/);
 assert.match(gateway,/visibleBuklodMapDestinations\(area, showFaith\)/);
 assert.match(gateway,/BuklodFirstViewAd placement="home"/);
 assert.doesNotMatch(gateway,/<GenesisMapOrbit|<Svg |<View style=\{styles\.constellation\}>/);
 assert.doesNotMatch(gateway,/(service_role|supabase\.rpc|claimBp|mintBp|awardBp)/i);
});
