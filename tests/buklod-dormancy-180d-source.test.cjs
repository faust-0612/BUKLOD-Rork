const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const migration = readFileSync('supabase/migrations/20261119213200_buklod_dormancy_monthly_candidate_review_v1.sql','utf8');
const admin = readFileSync('src/components/AdminDormancyReview.tsx','utf8');
const member = readFileSync('src/components/MemberDormancyReview.tsx','utf8');
const adminScreen = readFileSync('src/app/admin/privacy/index.tsx','utf8');
const securityScreen = readFileSync('src/app/account/security.tsx','utf8');

test('does not activate destructive deletion or change existing manual account deletion', () => {
  assert.match(migration, /monitoring_enabled boolean not null default false/);
  assert.match(migration, /automatic_deletion_enabled boolean not null default false/);
  assert.doesNotMatch(migration, /^\s*delete\s+from\s+auth\.users/im);
  assert.doesNotMatch(migration, /auth\.admin\.deleteUser\s*\(/);
  assert.match(admin, /Permanent auto-deletion is NOT live/);
  assert.match(migration, /No verified external delivery, storage\/finance\/legal clearance/);
});

test('180-day candidate scan checks authenticated activity, not points or rank', () => {
  assert.match(migration, /last_sign_in_at <= p_now - interval '180 days'/);
  assert.match(migration, /buklod_client_version_registry_r1 activity/);
  assert.match(migration, /community_posts post/);
  assert.match(migration, /last_seen_at > p_now - interval '180 days'/);
  assert.match(migration, /email_confirmed_at is not null/);
  assert.match(migration, /role='system_admin' and ur.is_active=true/);
});

test('deletion deadline requires separately verified external delivery', () => {
  assert.match(migration, /verified_external_notice_at timestamptz/);
  assert.match(migration, /verified_external_notice_at \+ interval '180 days'/);
  assert.match(migration, /where status='PENDING'/);
  assert.doesNotMatch(migration, /set verified_external_notice_at/);
});

test('admin only can hold and release with audit, and member can only respond for self', () => {
  assert.match(migration, /public\.is_system_admin\(\)/);
  assert.match(migration, /p_hold and length\(trim\(coalesce\(p_reason,''\)\)\) < 8/);
  assert.match(migration, /'ADMIN_HOLD' else 'ADMIN_RELEASE_HOLD'/);
  assert.match(migration, /user_id=\(select auth\.uid\(\)\) and status='PENDING'/);
  assert.match(admin, /buklod_admin_set_dormancy_hold_v1/);
  assert.match(member, /buklod_my_dormancy_response_v1/);
  assert.match(adminScreen, /<AdminDormancyReview \/>/);
  assert.match(securityScreen, /<MemberDormancyReview \/>/);
});

test('monthly reporting is idempotent and routed to existing System Admin notifications', () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /month_key text primary key/);
  assert.match(migration, /'account_dormancy_admin'/);
  assert.match(migration, /'\/admin\/privacy'/);
  assert.match(migration, /'15 2 1 \* \*'/);
  assert.match(migration, /revoke all on private\.buklod_dormancy_cases_v1/);
});
