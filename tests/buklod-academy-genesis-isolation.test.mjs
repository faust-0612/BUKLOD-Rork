import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const file=new URL('../scripts/academy/staging-apk-preflight.mjs',import.meta.url);
const run=(env)=>spawnSync(process.execPath,[file.pathname],{env:{...process.env,...env},encoding:'utf8'});
const base={APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',BUKLOD_APP_TARGET:'main',STAGING_SUPABASE_URL:'https://mock-staging-project.supabase.co',STAGING_SUPABASE_PUBLISHABLE_KEY:'test-only-not-a-real-token',EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW:'false'};
test('Never permit BUKLOD MAIN Supabase into Academy staging Android release',()=>{
 const r=run({...base,STAGING_SUPABASE_URL:'https://yhanxndaqbmuzbdqlblu.supabase.co'});
 assert.equal(r.status,1,r.stderr);
 assert.equal(JSON.parse(r.stdout).checks_failed.includes('PRODUCTION_SUPABASE_FORBIDDEN'),true);
});
test('Never permit explicit shared-backend Genesis release mode',()=>{
 const r=run({...base,EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW:'true'});
 assert.equal(r.status,1,r.stderr);
 assert.ok(JSON.parse(r.stdout).checks_failed.includes('SHARED_LIVE_BACKEND_FLAG_FORBIDDEN'));
});
test('Fail closed when no isolated staging credentials were supplied',()=>{
 const r=run({...base,STAGING_SUPABASE_URL:'',EXPO_PUBLIC_SUPABASE_URL:'',STAGING_SUPABASE_PUBLISHABLE_KEY:''});
 assert.equal(r.status,1,r.stderr);
 assert.ok(JSON.parse(r.stdout).checks_failed.includes('DEDICATED_STAGING_SUPABASE_URL_REQUIRED'));
});
test('Static staging config check never claims a built APK or deploys',()=>{
 const r=run(base);
 assert.ok([0,1].includes(r.status),r.stderr);
 const check=JSON.parse(r.stdout);
 assert.equal(check.production_touched,false);
 assert.equal(check.apk_built,false);
});
test('The consolidated QA workflows cannot publish or access production backend',()=>{
 for(const path of ['.github/workflows/genesis-206-academy-conso-staging-source-qa.yml','.github/workflows/genesis-206-academy-typecheck-qa.yml']){
  const yml=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.doesNotMatch(yml,/eas update|eas build|supabase db push|supabase functions deploy|gh release create|production\.supabase/);
  assert.match(yml,/persist-credentials: false/);
 }
});
