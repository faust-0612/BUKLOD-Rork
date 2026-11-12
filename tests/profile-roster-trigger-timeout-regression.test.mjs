import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const sql = fs.readFileSync(new URL('../supabase/migrations/20261112090000_optimize_roster_sync_profile_save_timeout.sql', import.meta.url), 'utf8');
const dbTest = fs.readFileSync(new URL('../supabase/tests/profile_roster_save_trigger_timeout_20261112.sql', import.meta.url), 'utf8');

test('profile roster competitor scoring requires >= 0.97 candidate', () => {
  assert.match(sql, /elsif v_score >= 0\.97 then\s+-- Competitor score[\s\S]*?select coalesce\(max\(public\.buklod_classroom_roster_name_similarity_v1\(/);
  assert.ok(!sql.includes('    else\n      select coalesce(max(public.buklod_classroom_roster_name_similarity_v1('));
  assert.match(sql, /v_sig_match := false;\s+v_second := 0;/);
});

test('strict matching, enrollment, manual review and trigger privileges survive', () => {
  for (const clause of ['PROFILE_SYNC_USERNAME_EXACT', 'PROFILE_SYNC_OFFICIAL_TOKEN_EXACT', 'PROFILE_SYNC_OFFICIAL_STRICT_FUZZY', 'v_score >= 0.97', '(v_score-v_second) >= 0.15', 'buklod_education_enrollments', 'buklod_classroom_roster_intents_v1', 'SECURITY DEFINER', "SET search_path TO ''"]) assert.ok(sql.includes(clause), clause);
  assert.match(dbTest, /pg_get_functiondef/);
  assert.match(dbTest, /rollback;/i);
});
