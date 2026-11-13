import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const s=fs.readFileSync(new URL('../src/app/profile/buklod-health.tsx',import.meta.url),'utf8');
test('IMCI child health guide supports separate infant, child and older age paths',()=> {
 for(const x of ['0–2 months','2 months–under 5 years','5 years and older','ASSESS','CLASSIFY','IDENTIFY CARE','TREAT & REFER','COUNSEL','FOLLOW UP'])assert.ok(s.includes(x),x);
 assert.match(s,/locally adopted IMCI guidance/);assert.match(s,/this app does not label severity/);
});
test('Emergency triage blocks unsafe AI consultation, no clinical advice made available by new guide',()=>{
 assert.match(s,/!BUKLOD_HEALTH_CONSULTATION_READY/);assert.match(s,/urgency !== 'none'/);
 assert.match(s,/tel:911/);
});
