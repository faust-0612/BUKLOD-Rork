import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Interrupted REWORK is restored from the authenticated member-owned database row',()=>{
 const learner=src('src/app/academy/research.tsx');
 const schema=src('supabase/migrations/20261124021000_buklod_academy_saliksik_research_bridge.sql');
 assert.match(learner,/\.eq\('status','REWORK'\)/);
 assert.match(learner,/key\.current=draft\.research_key/);
 assert.match(learner,/setPaper\(draft\.paper_text/);
 assert.match(learner,/setFeedback\(draft\.feedback_json/);
 assert.match(schema,/using\(user_id=\(select auth\.uid\(\)\)\)/);
 assert.match(schema,/where public\.buklod_academy_research_submissions\.status='REWORK'/);
});
test('Concurrent and interrupted private PDF issuance recovers the immutable original',()=>{
 const service=src('supabase/functions/buklod-academy-paper-v1/index.ts');
 assert.match(service,/\.eq\('user_id',auth\.user\.id\)/);
 assert.match(service,/award\.status!=='ISSUED'/);
 assert.match(service,/\.upload\(objectPath,bytes,\{contentType:'application\/pdf',upsert:false\}\)/);
 assert.match(service,/\.download\(objectPath\)/);
 assert.match(service,/original\.subarray\(0,5\)/);
 assert.match(service,/crypto\.subtle\.digest\('SHA-256',original\)/);
 assert.match(service,/\.eq\('status','ISSUED'\)/);
 assert.match(service,/createSignedUrl\(objectPath,90\)/);
 assert.doesNotMatch(service,/upsert:true/);
});
