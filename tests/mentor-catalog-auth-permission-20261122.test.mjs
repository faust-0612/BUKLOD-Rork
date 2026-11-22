import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('mentor catalog expansion retains server-side authorization and least-privilege execute ACL', () => {
  const sql = read('supabase/migrations/20261122065000_mentor_full_published_catalog_v1.sql');
  assert.match(sql, /if actor is null then raise exception 'Authentication required'/);
  assert.match(sql, /if not public\.has_capability\(actor,'mentor'\) then/);
  assert.match(sql, /return '\[\]'::jsonb/);
  assert.match(sql, /t\.status = 'published'/);
  assert.match(sql, /coalesce\(l\.content_ready, true\) = true/);
  assert.match(sql, /revoke all on function public\.get_my_mentor_reportable_lessons_r2\(\) from public, anon/);
  assert.match(sql, /grant execute on function public\.get_my_mentor_reportable_lessons_r2\(\) to authenticated/);
  assert.doesNotMatch(sql, /grant execute on function.*to (?:anon|public)/i);
  assert.doesNotMatch(sql, /update public\.(user_capabilities|mentor_teaching_sessions)/i);
});

test('mentoring report still submits through authenticated, assigned-learner and private-photo flow', () => {
  const app = read('src/app/faith/mentor-evidence.tsx');
  assert.match(app, /rpc\('has_capability'/);
  assert.match(app, /mentorEligible !== true/);
  assert.match(app, /selectedDisciples\.length < 1/);
  assert.match(app, /if \(!photo\)/);
  assert.match(app, /!consent/);
  assert.match(app, /report_my_mentor_teaching_with_details_r3/);
  assert.match(app, /attach_my_mentor_session_photo_r2/);
  assert.match(app, /p_request_key: requestKey/);
});
