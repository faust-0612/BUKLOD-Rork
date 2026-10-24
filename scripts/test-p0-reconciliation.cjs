const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(file, mocks) {
  const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
  assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, file);
  const exports = {};
  vm.runInNewContext(result.outputText, {exports, require: name => {assert.ok(name in mocks, name); return mocks[name];}, console, Date, Map, Set, setTimeout, clearTimeout});
  return exports;
}
(async () => {
  let session = {user:{id:'alice'}, access_token:'test', expires_at: Date.now()/1000+3600};
  let rpcCalls=0, refreshCalls=0;
  const supabase={auth:{getSession:async()=>({data:{session},error:null}), refreshSession:async()=>{refreshCalls++; return {data:{session},error:null};}},rpc:async()=>{rpcCalls++;return {data:{active_character_id:'christian'},error:null};}};
  const character=load('src/lib/buklodCharacterSelectionV2.ts',{'@/lib/supabase':{supabase}});
  await assert.rejects(character.getMyBuklodCharacterSelectionV2('bob',true));
  assert.equal(rpcCalls,0,'wrong account must not call RPC');
  await Promise.all([character.getMyBuklodCharacterSelectionV2('alice',true),character.getMyBuklodCharacterSelectionV2('alice',true)]);
  assert.equal(rpcCalls,1,'concurrent reads deduplicate');
  assert.equal(refreshCalls,0,'healthy session adds no refresh request');
  session={...session,expires_at:1};
  await character.setMyBuklodCharacterActiveV2('alice','christian');
  assert.equal(refreshCalls,1,'activation validates session');
  session=null;
  await assert.rejects(character.setMyBuklodCharacterActiveV2('alice','christian'));
  assert.equal(rpcCalls,2,'missing session cannot activate');
  let tableCalls=0;
  const row={id:'11111111-1111-1111-1111-111111111111',scope_id:'scope',starts_at:'2026-10-24',title:'Test'};
  const attendance=load('src/lib/buklodAttendanceEvents.ts',{
    '@/lib/supabase':{supabase:{from:()=>{tableCalls++;throw Error('redundant table read');}}},
    '@/lib/buklodScope':{rpcWithArgFallback:async()=>({data:[row],error:null})},
    '@react-native-async-storage/async-storage':{default:{setItem:async()=>{},getItem:async()=>null}},
  });
  assert.equal((await attendance.listBuklodAttendanceEvents('scope')).length,1);
  assert.equal(tableCalls,0,'canonical RPC results avoid redundant table requests');
  console.log('PASS: Character session, refresh, read deduplication; Attendance RPC fast path');
})().catch(error=>{console.error(error);process.exitCode=1;});
