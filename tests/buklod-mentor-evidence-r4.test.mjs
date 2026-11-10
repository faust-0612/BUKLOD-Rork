import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sql = read('supabase/migrations/20261110213500_mentor_report_evidence_review_r4.sql');
const mentor = read('src/app/faith/mentor-evidence.tsx');
const admin = read('src/app/admin/points-r2-monitor.tsx');
const portal = read('src/app/scope/buklod-lesson/index.tsx');

test('photo attachment enters admin queue transactionally with verified ownership', () => {
  assert.match(sql, /create or replace function public\.attach_my_mentor_session_photo_r2/);
  assert.match(sql, /row_rec\.mentor_id<>actor/);
  assert.match(sql, /storage\.objects o/);
  assert.match(sql, /set status='pending_admin'/);
  assert.match(sql, /where id=p_session_id and mentor_id=actor and status='reported'/);
  assert.match(sql, /revoke all on function public\.attach_my_mentor_session_photo_r2\(uuid,text\) from public,anon/);
});

test('past reported sessions with real photo are recovered but approvals and points remain unchanged', () => {
  assert.match(sql, /update public\.mentor_teaching_sessions s set status='pending_admin'/);
  assert.match(sql, /s\.status='reported'/);
  assert.doesNotMatch(sql, /update public\.buklod_points_ledger/i);
  assert.doesNotMatch(sql, /set status='approved'/);
});

test('user feedback and credited rewards are sourced from owner-scoped database rows', () => {
  assert.match(sql, /where mentor_id=\(select auth\.uid\(\)\)/);
  assert.match(sql, /'admin_note',case when s\.status in \('approved','rejected'\)/);
  assert.match(sql, /'points_credited',coalesce/);
  assert.match(sql, /source_key='mentor_session:'\|\|s\.id::text/);
  assert.match(mentor, /System Admin feedback:/);
  assert.match(mentor, /describeStatus\(task\)/);
});

test('rejected reports may be revised without reopening credited records', () => {
  assert.match(sql, /revise_my_rejected_mentor_session_r4/);
  assert.match(sql, /row_rec\.mentor_id<>actor or row_rec\.status<>'rejected'/);
  assert.match(sql, /Credited mentoring sessions cannot be reopened/);
  assert.match(sql, /delete from private\.buklod_r2_mentor_session_evidence/);
  assert.match(mentor, /Correct and resubmit this report/);
  assert.match(mentor, /Attach a new consented photo/);
});

test('evidence upload has consent, photo preview, retry receipt and private signed preview', () => {
  assert.match(mentor, /requestCameraPermissionsAsync/);
  assert.match(mentor, /requestMediaLibraryPermissionsAsync/);
  assert.match(mentor, /confirm permission to upload/i);
  assert.match(mentor, /setRetrySessionId\(savedSessionId\)/);
  assert.match(mentor, /Retry saved photo/);
  assert.match(mentor, /createSignedUrl\(task\.photo_path, 120\)/);
  assert.match(mentor, /PHOTO_BUCKET = 'buklod-mentoring-evidence'/);
  assert.match(mentor, /upsert: false/);
  assert.match(mentor, /previous_photo_path/);
  assert.match(mentor, /report_my_mentor_teaching_with_details_r3/);
  assert.match(mentor, /attach_my_mentor_session_photo_r2/);
});

test('admin queue prioritizes open reports and only system admin can retrieve private evidence', () => {
  assert.match(sql, /public\.is_system_admin\(\)/);
  assert.match(sql, /case when status in \('reported','pending_admin'\) then 0 else 1 end/);
  assert.match(admin, /s\.status==='pending_admin'\|\|\(p\.status==='reported'&&!!p\.photo_path\)/);
  assert.match(admin, /createSignedUrl/);
  assert.match(admin, /admin_review_mentor_session_r3/);
  assert.match(portal, /Track System Admin review/);
  assert.doesNotMatch(portal, /Pastor\/Admin verification/);
});
