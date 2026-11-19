import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const db = readFileSync(new URL('../supabase/migrations/20261118013000_buklod_attendance_v2_qr_antifarm.sql', import.meta.url),'utf8');
const scan = readFileSync(new URL('../src/app/scope/attendance/scan.tsx', import.meta.url),'utf8');
const panel = readFileSync(new URL('../src/components/attendance/BuklodAttendanceEventQrPanel.tsx', import.meta.url),'utf8');
test('event QR is server-issued, short-lived, and tied to authenticated attendee',()=>{
  assert.match(db,/extensions\.digest\(secret::text,'sha256'\)/);
  assert.match(db,/75 seconds/);
  assert.match(db,/q\.expires_at>=now\(\)/);
  assert.match(db,/actor uuid:=auth\.uid\(\)/);
  assert.match(db,/on conflict\(event_id,user_id\) do nothing/);
});
test('rewards require independent completed event review and bounded caps',()=>{
  assert.match(db,/v\.status='approved'/);
  assert.match(db,/Event creator cannot approve their own event rewards/);
  assert.match(db,/e\.ends_at>now\(\)/);
  assert.match(db,/cfg\.per_day-greatest\(0,used_day\)/);
  assert.match(db,/cfg\.per_week-greatest\(0,used_week\)/);
  assert.match(db,/pg_advisory_xact_lock|for update/i);
  assert.match(db,/record_method='device_biometric'/);
});
test('scanner keeps scans and rewards separate',()=>{
  assert.match(scan,/CameraView/);
  assert.match(scan,/buklod_scan_event_qr_v2/);
  assert.match(scan,/already_recorded/);
  assert.match(scan,/pending_verification|independent event verification/);
});
test('event display rotates, independent approval rejects creator',()=>{
  assert.match(panel,/45000/);
  assert.match(panel,/buklod_issue_event_qr_v2/);
  assert.match(panel,/buklod_review_event_rewards_v2/);
});
test('legacy points are capped and old home check-in cannot credit directly',()=>{
  const bridge=readFileSync(new URL('../supabase/migrations/20261118014000_buklod_attendance_v2_legacy_bridge_report.sql',import.meta.url),'utf8');
  assert.match(bridge,/NEW\.activity_type<>'event_attendance'/);
  assert.match(bridge,/cfg\.per_day-greatest\(0,used_day\)/);
  assert.match(bridge,/checked_in_at\)\s+values\(checkin\.event_id/);
  assert.match(bridge,/credited',false/);
  assert.match(bridge,/can_manage_buklod_attendance_event\(p_event_id,actor\)/);
  assert.match(bridge,/buklod_attendance_home_report_v2/);
});

test('self-check-in rewards use server-owned scan receipts instead of spoofable client metadata',()=>{
  assert.match(db,/create table if not exists public\.buklod_attendance_scan_receipts_v2/);
  assert.match(db,/insert into public\.buklod_attendance_scan_receipts_v2/);
  assert.match(db,/record_operator=p_user_id and not exists/);
  assert.doesNotMatch(db,/coalesce\(record_meta->>'source',''\)<>'event_qr_v2'/);
});

test('caps align on event date and include church event credits',()=>{
 assert.match(db,/day_start:=\(e\.starts_at at time zone 'Asia\/Manila'\)/);
 assert.match(db,/left join public\.church_events church on church\.id=l\.source_id/);
});
