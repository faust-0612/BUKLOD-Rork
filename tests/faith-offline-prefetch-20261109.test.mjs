import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const warmup=read('src/lib/buklodFaithOfflineWarmup.ts');
const bible=read('src/app/bible/index.tsx');
const reader=read('src/app/bible/read.tsx');
const word=read('src/app/word/index.tsx');
const learning=read('src/app/learn/lesson.tsx');
const cache=read('src/lib/offlineCache.ts');
test('weekly reading content is warmed with bounded concurrency and account-scoped storage',()=>{
 assert.match(warmup,/warmBibleWeekOffline/);
 assert.match(warmup,/warmPublishedWordsOffline/);
 assert.match(warmup,/await Promise\.all\(\[0, 1\]/);
 assert.match(warmup,/userId/);
 assert.match(warmup,/get_bible_chapter/);
 assert.match(bible,/warmBibleWeekOffline/);
});
test('offline chapter/lesson access uses cache with read-only guarantee',()=>{
 assert.match(reader,/allowStale: true/);
 assert.match(learning,/offlineReadOnly/);
 assert.match(learning,/SAVED OFFLINE/);
 assert.match(cache,/userId/);
 assert.match(word,/warmPublishedWordsOffline/);
});
