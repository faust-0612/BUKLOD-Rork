const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const author=fs.readFileSync('supabase/migrations/20261124020500_abaka_doctrine_admin_authoring.sql','utf8');
const rewards=fs.readFileSync('supabase/migrations/20261124005500_abaka_continuing_doctrine_rewards.sql','utf8');
const admin=fs.readFileSync('src/app/faith/abc/admin.tsx','utf8');
test('IDs do not truncate at 10000 and prerequisite order is numeric',()=>{
 assert.match(author,/lpad\(next_number,greatest\(4,length\(next_number\)\)/);
 assert.match(author,/split_part\(d.lesson_id,'-',2\)::numeric < pg_catalog.split_part\(lesson_row.lesson_id,'-',2\)::numeric/);
 assert.equal((author.match(/pg_advisory_xact_lock\(4204, 20261124\)/g)||[]).length,2);
 assert.match(rewards,/where lesson_id=normalized_id and published=true for share/);
});
test('historically published lessons are immutable and editor paging is bounded',()=>{
 assert.match(author,/a.lesson_id=saved.lesson_id and a.action='publish'/);
 assert.match(author,/buklod_abc_doctrine_admin_list_v2\(p_before_id text default null\)/);
 assert.match(author,/desc,l.lesson_id desc limit 80/);
 assert.match(admin,/contentLocked=Boolean\(selected\?\.published\|\|selected\?\.content_locked\)/);
 assert.match(admin,/p_before_id:rows\[rows.length-1\].lesson_id/);
 assert.match(admin,/AccountScopedAbakaAdminStudio key=/);
 assert.match(admin,/prior.map\(\(block,i\)/);
});
