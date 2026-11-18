import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261118235500_buklod_legal_identity_name_withdrawal_v1.sql');

test('withdrawal economy requires real government-ID approval in both UI and backend',()=>{
 const e=read('src/lib/buklodEconomyV3.ts');
 const screen=read('src/app/bayanihan/payout-profile.tsx');
 assert.match(screen,/legalIdentity\?\.status === 'VERIFIED'/);
 assert.match(e,/getMyBuklodLegalIdentityStatus/);
 assert.match(migration,/p\.is_verified=true/);
 assert.match(migration,/i\.status='VERIFIED' and i\.verified_at is not null/);
 assert.match(migration,/admin_mark_buklod_pf_withdrawal_paid_v2_unverified_legacy/);
 assert.match(migration,/admin_mark_buklod_r38_referral_withdrawal_paid_v1_unverified_legacy/);
 assert.match(migration,/payout_account_name_snapshot/);
 assert.match(migration,/payout_account_name/);
});

test('finance activation and existing payout balances are not mutated by identity policy',()=>{
 assert.doesNotMatch(migration,/update\s+private\.buklod_pf_financial_entries/i);
 assert.doesNotMatch(migration,/update\s+private\.buklod_pf_cash_balances/i);
 assert.doesNotMatch(migration,/withdrawal_enabled\s*=\s*true/i);
 assert.doesNotMatch(migration,/payout_processing_enabled\s*=\s*true/i);
 assert.match(migration,/perform 1 from public\.profiles where id=v_uid for update/);
});
