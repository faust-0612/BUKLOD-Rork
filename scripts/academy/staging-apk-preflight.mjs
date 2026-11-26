#!/usr/bin/env node
// Read-only preflight. This is NOT an APK builder and never contacts production.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const env=process.env;
const failures=[];
const ensure=(check,message)=>{if(!check)failures.push(message)};
const prodRef='yhanxndaqbmuzbdqlblu';
const target=env.STAGING_SUPABASE_URL||env.EXPO_PUBLIC_SUPABASE_URL||'';
ensure(env.APP_VARIANT==='staging'&&env.EXPO_PUBLIC_APP_ENV==='staging','STAGING_VARIANT_REQUIRED');
ensure(env.BUKLOD_APP_TARGET==='main','MAIN_APP_TARGET_REQUIRED');
ensure(Boolean(target),'DEDICATED_STAGING_SUPABASE_URL_REQUIRED');
if(target){
 let host='';
 try{host=new URL(target).hostname;}catch{}
 ensure(/^[a-z0-9-]+\.supabase\.co$/.test(host),'INVALID_STAGING_SUPABASE_HOST');
 ensure(!host.includes(prodRef),'PRODUCTION_SUPABASE_FORBIDDEN');
}
ensure(Boolean(env.STAGING_SUPABASE_PUBLISHABLE_KEY),'STAGING_PUBLISHABLE_KEY_REQUIRED');
ensure(env.EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW!=='true','SHARED_LIVE_BACKEND_FLAG_FORBIDDEN');
let app=null;
try{app=require('../../app.config.js')({config:{}});}catch{failures.push('APP_CONFIG_UNAVAILABLE');}
if(app){
 ensure(app.android?.package==='org.mzbministry.buklod.staging','PACKAGE_MUST_BE_STAGING');
 ensure(String(app.runtimeVersion||'').includes('genesis'),'GENESIS_RUNTIME_REQUIRED');
}
const result={status:failures.length?'BLOCKED_BEFORE_APK':'SOURCE_CONFIG_PRECHECK_ONLY',checks_failed:failures,package:app?.android?.package||'UNKNOWN',runtime:app?.runtimeVersion||'UNKNOWN',production_touched:false,apk_built:false};
console.log(JSON.stringify(result,null,2));
if(failures.length)process.exitCode=1;
