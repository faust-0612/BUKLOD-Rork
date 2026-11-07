import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all points receipt ads are optional post-confirmation and claim keeps existing no-block ad',()=>{
 const lib=read('src/lib/buklodAdOpportunities.ts');
 assert.match(lib,/points_submission_success/);
 assert.match(lib,/points_claim_success/);
 assert.match(lib,/never stall a user action waiting for a network ad/i);
 for(const p of ['src/app/faith/bible-quiz.tsx','src/components/BuklodHomeCheckinToday.tsx','src/app/faith/mentor-evidence.tsx','src/components/points/BuklodR2FocusMonitor.tsx']){
  assert.match(read(p),/showBuklodAdOpportunity\('points_submission_success'\)/,p);
 }
});
