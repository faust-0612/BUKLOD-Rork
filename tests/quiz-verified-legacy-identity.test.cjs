const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const bridge = fs.readFileSync('supabase/functions/buklod-quiz-main-entry-v1/index.ts','utf8');
const migration = fs.readFileSync('supabase/pending/BUKLOD_QUIZ_VERIFIED_LEGACY_IDENTITY_R24.sql','utf8');
const sqlTest = fs.readFileSync('supabase/tests/quiz_verified_legacy_identity_20261031.sql','utf8');

test('verified Main email is rechecked live before linking different Quiz UUID', () => {
  assert.match(bridge, /hasFreshVerifiedMainEmail\(req, mainUser\.id, email\)/);
  assert.match(bridge, /email_confirmed_at/);
  assert.match(bridge, /legacyIdentity\s*&&\s*\(/);
  assert.match(bridge, /quiz_identity_ownership_conflict/);
  assert.match(bridge, /existingMainLink && existingMainLink !== mainUser\.id/);
});
test('Quiz data continues using existing UUID and keeps specialized Quiz role', () => {
  assert.match(bridge, /getUserById\(quizUserId\)/);
  assert.match(bridge, /updateUserById\(quizUserId,/);
  assert.match(bridge, /id: quizUserId/);
  assert.match(bridge, /legacyProfile\?\.role/);
  assert.match(bridge, /buklod_main_user_id: mainUser\.id/);
  assert.doesNotMatch(bridge, /getUserById\(mainUser\.id\)/);
  assert.doesNotMatch(bridge, /updateUserById\(mainUser\.id,/);
});
test('no disruption to fast normal login path or one-time handoff', () => {
  assert.match(bridge, /BUKLOD_MASS_LOGIN_MAIN_QUIZ_R22/);
  assert.match(bridge, /getClaims\(token\)/);
  assert.match(bridge, /generateLink\(\{/);
  assert.match(bridge, /session_launch_ready: false/);
});
test('DB legacy mapping preserves verified users and rejects unauthorized calls', () => {
  assert.match(migration, /legacy_existing',true/);
  assert.match(migration, /end;\s*\$function\$;\s*-- Keep auth provisioning restricted/);
  assert.match(migration, /email_confirmed_at is not null/);
  assert.match(migration, /buklod_main_user_id/);
  assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC,anon,authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/);
  assert.doesNotMatch(migration, /DELETE FROM|DROP TABLE|UPDATE\s+auth\.users/i);
  assert.match(sqlTest, /has_function_privilege\('anon'/);
  assert.match(sqlTest, /legacy_existing/);
  assert.match(sqlTest, /v_before <> v_after/);
});
