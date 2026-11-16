import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
const rel=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(rel('content/kingdom-item-atlas-core-v2.json'));
const provenance=JSON.parse(rel('content/kingdom-item-atlas-art-provenance.json'));

test('canonical 20 classes and all 120 items match owner library collection board',()=>{
 assert.equal(manifest.classCount,20);
 assert.equal(manifest.itemCount,120);
 assert.equal(manifest.classes.length,20);
 assert.deepEqual(manifest.classes.map(c=>c.id),provenance.classes.map(c=>c.id));
 assert.equal(manifest.classes.reduce((n,c)=>n+c.items.length,0),120);
 const ids=manifest.classes.flatMap(c=>c.items.map((_,i)=>`${c.id}-${String(i+1).padStart(2,'0')}`));
 assert.equal(new Set(ids).size,120);
 assert.ok(manifest.classes.every(c=>c.items.length===6&&c.baseRequirement&&c.use));
});
test('every static sprite is a real 3x2 WebP with verified checksum and size',()=>{
 assert.equal(provenance.classes.length,20);
 assert.deepEqual(provenance.cellsPerClass,[3,2]);
 for(const p of provenance.classes){
  const f=path.join(root,'assets/images/kingdom-item-atlas',p.assetFile);
  const bytes=fs.readFileSync(f);
  assert.ok(bytes.length>4000 && bytes.length<100000,`Unexpected asset budget for ${p.id}`);
  assert.equal(bytes.subarray(0,4).toString(),'RIFF');
  assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),p.sha256,`Asset hash ${p.id}`);
  assert.equal(p.items.length,6);
  const expected=manifest.classes.find(c=>c.id===p.id);
  assert.deepEqual(p.items,expected.items,`Art/text pairing ${p.id}`);
 }
});
test('asset registry contains exactly one static require per class for Metro and remains deterministic',()=>{
 const source=rel('src/lib/buklodKingdomCoreAtlasArt.ts');
 for(const p of provenance.classes){
  assert.ok(source.includes(`'${p.id}':require('../../assets/images/kingdom-item-atlas/${p.id}.webp')`),p.id);
 }
 assert.equal((source.match(/require\('\.\.\/\.\.\/assets\/images\/kingdom-item-atlas\//g)||[]).length,20);
 assert.doesNotMatch(source,/https?:\/\/|dynamicImport|import\(/);
});
test('read-only guide has requirements, use, disabled trade, and explicit art-only labels',()=>{
 const source=rel('src/lib/buklodKingdomCoreAtlas.ts');
 const view=rel('src/components/kingdom/BuklodKingdomCoreAtlas.tsx');
 assert.match(source,/trade:'DISABLED'/);
 assert.match(source,/status:'ART_PREVIEW'/);
 assert.match(view,/PAANO MAKUKUHA/);
 assert.match(view,/SAAN GAGAMITIN/);
 assert.match(view,/Hindi pa tradeable o claimable/);
 assert.match(view,/artFrame/);
 assert.match(view,/onPress=\{\(\)=>setItemIndex\(i\)\}/);
 for(const code of [source,view])assert.doesNotMatch(code,/supabase\.rpc|buyMyKingdom|finance|withdraw|sendMoney/);
});
test('both complete core atlas and existing 7 classic image groups are accessible as separate tabs',()=>{
 const route=rel('src/app/games/item-atlas.tsx');
 const legacy=rel('src/components/kingdom/BuklodKingdomClassGallery.tsx');
 assert.match(route,/<BuklodKingdomCoreAtlas\s*\/>/);
 assert.match(route,/<BuklodKingdomClassGallery\s*\/>/);
 assert.match(route,/setLibrary\('core'\)/);
 assert.match(route,/setLibrary\('legacy'\)/);
 assert.match(legacy,/LEGACY_CLASSES=VISUAL_CLASSES\.filter\(c=>c\.status==='art_supplied'\)/);
});
test('typed catalog strips under Node22 and UI has explicit accessible interactive routes',()=>{
 for(const f of ['src/lib/buklodKingdomCoreAtlas.ts','src/lib/buklodKingdomCoreAtlasArt.ts']){
  assert.ok(stripTypeScriptTypes(rel(f),{mode:'transform'}).length>200);
 }
 for(const f of ['src/components/kingdom/BuklodKingdomCoreAtlas.tsx','src/app/games/item-atlas.tsx',
   'src/app/games/character-experience.tsx']){
  const source=rel(f);
  assert.match(source,/export default function/);
  assert.match(source,/accessibilityRole="button"/);
  assert.match(source,/onPress=/);
 }
 // Full TSX compile is intentionally not represented as tested here.
});
