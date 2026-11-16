import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scanAddedSpacingDiff} from '../scripts/compact-layout-density-gate.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('oversized added padding, margin and gap fail, existing lines do not',()=>{
 const d='+++ b/src/a.tsx\n@@ -1,1 +1,4 @@\n paddingTop: 180,\n+ paddingTop: 48,\n+ marginBottom: 30,\n+ gap: 20,\n';
 assert.equal(scanAddedSpacingDiff(d).length,3);
});
test('safe sizes, justified exceptions and media geometry are preserved',()=>{
 const d='+++ b/src/b.tsx\n@@ -0,0 +1,4 @@\n+ paddingHorizontal: 10, gap: 8,\n+ // layout-density-exception: keyboard clearance requires extra padding here\n+ paddingBottom: 28,\n+ height: 320, minHeight: 48,\n';
 assert.deepEqual(scanAddedSpacingDiff(d),[]);
});
test('exceptions cannot leak into the next file',()=>{
 const d='+++ b/src/a.tsx\n@@ -0,0 +1,2 @@\n+ // layout-density-exception: large safe-area overlay is intentional here\n+ paddingBottom: 30,\n+++ b/src/b.tsx\n@@ -0,0 +1 @@\n+ paddingBottom: 30,\n';
 assert.equal(scanAddedSpacingDiff(d).length,1);
});
test('mandatory engineering gate executes density scan',()=>{
 const s=read('scripts/engineering-regression-gate.mjs');
 assert.match(s,/scanAddedSpacingDiff\(spacingDiff\)/);
 assert.match(s,/LAYOUT DENSITY BLOCK:/);
});
