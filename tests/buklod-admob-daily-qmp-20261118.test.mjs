import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeDatedAdmobReport } from '../supabase/functions/buklod-admob-revenue-preview-sync/report-totals.mjs';
const read=path=>readFileSync(path,'utf8');
const sql=read('supabase/migrations/20261118004200_buklod_admob_daily_qmp_preview_v2.sql');
const worker=read('supabase/functions/buklod-admob-revenue-preview-sync/index.ts');
const schedule=read('.github/workflows/buklod_admob_provisional_sync.yml');
const home=read('src/components/BuklodUnifiedEarningsHomeCard.tsx');
const detail=read('src/app/community-contribution.tsx');
const bayanihan=read('src/app/bayanihan/index.tsx');
const complete=[
  {header:{localizationSettings:{currencyCode:'PHP'}}},
  {row:{dimensionValues:{APP:{value:'app'},DATE:{value:'20261117'}},metricValues:{ESTIMATED_EARNINGS:{microsValue:'2500000'}}}},
  {row:{dimensionValues:{APP:{value:'app'},DATE:{value:'20261118'}},metricValues:{ESTIMATED_EARNINGS:{microsValue:'1250000'}}}},
  {footer:{}},
];
test('Day is subset of month and both are official app-scoped micros',()=>{
  const r=summarizeDatedAdmobReport(complete,'app','20261118');
  assert.equal(r.totalMicros,3750000n);
  assert.equal(r.dayMicros,1250000n);
  const pool=Math.floor(375*3000/10000);
  assert.equal(pool,112);
  assert.equal(Math.floor(pool*100/1000),11);
  assert.equal(Math.floor(Math.floor(125*3000/10000)*100/1000),3);
});
test('Incomplete, wrong app, wrong currency, negative or future source never overwrites preview',()=>{
  assert.throws(()=>summarizeDatedAdmobReport(complete.slice(0,-1),'app','20261118'),/footer/);
  assert.throws(()=>summarizeDatedAdmobReport(complete,'other','20261118'),/unexpected app/);
  assert.throws(()=>summarizeDatedAdmobReport(complete,'app','20261116'),/outside requested period/);
  const bad=structuredClone(complete);bad[0].header.localizationSettings.currencyCode='USD';
  assert.throws(()=>summarizeDatedAdmobReport(bad,'app','20261118'),/PHP/);
  const negative=structuredClone(complete);negative[2].row.metricValues.ESTIMATED_EARNINGS.microsValue='-42';
  assert.throws(()=>summarizeDatedAdmobReport(negative,'app','20261118'),/invalid/);
});
test('Trusted-only atomic, monotonic daily writer and QMP source matching',()=>{
  assert.match(sql,/buklod_admob_daily_preview_v1/);
  assert.match(sql,/auth\.role\(\)/);
  assert.match(sql,/<> 'service_role'/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/v_last > p_observed_at/);
  assert.match(sql,/admin_set_buklod_community_admob_estimate_v1/);
  assert.match(sql,/v_snapshot\.observed_at<now\(\)-interval '36 hours'/);
  assert.match(sql,/d\.observed_at=v_snapshot\.observed_at/);
  assert.match(sql,/v_day_share:=case when v_day\.report_date is not null and v_total>0/);
  assert.match(sql,/v_pool:=floor\(v_snapshot\.amount_minor::numeric\*v_bps\/10000\)::bigint/);
  assert.doesNotMatch(sql,/\b(insert|update|delete)\s+(into\s+|from\s+)?private\.buklod_pf_cash_ledger/i);
  assert.match(worker,/dimensions: \['DATE', 'APP'\]/);
  assert.match(worker,/reportingTimeZone/);
  assert.match(worker,/buklod_write_admob_daily_preview_v2/);
  assert.match(worker,/hasGatewayVerifiedServiceRoleClaims\(token\)/);
  assert.doesNotMatch(worker,/admin_finalize_buklod|credit_wallet|process_withdrawal/);
});
test('Today, month, last month, available and withdrawn are separate user balances',()=>{
  for(const s of [home,detail,bayanihan]) assert.match(s,/TODAY|Today/);
  assert.match(home,/LAST MONTH/);
  assert.match(home,/ALREADY WITHDRAWN/);
  assert.match(home,/PROJECTED TOTAL · NOT WITHDRAWABLE/);
  assert.match(detail,/Already withdrawn/);
  assert.match(detail,/No current daily report/);
  assert.match(schedule,/cron: '17 \* \* \* \*'/);
  assert.match(schedule,/BUKLOD_ADMOB_SYNC_ENABLED == 'true'/);
});
