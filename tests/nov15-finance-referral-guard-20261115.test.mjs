import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=get('supabase/migrations/20261115140000_buklod_referral_scope_consistency_v1.sql');
const economy=get('src/lib/buklodEconomyV3.ts');
const portal=get('src/app/bayanihan/index.tsx');

test('historical referral backfill has no settlement, payout or reward-qualification write',()=>{
  assert.match(migration,/qualification_not_inferred/);
  assert.match(migration,/NOT private\.buklod_official_finance_person_v1/);
  assert.doesNotMatch(migration,/INSERT INTO private\.buklod_pf_(?:settlements|user_settlements|referral_settlements)/i);
  assert.doesNotMatch(migration,/UPDATE private\.buklod_pf_config/i);
});

test('community selection requires membership and a locked single destination',()=>{
  assert.match(migration,/m\.user_id=v_user/);
  assert.match(migration,/m\.membership_status='ACTIVE'/);
  assert.match(migration,/v_previous\.locked_until>v_now/);
  assert.match(migration,/FOR UPDATE OF f/);
  assert.match(economy,/selectMyBuklodCommunityDestinationV1/);
  assert.match(portal,/destinationSaving/);
  assert.match(portal,/future funded allocations only/);
});

test('Finance stays distinct from historical invitation counts',()=>{
  assert.match(portal,/Awaiting reconciliation/);
  assert.match(portal,/not automatically earn cash|not create cash balances/i);
  assert.match(portal,/Finan(?:cial|ce)/);
});
