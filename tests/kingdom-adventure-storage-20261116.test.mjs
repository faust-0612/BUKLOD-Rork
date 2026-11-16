import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
// Full behavior test without external TypeScript dependency on the small GitHub scope gate.
const work=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-adventure-test-'));
const src=relative=>fs.readFileSync(new URL('../'+relative,import.meta.url),'utf8');
fs.writeFileSync(path.join(work,'buklodCharacterAdventure.mjs'),stripTypeScriptTypes(
  src('src/lib/buklodCharacterAdventure.ts'),{mode:'transform'}));
fs.writeFileSync(path.join(work,'memory-storage.mjs'),`export const files=new Map();
export default {
 async getItem(k){return files.get(k)??null},
 async setItem(k,v){await new Promise(r=>setImmediate(r));files.set(k,v)}
};`);
let storeCode=stripTypeScriptTypes(src('src/lib/buklodCharacterAdventureStore.ts'),{mode:'transform'});
storeCode=storeCode.replace("'@react-native-async-storage/async-storage'","'./memory-storage.mjs'")
 .replace("'./buklodCharacterAdventure'","'./buklodCharacterAdventure.mjs'");
fs.writeFileSync(path.join(work,'buklodCharacterAdventureStore.mjs'),storeCode);
const url=file=>pathToFileURL(path.join(work,file)).href;
const [{default:storage,files},store]=await Promise.all([
 import(url('memory-storage.mjs')),import(url('buklodCharacterAdventureStore.mjs')),
]);
after(()=>fs.rmSync(work,{recursive:true,force:true}));
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
