import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261118143054_buklod_rank_sync_permanent_notes_hotfix_20261118.sql',import.meta.url),'utf8');
test('Rank display reads canonical totals and retains active authenticated member access',()=>{
  assert.ok(sql.includes('get_member_circle_ranks_v1'));
  assert.ok(sql.includes('SECURITY DEFINER'));
  assert.ok(sql.includes('auth.uid()'));
  assert.ok(sql.includes('p.is_active=true'));
  assert.ok(sql.includes('buklod_is_platform_official_v1'));
  assert.ok(!sql.includes('p.is_verified'));
  assert.ok(sql.includes('buklod_user_points_balances'));
  assert.ok(sql.includes('buklod_rank_levels'));
  assert.doesNotMatch(sql,/(?:update|insert into|delete from)\s+public\.buklod_user_points_balances/i);
  assert.doesNotMatch(sql,/(?:update|insert into|delete from)\s+public\.buklod_points_ledger/i);
});
test('Notes retain their owner, length validation, and enforced permanence',()=>{
  assert.ok(sql.includes('v_user uuid := auth.uid()'));
  assert.ok(sql.includes('char_length(v_note) > 80'));
  assert.ok(sql.includes('user_id,'));
  assert.ok(sql.includes('quick_note_expires_at'));
  assert.ok(sql.includes('new.quick_note_expires_at := null'));
  assert.ok(sql.toLowerCase().includes('before insert or update of quick_note, quick_note_expires_at'));
  assert.doesNotMatch(sql,/drop policy|create policy|grant all|revoke all/i);
});
