import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/20261116130306_buklod_verified_referral_circle_rank_20bp_v2.sql', import.meta.url),
  'utf8',
);
const inviteCard = fs.readFileSync(
  new URL('../src/components/BuklodReferralInviteCard.tsx', import.meta.url),
  'utf8',
);
const verified = migration.split('create or replace function private.buklod_award_verified_referral_points_v2')[1]
  .split('-- All helpers are internal trigger/admin-only entry points')[0];
const rankPatch = fs.readFileSync(
  new URL('../supabase/migrations/20261116130815_buklod_referral_rank_single_claim_compat_v3.sql', import.meta.url),
  'utf8',
);
const rank = rankPatch.split('create or replace function private.buklod_award_referral_rank_bonus_v2')[1]
  .split('create or replace function private.buklod_verified_referral_rank_event_v2')[0];
const manual = migration.split('create or replace function public.buklod_qualify_referral_v1')[1];

test('verification awards configured referral and welcome BP, not cash', () => {
  assert.match(verified, /invited\.is_verified=true/);
  assert.match(verified, /invited\.is_active=true/);
  assert.match(verified, /inviter\.is_active=true/);
  assert.match(verified, /private\.buklod_is_platform_official_v1/);
  assert.match(verified, /v_cfg\.referrer_points/);
  assert.match(verified, /v_cfg\.referred_points/);
  assert.match(verified, /referral:verified:v2:/);
  assert.match(verified, /referral:welcome:v2:/);
  assert.match(verified, /on conflict \(user_id,source_key\) do nothing/g);
  assert.doesNotMatch(verified, /buklod_internal_credit_points_v1|buklod_internal_credit_bayanihan_v1/);
});

test('rank bonus needs new claimed Circle Rank with post-invite activity', () => {
  assert.match(migration, /'referral_rank_bonus','Referral Circle Rank advancement',10,10,true/);
  assert.match(rank, /v_ref\.status not in \('qualified','rewarded'\)/);
  assert.match(rank, /h\.achievement_source in \('ledger_crossing','claimed_crossing'\)/);
  assert.match(rank, /h\.achieved_at>v_ref\.created_at/);
  assert.match(rank, /h\.rank_order>coalesce/);
  assert.match(rank, /h\.trigger_ledger_id is not null/);
  assert.match(rank, /crossing\.claim_state in \('claimed','legacy'\)/);
  assert.match(rank, /earned\.activity_type not like 'referral%'/);
  assert.match(rank, /earned\.created_at>v_ref\.created_at/);
  assert.match(rank, /s\.scope_type='CLUSTER'/);
  assert.match(rank, /m\.membership_status='ACTIVE'/);
  assert.match(rank, /coalesce\(m\.joined_at,m\.created_at\)<=h\.achieved_at/);
  assert.match(rank, /referral:rank:v2:/);
  assert.match(rank, /on conflict \(user_id,source_key\) do nothing/);
  assert.doesNotMatch(rank, /buklod_internal_credit_bayanihan_v1/);
});

test('verification, referral attach and rank crossing server triggers', () => {
  for (const name of [
    'trg_buklod_verified_referral_profile_v2',
    'trg_buklod_verified_referral_attach_v2',
    'trg_buklod_verified_referral_rank_v2',
  ]) assert.ok(migration.includes(name), name + ' missing');
  assert.match(migration, /after insert or update of is_verified,is_active,user_deactivated_at/);
  assert.match(migration, /after insert on public\.buklod_referrals/);
  assert.match(migration, /after insert on public\.buklod_rank_history/);
  assert.match(rankPatch, /new\.achievement_source in \('ledger_crossing','claimed_crossing'\)/);
  assert.match(migration, /new\.achievement_source='ledger_crossing'/);
  assert.match(migration, /revoke all on function private\.buklod_award_referral_rank_bonus_v2\(uuid\)/);
  assert.match(migration, /revoke all on function private\.buklod_award_verified_referral_points_v2\(uuid\)/);
});

test('manual admin cash payout cannot double-credit BP', () => {
  assert.match(manual, /public\.is_system_admin\(\)/);
  assert.match(manual, /p\.is_verified=true/);
  assert.match(manual, /private\.buklod_award_verified_referral_points_v2/);
  assert.match(manual, /v_row\.status='rewarded'/);
  assert.doesNotMatch(manual, /buklod_internal_credit_points_v1/);
  assert.match(manual, /buklod_internal_credit_bayanihan_v1/);
  assert.doesNotMatch(rank + verified, /update private\.buklod_pf_|insert into private\.buklod_pf_/);
});

test('member invite card explains 10+10 BP', () => {
  assert.match(inviteCard, /\+10 BUKLOD Points when your invited member is verified/);
  assert.match(inviteCard, /one-time \+10 bonus when they advance a Circle Rank/);
  assert.match(inviteCard, /Maximum \+20 BP per referral/);
  assert.match(inviteCard, /Points are separate from cash earnings/);
});
