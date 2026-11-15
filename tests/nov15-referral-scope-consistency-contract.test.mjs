import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const migration = src('supabase/migrations/20261115140000_buklod_referral_scope_consistency_v1.sql');

test('canonical referral suggestion supports historical aliases', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.suggest_buklod_referral_targets_v1/);
  assert.match(migration, /c\.referral_code/);
  assert.match(migration, /upper\(coalesce\(l\.referral_code/);
  assert.match(src('src/lib/buklodRewards.ts'), /item\.canonical_referral_code \?\? item\.referral_code/);
  assert.match(migration, /coalesce\(c\.referral_code,l\.referral_code\)/);
  assert.match(migration, /identity_ready/);
});

test('signup locks only verified referrer and rejects ambiguous selection', () => {
  assert.match(migration, /Another referrer is already locked/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(src('src/lib/buklodRewards.ts'), /buklod_record_referral_verified_v2/);
  assert.match(src('src/app/(auth)/register.tsx'), /referralQuery\.trim\(\) && !selectedReferralCode\.trim\(\)/);
  assert.match(src('src/app/(auth)/register.tsx'), /password\.length < 10/);
});

test('historical reconciliation respects Official guard and does not credit money', () => {
  assert.match(migration, /NOT private\.buklod_official_finance_person_v1\(ref\.person_id\)/);
  assert.match(migration, /NOT private\.buklod_official_finance_person_v1\(invited\.person_id\)/);
  assert.match(migration, /qualification_not_inferred/);
  assert.doesNotMatch(migration, /INSERT INTO private\.buklod_pf_finalized_value_ledger/i);
  assert.doesNotMatch(migration, /UPDATE private\.buklod_pf_config/i);
});

test('Community selection stays member-scoped and respects a lock', () => {
  assert.match(migration, /m\.user_id=v_user AND m\.membership_status='ACTIVE'/);
  assert.match(migration, /v_previous\.locked_until>v_now/);
  assert.match(src('src/app/bayanihan/index.tsx'), /confirmDestination/);
  assert.match(src('src/app/bayanihan/index.tsx'), /selectMyBuklodCommunityDestinationV1/);
});

test('Organization home distinguishes in-scope and global Cluster membership', () => {
  const card = src('src/components/BuklodOrgHomeClusterCard.tsx');
  assert.match(card, /No Cluster joined in this Organization/);
  assert.match(card, /fetchFormationContextResilient\(\)/);
  assert.doesNotMatch(card, /You are not in a Cluster yet/);
  assert.match(src('src/components/BuklodScopeHomeDashboard.tsx'), /FUNCTIONAL ROLES/);
});
