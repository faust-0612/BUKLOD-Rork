import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/migrations/20261118085622_buklod_season2_production_promos_2026.sql','utf8');
test('Approved five schedules are 10 AM Manila, no live game claims',()=>{
 for(const day of ['2026-11-22','2026-11-29','2026-12-03','2026-12-05','2026-12-06'])
  assert.ok(sql.includes(day+' 10:00:00+08'),day);
 assert.match(sql,/season2_content_live',false/);
 assert.doesNotMatch(sql,/update public\.buklod_rank_seasons|buklod_points_ledger|eas update/i);
});
test('Rollback original Home board only if admin has not changed it',()=>{
 assert.match(sql,/original_message/);assert.match(sql,/admin_override/);
 assert.match(sql,/b\.updated_at is not distinct from s\.last_at/);
 assert.match(sql,/restored=true/);
});
test('Dedup, RLS, daytime, opt-out and bounded push',()=>{
 assert.match(sql,/primary key\(event_key,user_id\)/);
 assert.match(sql,/enable row level security/g);
 assert.match(sql,/pref\.announcements=true/);
 assert.match(sql,/v_time>=time '18:00'/);
 assert.match(sql,/order by p\.id limit 20/);
 assert.match(sql,/revoke all on function private\.buklod_s2_promo_tick_2026/);
});
