import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const primary = readFileSync(new URL('../supabase/migrations/20261118013000_buklod_attendance_v2_qr_antifarm.sql',import.meta.url),'utf8');
const bridge = readFileSync(new URL('../supabase/migrations/20261118014000_buklod_attendance_v2_legacy_bridge_report.sql',import.meta.url),'utf8');
const permissions = readFileSync(new URL('../src/hooks/useAttendancePermissions.ts',import.meta.url),'utf8');
const home = readFileSync(new URL('../src/app/scope/attendance/home-report.tsx',import.meta.url),'utf8');

test('scope attendance identity is server-bound, not client-supplied',()=>{
  assert.match(primary,/actor uuid:=auth\.uid\(\)/);
  assert.match(primary,/values\(event_id,actor,/);
  assert.match(primary,/attendance_records\(event_id,user_id,status,method,operator_id,metadata\)/);
  assert.match(primary,/on conflict\(event_id,user_id\) do nothing/);
});
test('database security keeps QR challenges and reward tables non-public',()=>{
  for (const table of ['buklod_attendance_event_qr_v2','buklod_attendance_event_review_v2','buklod_attendance_reward_caps_v2']) {
    assert.match(primary,new RegExp('alter table public\\.'+table+' enable row level security'));
    assert.match(primary,new RegExp('revoke all on public\\.'+table+' from public,anon,authenticated'));
  }
  assert.match(primary,/revoke all on function public\.buklod_award_scope_attendance_points_v1/);
  assert.match(primary,/p_approve and not public\.is_system_admin\(\)/);
  assert.match(primary,/High-frequency organizer requires independent System Admin review/);
});
test('scope reporting and legacy points do not circumvent independent review',()=>{
  assert.match(bridge,/only.*BP stays behind the independent event approval/i);
  assert.match(bridge,/credited',false/);
  assert.match(bridge,/Final attendance reward decision cannot be changed/);
  assert.match(bridge,/buklod_attendance_home_report_v2/);
  assert.match(bridge,/can_operate_attendance_scope\(p_scope_id,actor\)/);
  assert.match(permissions,/cluster_admin/);
  assert.match(home,/buklod_attendance_home_report_v2/);
});
