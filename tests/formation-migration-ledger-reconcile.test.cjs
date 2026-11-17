const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const directory = path.resolve(__dirname,'../supabase/migrations');
const canonical = [
  ['20261117142009_formation_all_active_scope_reporting_v1_20261117.sql',
   '20261117140200_formation_all_active_scope_reporting_v1.sql'],
  ['20261117142308_formation_scope_resolver_privilege_lock_v1_20261117.sql',
   '20261117142500_formation_scope_resolver_privilege_lock_v1.sql'],
  ['20261117142548_formation_multi_scope_reporting_dedup_v2_20261117.sql',
   '20261117143800_formation_multi_scope_reporting_dedup_v2.sql']
];
test('exactly the three applied Formation versions are present, with no conflicting aliases',()=>{
  for(const [current,old] of canonical){
    assert.ok(fs.existsSync(path.join(directory,current)),current);
    assert.ok(!fs.existsSync(path.join(directory,old)),old+' must not be rerun under a stale version');
  }
  const files=fs.readdirSync(directory);
  const names=canonical.map(([current])=>current.split('_').slice(1).join('_'));
  for(const name of names) {
    assert.equal(files.filter(f=>f.endsWith(name)).length,1,name);
  }
});
test('migrated SQL still retains canonical all-active membership, dedup and RPC ACL contracts',()=>{
  const content=canonical.map(([current])=>fs.readFileSync(path.join(directory,current),'utf8'));
  assert.match(content[0],/m\.membership_status='ACTIVE'/);
  assert.match(content[0],/buklod_formation_reports_member_v1/);
  assert.match(content[1],/revoke all on function public\.buklod_resolve_auto_submission_scope_v1\(text,uuid\)/i);
  assert.match(content[2],/distinct on \(ra\.learner_id,ra\.item_kind,ra\.item_id\)/);
  for(const s of content) assert.doesNotMatch(s,/insert\s+into\s+public\.buklod_points_ledger/i);
});
