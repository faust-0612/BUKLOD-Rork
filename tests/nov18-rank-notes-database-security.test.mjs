import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261118143054_buklod_rank_sync_permanent_notes_hotfix_20261118.sql',import.meta.url),'utf8');
test('Rank API keeps authenticated active viewer, active target, platform-official exclusion, and only reads balances',()=>{
  assert.match(sql,/get_member_circle_ranks_v1/);
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/auth\\.uid\\(\\)/);
  assert.match(sql,/p\\.is_active=true/);
  assert.match(sql,/buklod_is_platform_official_v1/);
  assert.doesNotMatch(sql,/p\\.is_verified/);
  assert.doesNotMatch(sql,/(?:update|insert into|delete from)\\s+public\\.buklod_user_points_balances/i);
  assert.doesNotMatch(sql,/(?:update|insert into|delete from)\\s+public\\.buklod_points_ledger/i);
});
test('Notes retain ownership, 80-character validation, and no expiry across legacy clients',()=>{
  assert.match(sql,/v_user uuid := auth\\.uid\\(\\)/);
  assert.match(sql,/char_length\\(v_note\\) > 80/);
  assert.match(sql,/user_id,\\s+quick_note,\\s+quick_note_expires_at/);
  assert.match(sql,/new\\.quick_note_expires_at := null/);
  assert.match(sql,/BEFORE INSERT OR UPDATE OF quick_note, quick_note_expires_at/i);
  assert.doesNotMatch(sql,/drop policy|create policy|grant all|revoke all/i);
});
