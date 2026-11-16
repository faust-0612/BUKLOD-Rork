import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=path.resolve(import.meta.dirname,'..');
const atlas=JSON.parse(fs.readFileSync(path.join(root,'content/kingdom-item-classes-v1.json'),'utf8'));
const cls=Object.fromEntries(atlas.groups.map(x=>[x.id,x]));
const items=Object.fromEntries(atlas.items.map(x=>[x.id,x]));

test('20 six-item classes and 120 unique identifiers are complete as design specs',()=>{
 assert.equal(atlas.groups.length,20);
 assert.equal(atlas.items.length,120);
 assert.equal(new Set(atlas.groups.map(x=>x.id)).size,20);
 assert.equal(new Set(atlas.items.map(x=>x.id)).size,120);
 assert.ok(atlas.groups.every(x=>x.items.length===6 && x.items.every(y=>items[y]?.classId===x.id)));
});
test('exactly seven distinct owner-supplied class images with 42 cropped labelled items',()=>{
 const supplied=atlas.groups.filter(x=>x.status==='art_supplied');
 assert.equal(supplied.length,7);
 assert.equal(atlas.items.filter(x=>x.source==='reference_image').length,42);
 for (const group of supplied) {
  assert.ok(group.reference && group.poster);
  assert.ok(fs.existsSync(path.join(root,'assets/images/kingdom-classes',group.poster)));
  for(const id of group.items){
   const item=items[id];
   assert.ok(item.asset && fs.existsSync(path.join(root,'assets/images/kingdom-classes',item.asset)));
  }
 }
 assert.equal(atlas.groups.filter(x=>x.status==='unverified_eighth_concept').length,1);
});
test('all 12 requested future classes are present without pretending art is shipped',()=>{
 const planned=['armor','accessory','character_evolution','companion','skill','crafting','kingdom_building','exploration','quest','season','prestige','profile_cosmetic'];
 for(const id of planned){
  assert.equal(cls[id].status,'new_design_concept');
  assert.equal(cls[id].items.length,6);
  assert.equal(cls[id].poster,null);
 }
});
test('visual cards do not mint any item entitlement, payment or trade',()=>{
 for(const item of atlas.items) {
  assert.equal(item.implemented,false);
  assert.ok(item.requirement.length>15 && item.usage.length>15);
  assert.ok(['bound','craft_material','duplicate_cosmetic'].includes(item.tradePolicy));
 }
 const app=fs.readFileSync(path.join(root,'src/components/kingdom/BuklodKingdomClassGallery.tsx'),'utf8');
 assert.match(app,/tradeReadiness\(item\)/);
 assert.match(app,/Preview only/);
 assert.doesNotMatch(app,/supabase|rpc\(|buyMy|redeemMy/);
});
test('render code is syntactically valid TSX without changing the existing official game routes',()=>{
 for(const file of [
  'src/lib/buklodKingdomClassArt.ts',
  'src/lib/buklodKingdomClassCatalog.ts',
  'src/components/kingdom/BuklodKingdomClassGallery.tsx',
  'src/app/games/character-experience.tsx',
 ]){
  const src=fs.readFileSync(path.join(root,file),'utf8');
  const result=ts.transpileModule(src,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.deepEqual((result.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error).map(x=>x.messageText),[],file);
 }
 const adventure=fs.readFileSync(path.join(root,'src/app/games/character-experience.tsx'),'utf8');
 assert.match(adventure,/<BuklodKingdomCoreAtlas\s*\/>/);
 const atlasRoute=fs.readFileSync(path.join(root,'src/app/games/item-atlas.tsx'),'utf8');
 assert.match(atlasRoute,/<BuklodKingdomClassGallery\s*\/>/);
 assert.match(adventure,/ITEM ATLAS/);
});
test('no supplied screenshots show the 8th class and no simulated artwork claims it is owned',()=>{
 assert.equal(cls.weapon.status,'unverified_eighth_concept');
 assert.ok(cls.weapon.items.every(id=>items[id].asset===null));
 assert.equal(atlas.assetsSupplied,42);
 assert.equal(atlas.referenceCount,7);
});
