import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const migration = read('supabase/migrations/20261109104024_retire_faith_premium_cluster_access_20261109.sql');
const today = migration.split('CREATE OR REPLACE FUNCTION public.get_automatic_bible_today()')[1]?.split('CREATE OR REPLACE FUNCTION public.buklod_daily_bible_submission_requires_cluster_premium_v1()')[0] ?? '';
const submission = migration.split('CREATE OR REPLACE FUNCTION public.buklod_daily_bible_submission_requires_cluster_premium_v1()')[1]?.split('CREATE OR REPLACE FUNCTION public.buklod_scope_faith_access_status_v1(')[0] ?? '';
const faith = migration.split('CREATE OR REPLACE FUNCTION public.buklod_scope_faith_access_status_v1(')[1]?.split('CREATE OR REPLACE FUNCTION public.buklod_scope_lesson_stage_unlocked_v1(')[0] ?? '';
const stages = migration.split('CREATE OR REPLACE FUNCTION public.buklod_scope_lesson_stage_unlocked_v1(')[1] ?? '';

test('daily reading keeps authenticated active Cluster requirement, not paid entitlement', () => {
  assert.match(today, /actor is null[\\s\\S]*Authentication required/);
  assert.match(today, /if not has_required_cluster then/);
  assert.match(today, /public\\.buklod_scope_is_active_lifecycle/);
  assert.doesNotMatch(today, /buklod_scope_product_entitlements|has_premium|Cluster Premium is required/);
});

test('Daily Reading submission retains active cluster guard', () => {
  assert.match(submission, /buklod_has_active_cluster_membership_v1\\(new\\.user_id\\)/);
  assert.doesNotMatch(submission, /buklod_user_has_active_cluster_product_v1|raise exception 'Cluster Premium/);
});

test('Word and Daily Reading + stages 101-107 no longer depend on purchases', () => {
  assert.match(faith, /'unlocked', v_has_cluster and v_premium/);
  assert.match(faith, /'unlocked', v_has_cluster and v_premium/);
  assert.match(faith, /'scope_unlocked', v_has_cluster and v_ccp/);
  assert.match(faith, /'scope_unlocked', v_has_cluster and v_disc/);
  assert.match(faith, /'scope_unlocked', v_has_cluster and v_ment/);
  assert.match(faith, /v_premium := true;/);
  assert.match(faith, /v_ccp := true;/);
  assert.doesNotMatch(faith, /buklod_scope_has_product_v1|buklod_scope_product_payments/);
  assert.match(stages, /p_stage_code not between 101 and 107/);
  assert.match(stages, /buklod_scope_is_active_lifecycle/);
});

test('clients have retired paid UI copy and disabled purchases', () => {
  const hub = read('src/components/BuklodHomeFaithPanel.tsx');
  const licenses = read('src/components/BuklodScopeLessonLicensesCard.tsx');
  const commercial = read('src/lib/buklodCommercialCatalog.ts');
  assert.doesNotMatch(hub, /This feature is available through your Cluster Premium/);
  assert.match(hub, /An active Cluster membership is required/);
  assert.match(licenses, /BUKLOD LESSONS ACCESS/);
  assert.match(commercial, /BUKLOD_PAID_FEATURES_ENABLED = false/);
});

test('migration does not touch grants, RLS, payment rows or reward ledgers', () => {
  assert.doesNotMatch(migration, /\\b(DROP POLICY|ALTER TABLE|GRANT |REVOKE |DELETE FROM|UPDATE public\\.|TRUNCATE|DROP TRIGGER)\\b/i);
});
