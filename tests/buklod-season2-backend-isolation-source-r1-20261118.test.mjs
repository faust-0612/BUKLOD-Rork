import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../docs/season2/sql/BUKLOD_S2_ISOLATED_REWARD_CORE_DRAFT_NOT_DEPLOY.sql',import.meta.url),'utf8');
const policy=readFileSync(new URL('../src/lib/season2/buklodSeason2RewardContractR1.ts',import.meta.url),'utf8');
test('S2 SQL candidate is inert and NOT a production migration',()=>{
  assert.match(sql,/(?:NEVER|NOT) AUTO-APPLY/);
  assert.match(sql,/DO NOT APPLY TO PRODUCTION/);
  assert.match(sql,/create schema if not exists buklod_s2;/);
  assert.match(sql,/enabled boolean not null default false/);
  assert.match(sql,/values\(true,false,null,null\)/);
  assert.doesNotMatch(sql,/create or replace function public\./i);
  assert.doesNotMatch(sql,/(insert into|update|delete from|alter table|drop table|truncate)\s+(public|private)\./i);
});
test('S2 revokes client DML and privileged function access, and cannot activate from service role',()=>{
  assert.match(sql,/revoke all on schema buklod_s2 from public, anon, authenticated/);
  assert.match(sql,/revoke all on all tables in schema buklod_s2 from public,anon,authenticated/);
  assert.match(sql,/revoke update on buklod_s2\.control from service_role/);
  for(const fn of ['verify_main_source','credit_main_source','buy_cosmetic','claim_weekly_foundation','allocate_flex']){
    assert.match(sql,new RegExp('revoke all on function buklod_s2\\.'+fn));
  }
  assert.match(sql,/S1_AWAITING_SIGNED_RECONCILIATION/);
});
test('No free client mint, fixed amounts, wallet lock and unique receipts',()=>{
  assert.match(sql,/for update;/);
  assert.match(sql,/unique\(user_id,source_kind,source_id,rule_version\)/);
  assert.match(sql,/unique\(user_id,entry_key\)/);
  assert.match(sql,/verified_at is not null/);
  assert.match(sql,/moderation_state='approved'/);
  assert.match(sql,/p\.user_id<>p_user/);
  assert.match(sql,/daily_token_cap smallint not null default 12/);
  assert.match(sql,/token_amount between 0 and 3/);
});
test('All paid items nonessential; purchase nonce and inventory unique, no lottery or monetary hook',()=>{
  assert.match(sql,/nonessential boolean not null default true check\(nonessential\)/);
  assert.match(sql,/is_paid_collectible boolean not null default false check\(not is_paid_collectible\)/);
  assert.match(sql,/primary key\(user_id,request_nonce\)/);
  assert.match(sql,/primary key\(user_id,item_key\)/);
  assert.doesNotMatch(sql,/buklod_pf_monthly_points_v3|admob_revenue|buklod_points_ledger\s+set/i);
});
test('Weekly single-use evidence, owner grace/flex and season-specific badges',()=>{
  assert.match(sql,/create table if not exists buklod_s2\.weekly_claim/);
  assert.match(sql,/unique\(user_id,learning_receipt_id\)/);
  assert.match(sql,/unique\(user_id,community_receipt_id\)/);
  assert.match(sql,/v_end:=p_week\+6\+3\+least\(v_flex,2\)\*7/);
  assert.match(sql,/badge_key.*'s2_weekly_foundation'/s);
  assert.match(sql,/if v_spent\+p_credits>2 then raise exception 'FLEX_CREDITS_EXCEEDED'/);
  assert.ok(!policy.includes('supabase.from('));
});
test('Only verified shared source classes mint until faith/nonfaith parity exists',()=>{
  const block=sql.slice(sql.indexOf('create or replace function buklod_s2.credit_main_source'));
  assert.match(block,/p_kind not in \('today_dugtong','kl_verified_chapter',/);
  assert.doesNotMatch(sql,/insert into\s+public\.buklod_points_ledger/i);
  assert.doesNotMatch(sql,/update\s+private\.buklod_character_progress_v3/i);
});
