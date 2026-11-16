import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const files=new Map();
const storage={
  async getItem(k){return files.get(k)??null;},
  async setItem(k,v){await new Promise(r=>setImmediate(r));files.set(k,v);},
};
function load(relative,imports={}) {
  const file=new URL('../'+relative,import.meta.url);
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true},
    fileName:relative,
  }).outputText;
  const m={exports:{}};
  vm.runInNewContext(js,{module:m,exports:m.exports,
    require(id){if(id==='@react-native-async-storage/async-storage')return {__esModule:true,default:storage};if(imports[id])return imports[id];throw Error('Unmocked '+id);},
    Map,Set,Promise,Date,JSON,Math,Number,Object,String,Array,RegExp,Error,Boolean,setImmediate,
  },{filename:relative});
  return m.exports;
}
const engine=load('src/lib/buklodCharacterAdventure.ts');
const store=load('src/lib/buklodCharacterAdventureStore.ts',{'./buklodCharacterAdventure':engine});
const u1='11111111-1111-4111-8111-111111111111';const u2='22222222-2222-4222-8222-222222222222';
test('account and character isolation; no global progress leakage',async()=>{
  files.clear();
  const a=await store.actOnCharacterAdventure(u1,'phan',{type:'chapter',chapter:0,choice:'heart'});
  assert.equal(a.state.xp,65);
  const other=await store.loadCharacterAdventure(u2,'phan');
  const otherHero=await store.loadCharacterAdventure(u1,'van');
  assert.equal(other.xp,0);assert.equal(otherHero.xp,0);
});
test('concurrent double tap is serialized and only credits a local chapter once',async()=>{
  files.clear();
  const a=await Promise.all(Array.from({length:10},()=>store.actOnCharacterAdventure(u1,'phan',{type:'chapter',chapter:0,choice:'heart'})));
  assert.equal(a.filter(x=>x.changed).length,1);
  const got=await store.loadCharacterAdventure(u1,'phan');
  assert.equal(got.xp,65);assert.equal(got.completed.length,1);
});
test('corrupt data is safely reset as local-only preview',async()=>{
  files.clear();await storage.setItem('buklod:adventure:preview:v1:'+u1+':phan','broken-json');
  const got=await store.loadCharacterAdventure(u1,'phan');
  assert.equal(got.xp,0);assert.equal(got.level,1);
});
test('Manila date is correct over UTC boundary',()=>{
  assert.equal(store.adventureManilaDay(Date.parse('2026-11-15T16:01:00Z')),'2026-11-16');
  assert.equal(store.adventureManilaDay(Date.parse('2026-11-15T15:59:00Z')),'2026-11-15');
});
test('invalid user identity is rejected before accessing shared storage',async()=>{
  await assert.rejects(store.loadCharacterAdventure('not-an-id','phan'),/signed-in/);
});
