import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createKingdomProgressController, kingdomAccountKey, emptyKingdomPreviewProgress,
} from '../src/features/games/kingdom/progressController.ts';

const USER_A = 'a0f716ed-12ef-4e72-9475-5e3cbf9229a0';
const USER_B = 'b0f716ed-12ef-4e72-9475-5e3cbf9229a0';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const success = {gameId:'christian-civic-leadership',status:'won',score:330,stars:3,reward:{xp:12345,kingdomXp:99999}};
function storage() {
 const backing=new Map(),reads=[],writes=[];
 return {
  backing,reads,writes,
  getItem:async key=>{reads.push(key);return backing.get(key)??null;},
  setItem:async (key,value)=>{writes.push(key);backing.set(key,value);},
 };
}

test('R13: legacy 13-station progress is strictly isolated by signed-in account, including same receipts',async()=>{
 const db=storage();
 let now=1_000_000;
 const c=createKingdomProgressController(db,()=>now);
 assert.notEqual(kingdomAccountKey(USER_A),kingdomAccountKey(USER_B));
 assert.equal(kingdomAccountKey('not-a-uuid'),null);
 const a=[],b=[];
 const unA=c.subscribe(USER_A,p=>a.push(p));
 const unB=c.subscribe(USER_B,p=>b.push(p));
 assert.deepEqual(await c.load(USER_A),emptyKingdomPreviewProgress());
 assert.deepEqual(await c.load(USER_B),emptyKingdomPreviewProgress());
 const [first,second]=await Promise.all([c.record(USER_A,success),c.record(USER_B,success)]);
 assert.equal(first.stations[success.gameId].clears,1);
 assert.equal(second.stations[success.gameId].clears,1);
 assert.equal(a.length,1);assert.equal(b.length,1);
 assert.equal(db.writes.length,2,'same result in two different accounts is not deduplicated across users');
 assert.ok(db.writes.every(k=>k.includes('preview.progress.account.v2/')));
 assert.ok(![...db.reads,...db.writes].includes('buklod.kingdom.preview.progress.v1'));
 assert.equal(JSON.parse(db.backing.get(kingdomAccountKey(USER_A))).stations[success.gameId].bestScore,330);
 assert.equal(db.backing.get(kingdomAccountKey(USER_A)).includes('kingdomXp'),false,'never persist client rewards');
 assert.equal(db.backing.get(kingdomAccountKey(USER_A)).includes('"xp"'),false);
 now+=120;
 const repeat=await c.record(USER_A,success);
 assert.equal(repeat.stations[success.gameId].clears,1,'same finish callback not double-counted');
 assert.equal(a.length,1);assert.equal(b.length,1);
 now+=2000;
 const replay=await c.record(USER_A,success);
 assert.equal(replay.stations[success.gameId].clears,2,'legitimate replay outside duplicate window counts');
 assert.equal((await c.load(USER_B)).stations[success.gameId].clears,1,'B state unaffected by A replay');
 assert.equal(a.length,2);assert.equal(b.length,1);
 unA();unB();
});

test('R13: simultaneous same-account finishes serialize and do not lose independent station clears',async()=>{
 const db=storage();
 let now=3_000_000;
 const c=createKingdomProgressController(db,()=>now++);
 const another={gameId:'mitch-restore-mural',status:'won',score:235,stars:2,reward:{xp:0,kingdomXp:0}};
 await Promise.all([c.record(USER_A,success),c.record(USER_A,another),c.record(USER_A,success)]);
 const result=await c.load(USER_A);
 assert.equal(result.stations[success.gameId].clears,1,'same instant completion is deduplicated');
 assert.equal(result.stations[another.gameId].clears,1,'independent completion is not dropped');
 assert.equal(db.writes.length,2,'no lost-write race');
 assert.equal(Object.keys(result.stations).length,2);
});

test('R13: logout/guest and malformed IDs can never read or modify any stored account progress',async()=>{
 const db=storage();
 const c=createKingdomProgressController(db);
 await c.record(USER_A,success);
 const before=db.writes.length;
 assert.deepEqual(await c.load(null),emptyKingdomPreviewProgress());
 assert.deepEqual(await c.load(undefined),emptyKingdomPreviewProgress());
 assert.deepEqual(await c.record(null,success),emptyKingdomPreviewProgress());
 assert.deepEqual(await c.record('evil-unsafe-account',success),emptyKingdomPreviewProgress());
 assert.equal(c.getCached(USER_B),null);
 assert.equal(c.getCached(null),null);
 assert.equal(db.writes.length,before);
 assert.equal(c.subscribe(null,()=>{throw Error('guest progress listener called');}) instanceof Function,true);
});

