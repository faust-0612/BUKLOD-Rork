import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration=readFileSync('supabase/migrations/20261112030000_buklod_admob_only_member_revenue_v1.sql','utf8');
const lib=readFileSync('src/lib/buklodCanonicalAdminEconomy.ts','utf8');
const bayanihan=readFileSync('src/app/admin/bayanihan.tsx','utf8');
const reports=readFileSync('src/app/admin/reports-center.tsx','utf8');
const ops=readFileSync('src/app/admin/economy-operations.tsx','utf8');

test('both financial source entry points reject sponsorship as member revenue',()=>{
  for (const fn of ['buklod_pf_admob_only_journal_guard_v1','buklod_pf_admob_only_value_guard_v1','buklod_is_verified_admob_source_v1'])
    assert.ok(migration.includes(fn));
  for (const rejected of ["sponsor_inventory","manual_admin"]) assert.ok(!/^\s*\(\s*'sponsor_inventory'/m.test(migration),rejected);
  assert.match(migration,/not private\.buklod_is_verified_admob_source_v1\(new\.source_system\)/);
  assert.match(migration,/not private\.buklod_is_verified_admob_source_v1\(new\.provider\)/);
  assert.match(migration,/Only reconciled AdMob revenue can fund member settlement/);
});
test('retired R38 user pool never accrues sponsorship',()=>{
  assert.match(migration,/v_base := greatest\(v_admob_revenue-v_admob_cost,0\)/);
  assert.match(migration,/v_rev-v_cost/); // historical formula is no longer used
});
test('canonical Finance counts AdMob and app business income independently',()=>{
  assert.match(migration,/'member_distribution_source','RECONCILED_ADMOB_ONLY'/);
  assert.match(migration,/'other_app_reconciled_revenue_php'/);
  assert.match(migration,/not private\.buklod_is_verified_admob_source_v1\(e\.source_system\)/);
  assert.match(migration,/not private\.buklod_is_platform_official_v1\(q\.user_id\)/);
  assert.match(lib,/member_distribution_source: 'RECONCILED_ADMOB_ONLY'/);
  assert.match(lib,/other_app_excluded_from_user_pool !== true/);
});
test('admin screens distinguish provider estimate, AdMob cash and sponsor revenue',()=>{
  for (const content of [bayanihan,reports,ops]){
    assert.match(content,/revenue_sources\.other_app_reconciled_revenue_php/);
    assert.match(content,/revenue_sources\.admob_reconciled_finance_journal_php/);
  }
  assert.match(bayanihan,/NOT shared/);
  assert.match(ops,/sourceSystem\] =\s*useState\('admob_verified'\)/);
});
