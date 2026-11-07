import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const files = [
  'content/word/2026-11/november-01-10.json',
  'content/word/2026-11/november-11-20.json',
  'content/word/2026-11/november-21-30.json',
];
const entries = files.flatMap(f => JSON.parse(fs.readFileSync(f,'utf8')));
const migration = fs.readFileSync('supabase/migrations/20261107093220_word_november_2026_complete_publication.sql','utf8');

test('November Word has thirty distinct, complete Scripture-grounded days', () => {
  assert.equal(entries.length,30);
  assert.equal(new Set(entries.map(x=>x.day)).size,30);
  assert.equal(new Set(entries.map(x=>x.title)).size,30);
  assert.equal(new Set(entries.map(x=>x.reflection_text)).size,30);
  for(const [i,row] of entries.entries()){
    assert.equal(row.day,i+1);
    for(const key of ['title','bible_passage','key_verse','scripture_text','reflection_text',
                       'think_about_it','application_text','prayer_text']) assert.ok(row[key]?.trim(),key+' day '+row.day);
    assert.ok(row.reflection_text.length>=350,'short reflection day '+row.day);
    assert.match(row.scripture_text,/^Buod ng talata \(hindi tuwirang sipi\): /);
  }
});

test('idempotent November migration preserves historical archives and avoids recycling', () => {
  assert.match(migration,/BUKLOD Daily Devotion — November 2026/);
  assert.match(migration,/November dates belong to another Daily Devotion series/);
  assert.match(migration,/Word editorial conflict for November day/);
  assert.match(migration,/WHERE NOT EXISTS\(/);
  assert.match(migration,/v->>'prayer_text',true,true,2/);
  for(const e of entries) assert.ok(migration.includes(JSON.stringify(e).slice(1,-1)),'devotion not embedded: '+e.day);
});

test('daily route, reminders and monitor use exact Philippine day', () => {
  assert.match(migration,/public\.get_my_daily_devotional\(\)/);
  assert.match(migration,/public\.buklod_require_active_cluster_membership\(actor\)/);
  assert.match(migration,/d\.publish_date=v_today/);
  assert.doesNotMatch(migration,/d\.publish_date <= v_today/);
  assert.match(migration,/public\.ensure_buklod_daily_devotion_schedule/);
  assert.match(migration,/RAISE EXCEPTION 'BUKLOD daily Word gap:/);
  assert.match(migration,/REVOKE EXECUTE ON FUNCTION public\.queue_formation_reminders_v1\(\)/);
  assert.match(migration,/UPDATE public\.notifications n/);
});
