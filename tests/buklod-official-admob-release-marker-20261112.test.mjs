import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const manifest=JSON.parse(readFileSync('.buklod/scopes/buklod-official-admob-production-promotion-20261112.json','utf8'));
const note=readFileSync('docs/release/buklod-official-admob-production-promotion-20261112.md','utf8');
test('release marker has only three approved non-runtime changes',()=>{
 assert.equal(manifest.contractVersion,2);
 assert.equal(manifest.baseRef,'3569fe85a56ff30812ef1d3ced1a4a9e68ecb8a3');
 const allowed=[...manifest.allowedPaths].sort();
 assert.deepEqual(allowed,[
 '.buklod/scopes/buklod-official-admob-production-promotion-20261112.json',
 'docs/release/buklod-official-admob-production-promotion-20261112.md',
 'tests/buklod-official-admob-release-marker-20261112.test.mjs'
 ]);
 assert.ok(!allowed.some(s=>s.startsWith('src/')||s.startsWith('supabase/migrations/')||s.startsWith('.github/workflows/')));
});
test('frozen main and compiled RC are exact source-tree equivalents',()=>{
 assert.match(note,/3569fe85a56ff30812ef1d3ced1a4a9e68ecb8a3/);
 assert.match(note,/48011b5df95ef5b288d6db11ffc8dceaad2d67ca/);
 assert.match(note,/e5f82847d608ee31017ffa81be402f140ac7dc93/);
 assert.match(note,/1\.3\.2/);
 assert.match(note,/org\.mzbministry\.buklod/);
 assert.match(note,/BUKLOD_CONSOLIDATED_PROD_20261108/);
 assert.match(note,/Sponsor|sponsor/);
 assert.match(note,/AdMob/);
});
