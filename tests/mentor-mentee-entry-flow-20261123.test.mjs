import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const screen = read('src/app/faith/mentor-evidence.tsx');
const admin = read('src/app/admin/learning/mentors.tsx');
const sql = read('supabase/migrations/20261123190000_mentor_report_mentee_entry_requests_v1.sql');

test('mentor can search real assigned mentees and enter a missing name', () => {
  for (const contract of [
    'Search your assigned mentees by name',
    'Mentee full name (required)',
    'Request to add mentee',
    'visibleDisciples.map',
    'Refresh assigned mentees',
    'request_my_mentee_link_v1',
    'get_my_mentee_link_requests_v1',
    'No assigned mentees yet',
    'menteeRequestAvailable',
  ]) assert.ok(screen.includes(contract), 'missing mentor UI: ' + contract);
  assert.match(screen, /value=\{newMenteeName\} onChangeText=\{setNewMenteeName\}/);
  assert.match(screen, /value=\{menteeSearch\} onChangeText=\{setMenteeSearch\}/);
});

test('typing a name never bypasses an actual verified attendee assignment', () => {
  assert.match(screen, /selectedDisciples\.length < 1/);
  assert.match(screen, /p_attendee_ids: selectedDisciples/);
  assert.match(screen, /report_my_mentor_teaching_with_details_r3/);
  assert.match(screen, /mentorEligible !== true/);
  assert.match(screen, /!menteeRequestAvailable/);
  assert.doesNotMatch(screen, /p_attendee_ids:\s*newMenteeName/);
  assert.doesNotMatch(screen, /mentor_assignments'\)\.upsert/);
  assert.match(screen, /get_my_mentor_photo_tasks_r2/);
  assert.match(screen, /await uploadPhoto\(confirmedSessionId, photo\)/);
});

test('collapsed lesson picker leaves mentee entry reachable without scrolling 68 lessons', () => {
  assert.match(screen, /lessonPickerOpen && <>/);
  assert.match(screen, /setLessonPickerOpen\(false\)/);
  assert.match(screen, /2\. Mentees who attended/);
  assert.match(screen, /3\. Teaching details and photo/);
  assert.ok(screen.indexOf('2. Mentees who attended') > screen.indexOf('lessonPickerOpen && <>'));
});

test('new request RPCs are authenticated, private, bounded and nonrewarding', () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.buklod_mentor_mentee_link_requests_v1/);
  assert.match(sql, /public\.has_capability\(actor,'mentor'\)/);
  assert.match(sql, /public\.buklod_foundation_protected_principals/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, />= 5/);
  assert.match(sql, />= 10/);
  assert.match(sql, /where r\.mentor_id=actor/);
  assert.match(sql, /public\.is_system_admin\(\)/);
  assert.doesNotMatch(sql, /insert into public\.mentor_teaching_sessions/);
  assert.doesNotMatch(sql, /insert into public\.buklod_points_ledger/);
  assert.match(sql, /grant execute on function public\.request_my_mentee_link_v1\(text\) to authenticated/);
  assert.match(sql, /grant execute on function public\.get_my_mentee_link_requests_v1\(\) to authenticated/);
});

test('only admin can review and link verified active members, with audit and repeat safety', () => {
  assert.match(sql, /if actor is null or not public\.is_system_admin\(\)/);
  assert.match(sql, /where id=p_request_id for update/);
  assert.match(sql, /req\.status<>'pending'/);
  assert.match(sql, /req\.disciple_id=p_disciple_id/);
  assert.match(sql, /candidate\.is_active is distinct from true/);
  assert.match(sql, /public\.has_capability\(req\.mentor_id,'mentor'\)/);
  assert.match(sql, /insert into public\.mentor_assignments\(mentor_id,disciple_id,is_active\)/);
  assert.match(sql, /on conflict\(mentor_id,disciple_id\) do update set is_active=true/);
  assert.match(sql, /reviewed_by=actor,review_note=clean_note,reviewed_at=now\(\)/);
  for (const contract of [
    'admin_pending_mentee_link_requests_v1',
    'admin_review_mentee_link_request_v1',
    'APPROVE VERIFIED MENTEE LINK',
    'REJECT REQUEST',
    'Selected verified member',
  ]) assert.ok(admin.includes(contract), 'missing admin UI: ' + contract);
});

test('regressions: existing mentor report consent, receipt, photo retry, revision remain', () => {
  for (const contract of [
    'const missingReportRequirements = [',
    'if (missingReportRequirements.length > 0)',
    "if (!beginAction('creating')) return;",
    'setRetrySessionId(confirmedSessionId)',
    'retryPhoto',
    'revise_my_rejected_mentor_session_r4',
    'I confirm permission to upload this mentoring photo',
  ]) assert.ok(screen.includes(contract), 'missing existing behavior: ' + contract);
});
