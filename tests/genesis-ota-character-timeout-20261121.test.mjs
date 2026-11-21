import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const deadlineSource=read('src/lib/buklodCharacterReadDeadline.ts');
const selection=read('src/lib/buklodCharacterSelectionV2.ts');
const host=read('src/components/BuklodOtaFreshnessHost.native.tsx');
const policy=read('src/lib/buklodSilentOtaPolicy.ts');
test('Character session and RPC have bounded read-only deadlines',()=>{
 assert.match(selection,/withBuklodCharacterReadDeadline\(ensureCharacterSession\(userId\)/);
 assert.match(selection,/get_my_buklod_character_selection_v2/);
 assert.match(selection,/CHARACTER_SELECTION_DEADLINE_MS/);
 assert.match(deadlineSource,/Promise\.race/);
 assert.match(deadlineSource,/clearTimeout\(timer\)/);
});
test('A never-resolving Character backend does not strand the sheet forever',async()=>{
 const stripped=stripTypeScriptTypes(deadlineSource,{mode:'strip'});
 const lib=await import('data:text/javascript,'+encodeURIComponent(stripped));
 await assert.rejects(lib.withBuklodCharacterReadDeadline(new Promise(()=>{}),18,'selection'),/timed out/);
 assert.equal(await lib.withBuklodCharacterReadDeadline(Promise.resolve(5),35,'selection'),5);
 await assert.rejects(lib.withBuklodCharacterReadDeadline(Promise.reject(new Error('server-down')),30,'selection'),/server-down/);
});
test('Genesis checks for a missed OTA early without force restarting calls or changing production interval',()=>{
 assert.match(policy,/GENESIS_OTA_INITIAL_CHECK_MS = 45 \* 1000/);
 assert.match(policy,/initialCheckDelayMs = checkIntervalMs/);
 assert.match(host,/isGenesisPreviewBuild\(\) \? GENESIS_OTA_INITIAL_CHECK_MS : undefined/);
 assert.match(host,/AppState\.currentState === 'active'/);
 assert.doesNotMatch(host,/Updates\.reloadAsync/);
});
