import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Cluster and Bible achieve compact layout without truncating reading or navigation',()=>{
  const cluster=read('src/app/clusters/index.tsx');
  const daily=read('src/app/bible/index.tsx');
  const reader=read('src/app/bible/read.tsx');
  assert.match(cluster,/directorySection:\s*\{ gap: 5 \}/);
  assert.match(cluster,/card:\s*\{[\s\S]{0,220}paddingHorizontal:\s*10,\s*paddingVertical:\s*6/);
  assert.match(daily,/content:\{paddingBottom:40,gap:8\}/);
  assert.match(reader,/paddingBottom:\s*readerScrollBottom/);
  assert.match(reader,/verseReaderCard:\s*\{\s*paddingHorizontal:\s*0/);
  assert.ok(reader.includes('Matthew Henry'));
});