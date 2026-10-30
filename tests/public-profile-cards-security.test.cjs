const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const migrationPath = 'supabase/migrations/20261030085450_harden_public_profile_cards_security_invoker_20261030.sql';
const migration = fs.readFileSync(migrationPath,'utf8');
const sqlTest = fs.readFileSync('supabase/tests/public_profile_cards_security_invoker_20261030.sql','utf8');
test('production migration uses SECURITY INVOKER without replacing any profile data or policies',()=>{
  assert.match(migration,/ALTER VIEW public\.public_profile_cards SET \(security_invoker = true\)/);
  assert.match(migration,/REVOKE ALL PRIVILEGES ON TABLE public\.public_profile_cards\s+FROM PUBLIC, anon, authenticated/);
  assert.match(migration,/GRANT SELECT ON TABLE public\.public_profile_cards TO authenticated/);
  assert.doesNotMatch(migration,/DROP\s+VIEW|CREATE\s+(?:OR\s+REPLACE\s+)?VIEW|ALTER\s+POLICY|DROP\s+POLICY|UPDATE\s+public\.profiles|DELETE\s+FROM\s+public\.profiles/i);
});
test('production and SQL proof fail closed if anonymous access, writes or profiles-RLS bypass remain',()=>{
  for(const content of [migration,sqlTest]){
    assert.match(content,/security_invoker=true/);
    assert.match(content,/relrowsecurity/);
    assert.match(content,/has_table_privilege\('anon','public\.public_profile_cards','SELECT'\)/);
    assert.match(content,/has_table_privilege\('authenticated','public\.public_profile_cards','UPDATE'\)/);
    assert.match(content,/has_table_privilege\('authenticated','public\.public_profile_cards','SELECT'\)/);
  }
  assert.match(sqlTest,/ARRAY\['id','full_name','avatar_url','quick_note','church_id'\]/);
});
