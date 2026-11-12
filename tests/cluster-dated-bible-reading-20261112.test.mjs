import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
const read = f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const paths=['src/app/bible/index.tsx','src/app/bible/read.tsx','src/lib/buklodFaithOfflineWarmup.ts'];
const sql=read('supabase/migrations/20261112024000_cluster_authorized_dated_bible_reading.sql');
test('dated plan is Cluster gated without exposing low-level function',()=>{
 assert.match(sql,/get_automatic_bible_today\(\)/);
 assert.match(sql,/auth\.uid\(\) is null/);
 assert.match(sql,/revoke all.*from PUBLIC, anon/i);
 assert.match(sql,/to authenticated/i);
});
test('all live BUKLOD daily reading callsites use gated RPC',()=>{
 for (const path of paths) {
  const code=read(path);
  assert.ok(code.includes("'get_automatic_bible_reading_for_cluster'"),path);
  assert.ok(!code.includes("'get_automatic_bible_reading'"),path);
 }
});