test('R13: corrupted local JSON is safely reset for that account without migrating global legacy state',async()=>{
 const db=storage();
 db.backing.set('buklod.kingdom.preview.progress.v1',JSON.stringify({version:1,stations:{'ace-rescue-grid':{gameId:'ace-rescue-grid',clears:125}}}));
 db.backing.set(kingdomAccountKey(USER_A),'broken-json{');
 const c=createKingdomProgressController(db);
 const state=await c.load(USER_A);
 assert.equal(Object.keys(state.stations).length,0);
 assert.equal((await c.load(USER_B)).stations['ace-rescue-grid'],undefined);
 assert.equal(db.reads.includes('buklod.kingdom.preview.progress.v1'),false);
});

test('R13: failed device write does not claim a save, suppress future retry, or notify users',async()=>{
 const db=storage(),events=[];
 let fail=true;
 const io={...db,setItem:async(k,v)=>{if(fail)throw Error('storage offline');return db.setItem(k,v);}};
 const c=createKingdomProgressController(io);
 c.subscribe(USER_A,p=>events.push(p));
 await assert.rejects(c.record(USER_A,success),/storage offline/);
 assert.equal(events.length,0);
 assert.equal((await c.load(USER_A)).stations[success.gameId],undefined);
 fail=false;
 const retry=await c.record(USER_A,success);
 assert.equal(retry.stations[success.gameId].clears,1);
 assert.equal(events.length,1);
});

test('R13: all 39 games retain in-app selection, account isolation and Map back access',()=>{
 const catalog=JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
 assert.equal(catalog.characters.length,13);
 const ids=[];
 for(const center of catalog.characters){
  const route=read('src/app/games/'+center.stationId+'.tsx');
  assert.ok(route.includes('BuklodGameStage'),center.stationId+' stage missing');
  assert.equal(center.games.length,3);
  for(const game of center.games) {
   ids.push(game.id);
   assert.ok(route.includes(game.id),game.id+' absent from existing station');
  }
 }
 assert.equal(new Set(ids).size,39);
 assert.equal(ids.length,39);
 assert.equal(catalog.characters.flatMap(c=>c.games).filter(g=>g.status==='pilot').length,26);
 const map=read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
 assert.ok(map.includes('useAuth()'));
 assert.ok(map.includes('loadBuklodKingdomPreviewProgress(userId)'));
 assert.ok(map.includes('subscribeBuklodKingdomPreviewProgress(userId,'));
 assert.ok(map.includes('setProgress(emptyProgress())'));
 for(const path of ['src/features/games/runtime/BuklodGameStage.native.tsx','src/features/games/runtime/BuklodGameStage.web.tsx']){
  const stage=read(path);
  assert.ok(stage.includes('const userId = user?.id ?? null'),path);
  assert.ok(stage.includes('recordBuklodKingdomPreviewResult(result, userId)'),path);
 }
 for(const path of ['src/features/games/kingdom/platform/KingdomInteriorCenter.tsx',
  'src/app/games/christian-civic-leadership.tsx','src/app/games/mitch-restore-mural.tsx']){
  const center=read(path);
  assert.ok(center.includes("router.replace('/games' as any)"),path);
  assert.ok(center.includes('BACK TO KINGDOM MAP'),path);
 }
 for(const path of ['src/app/games/christian-civic-leadership.tsx','src/app/games/mitch-restore-mural.tsx']){
  assert.ok(read(path).includes('recordBuklodKingdomPreviewResult(result, user?.id ?? null)'),path);
 }
 const progress=read('src/features/games/kingdom/progress.ts');
 assert.ok(progress.includes('createKingdomProgressController'));
 assert.ok(!progress.includes("AsyncStorage.getItem('buklod.kingdom.preview.progress.v1')"));
});

test('R13: interior callback persists original game only for authenticated account', () => {
 const ui=read('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');
 assert.match(ui,/const owner = user\?\.id;\s*if \(!owner\) return;\s*void recordBuklodKingdomPreviewResult\(result, owner\)/);
 assert.doesNotMatch(ui,/recordBuklodKingdomPreviewResult\(result\);/);
});
