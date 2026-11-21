import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261118235500_buklod_legal_identity_name_withdrawal_v1.sql');
const personal = read('src/app/account/personal-information.tsx');
const payout = read('src/app/bayanihan/payout-profile.tsx');
const economy = read('src/lib/buklodEconomyV3.ts');
const userView = read('src/app/account/identity-verification.tsx');
const adminView = read('src/app/admin/identity-verification.tsx');
const client = read('src/lib/buklodLegalIdentity.ts');

test('personal name edits are blocked at BOTH form and database', () => {
 assert.match(personal, /nameChanged/);
 assert.match(personal, /identity-verification/);
 assert.match(migration, /create trigger aa_buklod_legal_name_profile_guard_v1/i);
 assert.match(migration, /before update of first_name,middle_name,surname,suffix,full_name/i);
 assert.match(migration, /i\.status='VERIFIED'/i);
 assert.match(migration, /i\.legal_full_name is not distinct from new\.full_name/i);
});

test('member approval alone does not grant government ID KYC', () => {
 assert.match(migration, /create table if not exists private\.buklod_legal_identity_v1/i);
 assert.match(migration, /i\.status='VERIFIED' and i\.verified_at is not null/i);
 assert.match(migration, /p\.is_verified=true/i);
 assert.match(migration, /p\.is_active=true/i);
 assert.match(migration, /private\.buklod_is_platform_official_v1\(p_uid\)/);
});

test('identity document bucket is private, owner scoped, non-overwriteable', () => {
 assert.match(migration, /buklod-identity-private/g);
 assert.match(migration, /false,7340032/);
 assert.match(migration, /for insert to authenticated with check/i);
 assert.match(migration, /split_part\(name,'\/',1\).*auth\.uid/i);
 assert.match(migration, /create policy buklod_identity_private_read_v1/i);
 assert.doesNotMatch(client, /console\.log\(.+document_path/);
 assert.match(client, /upsert:false/);
 assert.match(client, /createSignedUrl\(path,60\)/);
});

test('member explicitly consents before any ID processing', () => {
 assert.match(migration, /p_privacy_consent boolean/);
 assert.match(migration, /consented_at timestamptz/);
 assert.match(client, /p_privacy_consent:true/);
 assert.match(userView, /privacyConsent/);
 assert.match(userView, /READ BUKLOD PRIVACY POLICY/);
});

test('approval is reviewer-only, revision-locked, and checks observed ID name', () => {
 assert.match(migration, /OFFICIAL_SYSTEM_ADMIN/);
 assert.match(migration, /if p_user_id=\(select auth\.uid\(\)\)/);
 assert.match(migration, /revision=p_revision and status='PENDING'/);
 assert.match(migration, /p_observed_id_name/);
 assert.match(adminView, /preview\.loaded/);
 assert.match(adminView, /openBuklodPrivateId/);
 assert.match(userView, /submitMyBuklodLegalIdentity/);
});

test('both canonical and legacy withdrawal RPCs enforce identity at server', () => {
 for (const name of ['request_my_buklod_pf_withdrawal_v2','request_my_buklod_r38_referral_withdrawal_v1']) {
  assert.match(migration, new RegExp('alter function public\\.'+name+'\\('));
  assert.match(migration, new RegExp('create function public\\.'+name+'\\('));
 }
 assert.ok((migration.match(/perform private\.buklod_require_legal_identity_for_withdrawal_v1\(v_uid\)/g)||[]).length>=4);
 assert.match(migration,/payout_account_name_snapshot/i);
 assert.match(migration,/v_account->>'account_name'/);
 assert.match(migration,/Frozen payout beneficiary does not match verified ID/);
 assert.match(economy,/getMyBuklodLegalIdentityStatus\(\)/);
 assert.match(payout,/legalIdentity\?\.status === 'VERIFIED'/);
});

test('old unverified payout functions not callable by ordinary members', () => {
 for (const name of [
  'request_my_buklod_pf_withdrawal_v2_unverified_legacy',
  'request_my_buklod_r38_referral_withdrawal_v1_unverified_legacy',
  'admin_mark_buklod_pf_withdrawal_paid_v2_unverified_legacy',
  'admin_mark_buklod_r38_referral_withdrawal_paid_v1_unverified_legacy'
 ]) {
  assert.match(migration,new RegExp('revoke all on function public\\.'+name+'\\('));
 }
 assert.doesNotMatch(migration,/set\s+withdrawal_enabled\s*=\s*true/i);
 assert.doesNotMatch(migration,/set\s+payout_processing_enabled\s*=\s*true/i);
});

test('calls and PTT no longer use self-editable Auth metadata for names', () => {
 for(const path of [
  'src/lib/buklodStreamVideoClient.ts',
  'src/lib/buklodStreamVideoClient.web.ts',
  'src/ptt/buklodPttCore.ts',
  'src/ptt/buklodPttCore.web.ts',
  'supabase/functions/buklod-ptt-access/index.ts'
 ]){
  const value=read(path);
  assert.doesNotMatch(value,/user_metadata\?\.(full_name|name)/,path);
 }
});
