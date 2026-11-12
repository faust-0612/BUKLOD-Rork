import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const operations=readFileSync('src/app/admin/bsoc-support.tsx','utf8');
const inbox=readFileSync('src/app/admin/bsoc-conversations.tsx','utf8');
test('both BSOC lists page through authorized RPC with bounded cursor',()=>{
 for(const s of [operations,inbox]){
  assert.match(s,/buklod_bsoc_support_queue_v1/);
  assert.match(s,/p_limit:100,p_before:cursor/);
  assert.match(s,/setMoreAvailable\(rows\.length===100\)/);
  assert.match(s,/Load older support cases/);
  assert.match(s,/queueGeneration\.current/);
  assert.match(s,/known=new Set\(previous\.map\(c=>c\.feedback_id\)\)/);
 }
});
test('changing account or queue filter invalidates stale pages',()=>{
 assert.match(inbox,/queueGeneration\.current\+=1/);
 assert.match(inbox,/setCases\(\[\]\);setMoreAvailable\(false\);setQueueLoaded\(false\)/);
 assert.match(operations,/queueGeneration\.current\+=1;setStatus\(s\)/);
});
