import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const migration = readFileSync(new URL('../supabase/migrations/20261112183500_exclude_buklod_official_scope_bp_top10_v2.sql',import.meta.url),'utf8');
const regression = readFileSync(new URL('../supabase/tests/buklod_scope_bp_official_exclusion_20261112.sql',import.meta.url),'utf8');
test('scope member BP ranks exclude only immutable official before sorting and limit',()=>{
  assert.match(migration,/NOT private\.buklod_is_platform_official_v1\(p\.id\)/);
  assert.match(migration,/ROW_NUMBER\(\) OVER/i);
  assert.ok(migration.toLowerCase().indexOf('not private.buklod_is_platform_official_v1(p.id)')<migration.toLowerCase().indexOf('row_number() over'));
  assert.match(migration,/membership_status = 'ACTIVE'/);
  assert.match(migration,/viewer\.user_id = v_viewer/);
  assert.match(migration,/GRANT EXECUTE.+TO authenticated/);
  assert.match(migration,/REVOKE ALL.+FROM PUBLIC, anon/);
  assert.doesNotMatch(migration,/DELETE FROM|UPDATE public\.buklod_scope_memberships/i);
  assert.match(regression,/get_buklod_scope_bp_top10_v1/);
  assert.match(regression,/v_official=ANY\(v_actual\)/);
});
