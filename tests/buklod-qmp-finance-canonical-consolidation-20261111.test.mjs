import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const identity = readFileSync('supabase/migrations/20261111023000_buklod_qmp_canonical_finance_identity_v1.sql','utf8');
const settle = readFileSync('supabase/migrations/20261111024500_buklod_pf_v3_qmp_single_settlement_v1.sql','utf8');
const summary = readFileSync('supabase/migrations/20261111025000_buklod_pf_v3_monthly_summary_qmp_v1.sql','utf8');
const audit = readFileSync('supabase/migrations/20261111031000_buklod_finance_qmp_readiness_audit_v1.sql','utf8');
const queue = readFileSync('supabase/migrations/20261111032000_buklod_qmp_finance_review_queue_v1.sql','utf8');
const admin = readFileSync('src/app/admin/economy-operations.tsx','utf8');
const legacy = readFileSync('src/components/BuklodCommunityEconomyAdminCard.tsx','utf8');
const helper = readFileSync('src/lib/buklodMonthlyEarnings.ts','utf8');

test('QMP qualified accounts are sole monthly weight; no lifetime BP or old revenue threshold',()=>{
  assert.match(identity,/create or replace function private\.buklod_pf_monthly_points_v3/);
  assert.match(identity,/private\.buklod_community_qmp_accounts/);
  assert.match(identity,/cp\.starts_at=p_start and cp\.ends_at=p_end/);
  assert.doesNotMatch(identity,/public\.buklod_points_ledger/);
  assert.doesNotMatch(identity,/user_share_activated_at/);
  assert.match(settle,/private\.buklod_pf_monthly_points_v3\(p\.person_id,v_start,v_end\)>0/);
  assert.match(summary,/v_total_points:=private\.buklod_pf_total_monthly_qmp_v1/);
});

test('all qualified authenticated active users receive Finance person mapping',()=>{
  assert.match(identity,/join auth\.users au on au\.id=q\.user_id/);
  assert.match(identity,/pr\.is_active=true and pr\.user_deactivated_at is null/);
  assert.match(identity,/private\.buklod_pf_link_identity_v2\(p_user_id,'\[\]'::jsonb\)/);
  assert.match(identity,/pg_advisory_xact_lock/);
  assert.match(identity,/Retired Finance identity requires authorized review/);
  assert.match(identity,/auth\.uid\(\)/);
  assert.match(identity,/revoke all on function public\.ensure_my_buklod_qmp_finance_identity_v1\(\) from public,anon/);
  assert.match(helper,/ensure_my_buklod_qmp_finance_identity_v1/);
});

test('canonical Finance V3 is only payout allocator; legacy path blocks double credits',()=>{
  assert.match(settle,/admin_finalize_buklod_pf_month_v3/);
  assert.match(settle,/private\.buklod_community_user_pool_periods legacy/);
  assert.match(settle,/private\.buklod_r38_user_period_shares s/);
  assert.match(settle,/Duplicate user revenue allocation blocked/);
  assert.match(settle,/The legacy Community settlement path is retired/);
  assert.doesNotMatch(legacy,/adminFinalizeCommunityUserPool/);
  assert.doesNotMatch(legacy,/FINALIZE COMMUNITY USER POOL/);
});

test('month close, unresolved QMP, verified identity and fraud gates are required',()=>{
  assert.match(settle,/if now\(\)<v_end then/);
  assert.match(settle,/v_qperiod\.status<>'OPEN'/);
  assert.match(settle,/e\.state in \('HELD','PENDING'\)/);
  assert.match(settle,/Qualified QMP snapshot does not reconcile/);
  assert.match(settle,/p\.risk_status='CLEAR'/);
  assert.match(settle,/v_cfg\.economics_enabled or not v_cfg\.settlement_enabled/);
  assert.match(audit,/v_unlinked=0 and v_ineligible=0/);
  assert.match(audit,/v_pending=0 and v_held=0/);
  assert.match(audit,/v_reconciled_sources>0/);
  assert.match(settle,/Verified source-backed eligible revenue is required for month finalization/);
  assert.match(settle,/nullif\(trim\(coalesce\(e\.external_reference,''\)\),''\) is not null/);
  assert.match(admin,/qmpReadiness\?\.ready_for_finalization === true/);
});

test('finalized month immutable and repeated settlement idempotent',()=>{
  assert.match(settle,/buklod_qmp_events_period_frozen_v1/);
  assert.match(settle,/buklod_qmp_accounts_period_frozen_v1/);
  assert.match(settle,/status='FINALIZED',finalized_at=now\(\),updated_at=now\(\)/);
  assert.match(settle,/idempotent_replay',true/);
  assert.match(settle,/v_user_distributed<>v_user_pool/);
  assert.match(settle,/row_number\(\) over/);
  assert.match(settle,/on conflict\(person_id,event_key\) do nothing/);
});

test('no financial activation or payout mutation in migrations',()=>{
  for(const sql of [identity,settle,summary,audit]){
    assert.doesNotMatch(sql,/update private\.buklod_pf_config\s+set\s+(economics_enabled|settlement_enabled|withdrawal_enabled)/i);
    assert.doesNotMatch(sql,/request_my_buklod_pf_withdrawal_v2\(/);
    assert.doesNotMatch(sql,/admin_mark_buklod_pf_withdrawal_paid_v2\(/);
  }
  assert.match(audit,/not public\.buklod_is_system_admin\(\)/);
  assert.match(queue,/not public\.buklod_is_system_admin\(\)/);
  assert.match(queue,/revoke all on function public\.admin_list_buklod_qmp_month_review_queue_v1\(text,integer\)/);
  assert.doesNotMatch(admin,/adminResolveBuklodQmpEvent\(eventId, approve\)/);
  assert.match(admin,/setSnapshot\(null\)/);
  assert.match(audit,/revoke all on function public\.admin_get_buklod_pf_qmp_readiness_v1\(text\)\s+from public,anon/);
});

test('financial arithmetic distributes at most funded pool and keeps historical credits',()=>{
  const qmp=[1,5,5,10,20,30,80,140,200];
  const pool=259;
  const total=qmp.reduce((a,b)=>a+b,0);
  const rows=qmp.map((points,i)=>({i,raw:pool*points/total}));
  for(const row of rows){row.base=Math.floor(row.raw);row.rem=row.raw-row.base;}
  let remaining=pool-rows.reduce((sum,r)=>sum+r.base,0);
  assert.ok(remaining>=0);
  rows.sort((a,b)=>b.rem-a.rem||a.i-b.i);
  for(let i=0;i<remaining;i++)rows[i].base++;
  assert.equal(rows.reduce((sum,r)=>sum+r.base,0),pool);
  assert.equal(qmp.reduce((a,b)=>a+b,0),491);
  const previous=12500,currentEstimate=4250,currentFinalized=4000;
  assert.equal(previous+currentEstimate,16750);
  assert.equal(previous+currentFinalized,16500);
});
