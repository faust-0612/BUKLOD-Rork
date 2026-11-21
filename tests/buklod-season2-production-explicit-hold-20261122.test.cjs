'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
 evaluateRelease,approvedRecord,
 FORBIDDEN_PATHS,FORBIDDEN_IMPORT_MARKERS,REQUIRED_APPROVAL_EVIDENCE
}=require('../scripts/buklod-season2-production-embargo.cjs');
const read=p=>fs.readFileSync(p,'utf8');

const sourceSha='a'.repeat(40);
const approval={
 version:1,authorized:true,sourceSha,productionScope:'season2',
 ...Object.fromEntries(REQUIRED_APPROVAL_EVIDENCE.map(k=>[k,'verified-evidence-'+k]))
};
test('Season 2 production APK, AAB and OTA remain forbidden before and after scheduled season date',()=>{
 assert.equal(approvedRecord(approval,sourceSha),true,'even valid old release approval cannot bypass new owner hold');
 for(const now of [new Date('2026-11-22T00:00:00Z'),new Date('2026-12-06T00:00:00Z'),new Date('2030-02-03T00:00:00Z')]){
  const v=evaluateRelease({target:'production',now,sourceSha,
   season2Files:[{file:'src/features/season2/genesis/GenesisApprovedEntryMap.tsx'}],approval});
  assert.equal(v.allowed,false);
  assert.equal(v.reason,'SEASON2_PRODUCTION_EXPLICIT_OWNER_HOLD');
 }
});
test('staging may continue through its normal release gates and independent production fixes are not blocked',()=>{
 const at=new Date('2027-01-15T00:00:00Z');
 assert.equal(evaluateRelease({target:'staging',now:at,sourceSha,season2Files:[{file:'src/features/season2/genesis'}]}).allowed,true);
 assert.equal(evaluateRelease({target:'production',now:at,sourceSha,season2Files:[]}).allowed,true);
 assert.equal(evaluateRelease({target:'production',now:at,sourceSha,season2Files:null}).allowed,false);
 assert.ok(FORBIDDEN_PATHS.includes('src/features/season2/genesis'));
 assert.ok(FORBIDDEN_IMPORT_MARKERS.includes('BUKLOD_SEASON2_CAMPAIGN'));
});
test('production release entry point invokes embargo before build/export/publish',()=>{
 const flow=read('.github/workflows/production_android_ota.yml');
 assert.match(flow,/branches: \[main\]/);
 const embargo=flow.indexOf('node scripts/buklod-season2-production-embargo.cjs --production');
 const build=flow.indexOf('Expo credential preflight');
 const publish=flow.indexOf('Publish exact frozen Android RC');
 assert.ok(embargo>0 && embargo<build && embargo<publish);
 assert.match(flow,/github\.ref == 'refs\/heads\/main'/);
 const eas=JSON.parse(read('eas.json'));
 assert.equal(eas.build.production.channel,'production');
 assert.equal(eas.build.production.env.APP_VARIANT,'production');
 assert.equal(eas.build['season2-genesis-preview'].channel,'season2-genesis-preview');
 assert.notEqual(eas.build.production.channel,eas.build['season2-genesis-preview'].channel);
 const config=read('app.config.js');
 assert.match(config,/genesisNativePreview[\s\S]{0,150}isStaging/);
 assert.match(config,/sosNativePreview = genesisNativePreview/);
 assert.match(config,/genesisNativePreview \? '2\.0\.0-genesis-preview' : '1\.3\.2'/);
});
