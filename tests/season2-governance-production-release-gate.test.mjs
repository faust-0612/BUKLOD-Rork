import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const guard=require('../scripts/buklod-season2-production-embargo.cjs');
const canonical=JSON.parse(fs.readFileSync('contracts/season2-implementation-ledger.json','utf8'));
test('production Season2 cannot ship when any game backend/RC step is only PLANNED',()=>{
 assert.throws(()=>guard.enforceSeason2Readiness(),/WORKSTREAMS_INCOMPLETE/);
});
test('honest verified records are required, not manual checkboxes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-s2-production-'));
 try{
  fs.mkdirSync(path.join(root,'contracts'),{recursive:true});
  fs.copyFileSync('contracts/season2-governance.json',path.join(root,'contracts/season2-governance.json'));
  const claimed=structuredClone(canonical);
  for(const t of claimed.workstreams){
   if(t.requiredForLaunch){t.status='RC_VERIFIED';t.evidence=[];}
  }
  fs.writeFileSync(path.join(root,'contracts/season2-implementation-ledger.json'),JSON.stringify(claimed));
  assert.throws(()=>guard.enforceSeason2Readiness(root),/WORKSTREAMS_INCOMPLETE/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('existing Dec6 owner exact-SHA embargo is still first and independent',()=>{
 const sha='a'.repeat(40),files=[{file:'src/lib/buklodSeason2CampaignR1.ts'}];
 const r=guard.evaluateRelease({target:'production',sourceSha:sha,season2Files:files,
  now:new Date('2026-11-18T00:00:00Z'),approval:null});
 assert.equal(r.allowed,false);
 assert.equal(r.reason,'SEASON2_PRODUCTION_EMBARGO_BEFORE_DEC_6');
 const unrelated=guard.evaluateRelease({target:'production',sourceSha:sha,season2Files:[],
  now:new Date('2026-11-18T00:00:00Z'),approval:null});
 assert.equal(unrelated.allowed,true);
});
test('exact checkout invokes readiness only for season package, after the older release guard',()=>{
 const s=fs.readFileSync('scripts/buklod-season2-production-embargo.cjs','utf8');
 assert.match(s,/if\(files.length\)enforceSeason2Readiness\(root\)/);
 assert.ok(s.indexOf('if(!r.allowed)throw Error')<s.indexOf('if(files.length)enforceSeason2Readiness(root)'));
 assert.doesNotMatch(s,/supabase\.from|\.rpc\(|eas update/);
});
