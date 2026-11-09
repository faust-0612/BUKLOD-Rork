import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');
const funding = read('supabase/migrations/20261109030000_buklod_pf_funded_admin_cash_rewards_v1.sql');
const report = read('supabase/migrations/20261109032000_buklod_pf_admin_reward_breakdown_v1.sql');
const ui = read('src/app/admin/funded-rewards.tsx');
const consoleUi = read('src/app/admin/economy-operations.tsx');

test('system admin cash rewards start DISABLED and require proof, attestation and separate funding', () => {
  assert.match(funding, /enabled boolean not null default false/);
  assert.match(funding, /values\(true,false\) on conflict\(singleton\) do nothing/);
  assert.match(funding, /status text not null default 'PENDING'/);
  assert.match(funding, /VERIFIED_BY_ADMIN/);
  assert.match(funding, /requires_external_receipt_review',true/);
  assert.match(funding, /not coalesce\(v_cfg.economics_enabled,false\)/);
  assert.match(funding, /not coalesce\(v_enabled,false\)/);
  assert.match(funding, /Verified reward funding is insufficient/);
  assert.match(funding, /remaining_centavos>=p_amount_centavos/);
  assert.doesNotMatch(funding, /buklod_community_admob_estimate_snapshots|buklod_points_balances|buklod_pf_community_fund_ledger/);
});

test('admin-to-user rewards preserve personal wallet, one withdrawal reservation and exactly-once credits', () => {
  assert.match(funding, /public\.buklod_is_system_admin\(\)/);
  assert.match(funding, /request_key text not null unique/);
  assert.match(funding, /where request_key=v_key/);
  assert.match(funding, /Conflicting funded reward request replay/);
  assert.match(funding, /for update/);
  assert.match(funding, /current_user_id=p_recipient_user_id/);
  assert.match(funding, /risk_status='CLEAR'/);
  assert.match(funding, /'AVAILABLE','CREDIT',p_amount_centavos,'ADMIN_CORRECTION'/);
  assert.match(funding, /'funding_class','ADMIN_FUNDED_REWARD'/);
  assert.match(funding, /withdrawal_gated'/);
  assert.doesNotMatch(funding, /payout_processing_enabled\s*=\s*true|withdrawal_enabled\s*=\s*true/);
});

test('private schema and admin RPC grants prevent direct user cash or budget writes', () => {
  assert.match(funding, /revoke all on private\.buklod_pf_admin_reward_budgets from public,anon,authenticated/);
  assert.match(funding, /revoke all on private\.buklod_pf_admin_reward_transfers from public,anon,authenticated/);
  assert.match(funding, /alter table private\.buklod_pf_admin_reward_budgets enable row level security/);
  assert.match(funding, /alter table private\.buklod_pf_admin_reward_transfers enable row level security/);
  assert.match(funding, /revoke all on function public\.admin_transfer_buklod_pf_funded_reward_v1/);
  assert.match(report, /admin_funded_reward_php/);
  assert.match(report, /l\.entry_type='ADMIN_CORRECTION'/);
  assert.match(report, /l\.metadata->>'funding_class'='ADMIN_FUNDED_REWARD'/);
});

test('admin has explicit no-cash-on-receipt screen and cannot bypass release gate', () => {
  assert.match(ui, /AdminGate/);
  assert.match(ui, /admin_register_buklod_pf_reward_funding_v1/);
  assert.match(ui, /admin_verify_buklod_pf_reward_funding_v1/);
  assert.match(ui, /admin_transfer_buklod_pf_funded_reward_v1/);
  assert.match(ui, /admin_set_buklod_pf_reward_transfers_enabled_v1/);
  assert.match(ui, /funding\.economics_enabled/);
  assert.match(ui, /funding\.enabled/);
  assert.match(ui, /request\.current/);
  assert.match(ui, /'PENDING'/);
  assert.match(ui, /Source|Funding|proof|receipt/i);
  assert.match(consoleUi, /\/admin\/funded-rewards/);
});
