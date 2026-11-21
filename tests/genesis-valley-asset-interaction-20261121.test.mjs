import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const src=p=>readFileSync(resolve(root,p),'utf8');
const metadata=JSON.parse(src('src/features/season2/genesis/genesisValleyHotspots.json'));
const mapSrc=src('src/features/season2/genesis/GenesisValleyMap.tsx');
const gateway=src('src/app/buklod-map.tsx');

test('owner-approved landscape art is bundled with pinned checksum, not changed into a guide composite',()=>{
  const path='assets/season2/genesis/world/buklod-season2-entry-map-approved.webp';
  const raw=readFileSync(resolve(root,path));
  assert.equal(raw.length,473226);
  assert.equal(raw.toString('ascii',0,4),'RIFF');
  assert.equal(raw.toString('ascii',8,12),'WEBP');
  assert.equal(createHash('sha256').update(raw).digest('hex'),
    'a343c70d1c71e849b536570bd92ede7134667d40347f6465003d41710e818b02');
  assert.equal(metadata.assetPath,path);
  assert.match(mapSrc,/buklod-season2-entry-map-approved.webp/);
  assert.match(mapSrc,/const MAP_ASPECT = 941 \/ 1672/);
  assert.match(mapSrc,/const LOW_RAM = HIGH_RES/);
});
test('all 12 approved landmarks open exactly one existing destination each',()=>{
  const hs=metadata.hotspots,ids=new Set(hs.map(h=>h.id));
  assert.equal(hs.length,12);
  assert.equal(ids.size,12);
  assert.equal(metadata.coordinateSystem,'normalized-image-top-left');
  const districts=src('src/features/season2/genesis/genesisMapDistricts.ts');
  for(const h of hs){
    assert.ok(h.x>0.05&&h.x<0.96&&h.y>0.10&&h.y<0.91,h.label);
    assert.match(h.route,/^\/[a-z0-9/-]+$/);
    assert.ok(districts.includes("id: '"+h.districtId+"'"),h.districtId);
    assert.ok(districts.includes("route: '"+h.route+"'"),h.route);
    const p='src/app/'+h.route.slice(1);
    assert.ok(existsSync(resolve(root,p+'.tsx'))||existsSync(resolve(root,p+'/index.tsx'))
      ||existsSync(resolve(root,'src/app/(tabs)/'+h.route.slice(1)+'.tsx')),h.route);
  }
  assert.equal(hs.find(x=>x.id==='cluster-village').route,'/season2/community-village');
  assert.equal(hs.find(x=>x.id==='family-homes').route,'/season2/my-world');
  assert.equal(hs.find(x=>x.id==='empire-arena').route,'/games/empire-arena');
  assert.equal(hs.find(x=>x.id==='character-kingdom').route,'/games');
});
test('tapping landmarks routes immediately and the character guide is OUTSIDE map content',()=>{
  assert.match(gateway,/router\.push\(hotspot\.route as any\)/);
  assert.match(gateway,/lastDoorTap/);
  assert.match(gateway,/BuklodFirstViewAd placement="home"/);
  assert.match(mapSrc,/const diameter = zoomed \? 48 : 44/);
  assert.match(mapSrc,/isReduceMotionEnabled/);
  assert.ok(gateway.indexOf('</ScrollView>')<gateway.indexOf('<BuklodMapGuideDock'));
  assert.doesNotMatch(gateway,/(service_role|supabase\.rpc|claimBp|mintBp|awardBp)/i);
});
test('narrow Android 44px hit targets stay within landscape image bounds',()=>{
  const width=280,height=width*941/1672,diameter=44;
  for(const h of metadata.hotspots){
    const x=Math.max(diameter/2,Math.min(width-diameter/2,h.x*width));
    const y=Math.max(diameter/2,Math.min(height-diameter/2,h.y*height));
    assert.ok(x-diameter/2>=0&&x+diameter/2<=width,h.id);
    assert.ok(y-diameter/2>=0&&y+diameter/2<=height,h.id);
  }
});
