// Guards for ABaKa doctrine feature. No database is mutated by these tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(path,'utf8');
const sql = read('supabase/migrations/20261124005500_abaka_continuing_doctrine_rewards.sql');
const catalog = read('src/data/faith/abcDoctrinalCatalog.ts');
const list = read('src/app/faith/abc/index.tsx');
const detail = read('src/app/faith/abc/[lessonId].tsx');

test('published-only catalog, private answers and no direct writes', () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /using \(published = true\)/);
  assert.match(sql, /private\.buklod_abc_doctrinal_answers/);
  assert.match(sql, /revoke all on private\.buklod_abc_doctrinal_answers from public, anon, authenticated/);
  assert.match(sql, /grant select on public\.buklod_abc_doctrinal_lessons to authenticated/);
});
test('points derived server-side from difficulty and bounded per account per day', () => {
  for (const [name, pts] of [['foundation',8],['intermediate',12],['advanced',18],['deep',25]]) {
    assert.ok(sql.includes("when '"+name+"' then "+pts));
    assert.ok(catalog.includes(name+': '+pts));
  }
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /today_points \+ points_for_level <= 50/);
  assert.match(sql, /on conflict\(user_id,source_key\) do nothing/);
  assert.match(sql, /prerequisite_id/);
  assert.match(sql, /count\(distinct lower\(word\)\)/);
  assert.match(sql, /already_completed',true/);
  assert.match(sql, /quiz_cooldown/);
  assert.match(sql, /private\.buklod_abc_doctrine_quiz_attempts/);
  assert.match(sql, /private\.buklod_abc_doctrine_reflection_hashes/);
  assert.match(sql, /reflection_hash := pg_catalog.md5/);
  assert.match(detail, /data\?\.completed !== true/);
});
test('client uses published catalog, verified assessment and actual ledger credits', () => {
  assert.match(list, /loadPublishedDoctrinalLessons/);
  assert.match(detail, /complete_my_abc_doctrinal_lesson_v1/);
  assert.match(detail, /p_answer:/);
  assert.match(detail, /p_reflection:/);
  assert.match(detail, /earnedPoints/);
  assert.match(detail, /if \(lesson\.assessment\) \{/);
  assert.match(detail, /if \(!online\)/);
  assert.doesNotMatch(catalog, /correct_option/);
});
