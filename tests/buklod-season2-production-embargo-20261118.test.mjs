import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const guard=require('../scripts/buklod-season2-production-embargo.cjs');
const sha='a'.repeat(40),withSeason=[{file:'src/lib/buklodSeason2CampaignR1.ts'}];
const now=(s)=>new Date(s);
test('before midnight Dec 6 PHT Season2 production is forbidden even with authorization',()=>{
  assert.equal(guard.NOT_BEFORE_UTC,'2026-12-05T16:00:00.000Z');
  const record={version:1,authorized:true,sourceSha:sha,productionScope:'season2'};
  for(const x of guard.REQUIRED_APPROVAL_EVIDENCE)record[x]='verified-evidence-'+x;
  assert.equal(guard.evaluateRelease({target:'production',
    now:now('2026-12-05T15:59:59.999Z'),sourceSha:sha,
    season2Files:withSeason,approval:record}).allowed,false);
  assert.equal(guard.evaluateRelease({target:'production',
    now:now('2026-12-05T16:00:00.000Z'),sourceSha:sha,
    season2Files:withSeason}).allowed,false);
});
test('after Dec 6 Season2 remains blocked despite historical authorization',()=>{
  const record={version:1,authorized:true,sourceSha:sha,productionScope:'season2'};
  for(const x of guard.REQUIRED_APPROVAL_EVIDENCE)record[x]='verified-evidence-'+x;
  const args={target:'production',now:now('2026-12-06T00:00:00Z'),
    sourceSha:sha,season2Files:withSeason};
  assert.equal(guard.evaluateRelease({...args,approval:record}).allowed,false);
   assert.equal(
     guard.evaluateRelease({...args,approval:record}).reason,
     'SEASON2_PRODUCTION_EXPLICIT_OWNER_HOLD'
   );
  assert.equal(guard.evaluateRelease({...args,approval:{...record,sourceSha:'b'.repeat(40)}}).allowed,false);
  for(const x of guard.REQUIRED_APPROVAL_EVIDENCE)
    assert.equal(guard.evaluateRelease({...args,approval:{...record,[x]:''}}).allowed,false);
});
test('nonseason fixes can be considered under the unchanged AdMob/RC gates before Dec6',()=>{
  const a=guard.evaluateRelease({target:'production',now:now('2026-11-18T06:00:00Z'),
    sourceSha:sha,season2Files:[]});
  assert.equal(a.allowed,true);assert.match(a.reason,/NORMAL_GATES/);
});
test('staging Season2 is not embargoed; unknown target fails',()=>{
  assert.equal(guard.evaluateRelease({target:'staging',now:now('2026-11-18T06:00:00Z'),
    sourceSha:sha,season2Files:withSeason}).allowed,true);
  assert.equal(guard.evaluateRelease({target:'other',now:now('2026-11-18T06:00:00Z'),
    sourceSha:sha,season2Files:[]}).allowed,false);
});
test('renamed shared Points integration is detected even without canonical Season2 file',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-embargo-'));
  try{
    const dir=path.join(root,'src','components','points');
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'BuklodPointsRewardsScreen.tsx'),
      "import V2 from '@/components/points/BuklodSeasonJourneyPreview';");
    assert.ok(guard.runtimeEvidence(root).some(x=>x.reason==='season2-import'));
    fs.mkdirSync(path.join(root,'src','lib'),{recursive:true});
    fs.writeFileSync(path.join(root,'src/lib/buklodSeason2CampaignR1.ts'),'export const x=1');
    assert.ok(guard.runtimeEvidence(root).some(x=>x.reason==='package-file'));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('main production source contains no Season2 payload by default',()=>{
  assert.deepEqual(guard.runtimeEvidence(),[]);
});
test('canonical Android OTA and web production pipelines check before install AND EAS publication',()=>{
  const cmd='node scripts/buklod-season2-production-embargo.cjs --production';
  for(const [file,publish] of [
    ['.github/workflows/production_android_ota.yml','update --channel production'],
    ['.github/workflows/production_web_deploy.yml','deploy --prod']]){
    const s=fs.readFileSync(file,'utf8');
    const first=s.indexOf(cmd),last=s.lastIndexOf(cmd);
    assert.ok(first>0&&last>first,file);
    assert.ok(first<s.indexOf('npm ci --ignore-scripts'),file+' early');
    assert.ok(last<s.indexOf(publish),file+' publish');
  }
});
test('policy is source only, no runtime backend or EAS write side effects',()=>{
  const content=fs.readFileSync('scripts/buklod-season2-production-embargo.cjs','utf8');
  assert.doesNotMatch(content,/eas-cli|supabase\.from|\.rpc\(|fetch\(/);
});
