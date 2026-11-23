import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const record=JSON.parse(readFileSync(new URL('../.buklod/reconciliations/genesis-206-mainline-carryover-20261124.json',import.meta.url),'utf8'));
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function blob(ref,p){
  const out=execFileSync('git',['ls-tree','-r',ref,'--',p],{encoding:'utf8'}).trim();
  assert.ok(out.includes('\t'+p),'Source path missing '+p);
  const sha=out.split(/\\s+/)[2];
  assert.match(sha,/^[a-f0-9]{40}$/);
  return sha;
}
test('MAIN 12 commits are actually part of manual Genesis merge history',()=>{
  assert.equal(record.fileCount,94);
  assert.equal(record.exactCount,86);
  assert.equal(record.intentionalDivergences,8);
  execFileSync('git',['merge-base','--is-ancestor',record.mainCommit,'HEAD']);
  const current=execFileSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).trim();
  assert.equal(current,record.mainCommit,'Production MAIN drift needs reconciliation again');
});
test('94 MAIN changed paths are either identical or explicitly frozen newer Genesis implementations',()=>{
  assert.equal(record.files.length,94);
  const out=record.files.filter(f=>f.resolution!=='EXACT_MAIN_BLOB');
  assert.equal(out.length,8);
  for(const f of record.files){
    assert.equal(blob(record.mainCommit,f.path),f.mainBlob,'Main identity drift '+f.path);
    assert.equal(blob('HEAD',f.path),f.genesisBlob,'Genesis source changed without parity review '+f.path);
    if(f.resolution==='EXACT_MAIN_BLOB') assert.equal(f.mainBlob,f.genesisBlob);
    else {
      assert.notEqual(f.mainBlob,f.genesisBlob);
      assert.ok(f.reason.length>30);
      for(const token of f.proof) assert.ok(read(f.path).includes(token),'Missing feature '+f.path+': '+token);
    }
  }
});
test('Source reconciliation never authorizes staging OTA, production or DB migration',()=>{
  const hold=JSON.parse(read('.buklod/releases/genesis-206-unified-native-conso-hold-20261124.json'));
  assert.equal(hold.status,'BLOCKED_BEFORE_RELEASE');
  assert.equal(hold.safety.autoPublish,false);
  assert.equal(hold.safety.productionUnchanged,true);
  assert.equal(hold.source.mainCommitsNotCarried,0);
  assert.equal(hold.nativeTarget.kind,'local-native-no-expo');
});
