#!/usr/bin/env node
'use strict';
// DEV-only read-only policy checks. This script never grants points,
// sends push, changes Supabase, publishes OTA, or claims real telemetry.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const POLICY=()=>load(path.join(root,'contracts/season2-governance.json'));
const LEDGER=()=>load(path.join(root,'contracts/season2-implementation-ledger.json'));
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?
  Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
function digest(p){return crypto.createHash('sha256').update(JSON.stringify(
  stable({id:p.id,season:p.season,changes:p.changes}))).digest('hex');}
function validatePolicy(p){
  const errors=[];
  if(p?.schemaVersion!==1||p?.season!==2||p?.ownerGitHubLogin!=='faust-0612')
    errors.push('BAD_POLICY_IDENTITY');
  if(p?.productionEmbargoUntilManila!=='2026-12-06T00:00:00+08:00')
    errors.push('EMBARGO_DRIFT');
  if(!p?.decisions||Object.keys(p.decisions).length<15)errors.push('INCOMPLETE_DECISIONS');
  for(const [k,v] of Object.entries(p?.decisions||{}))
    if(!v.value||!v.reason||!['HARD_BOUNDARY','OWNER_REVIEW'].includes(v.severity))
      errors.push('INVALID_DECISION:'+k);
  if(!Array.isArray(p?.releaseGates)||p.releaseGates.length<10)errors.push('INCOMPLETE_RELEASE_GATES');
  return {ok:errors.length===0,errors};
}
function proposalReview(p,policy,{ownerReviewed=false}={}){
  const errors=[],warnings=[],exceptions=[];
  if(!p||typeof p.id!=='string'||p.id.length<6||p.season!==2||
    !p.changes||typeof p.changes!=='object'||Array.isArray(p.changes)||
    Object.keys(p.changes).length===0)
    return {allowedForDesign:false,readyForProduction:false,errors:['INVALID_PROPOSAL'],warnings,exceptions};
  const hash=digest(p);
  for(const [key,value] of Object.entries(p.changes)){
    const decision=policy.decisions[key];
    if(!decision){warnings.push({key,code:'UNKNOWN_RULE',action:'REVIEW_AND_VERSION_POLICY'});
      errors.push('UNKNOWN_RULE:'+key);continue;}
    if(JSON.stringify(value)===JSON.stringify(decision.value))continue;
    warnings.push({key,code:'POLICY_CONFLICT',expected:decision.value,proposed:value,
      severity:decision.severity,reason:decision.reason});
    if(decision.severity==='HARD_BOUNDARY'){
      errors.push('SEPARATE_SAFETY_APPROVAL_REQUIRED:'+key);continue;
    }
    const a=p.approval;
    if(ownerReviewed===true&&a?.proposalDigest===hash&&
      a?.ownerGitHubLogin===policy.ownerGitHubLogin&&
      typeof a?.decisionId==='string'&&a.decisionId.length>=8&&
      typeof a?.reason==='string'&&a.reason.length>=12&&
      Array.isArray(a.acceptedKeys)&&a.acceptedKeys.includes(key))exceptions.push(key);
    else errors.push('OWNER_REVIEW_REQUIRED:'+key);
  }
  return {allowedForDesign:errors.length===0,readyForProduction:false,
    proposalDigest:hash,warnings,errors,exceptions,
    note:'Owner approval modifies design only; release, RLS and embargo remain independent.'};
}
const statuses=['PLANNED','DEV_IMPLEMENTED','CI_VERIFIED','STAGING_SERVER_VERIFIED',
 'RC_VERIFIED','PRODUCTION_VERIFIED','BLOCKED'];
function readiness(l){
  const errors=[],pending=[],seen=new Set();
  if(l?.schemaVersion!==1||l?.season!==2||
    !Array.isArray(l?.workstreams)||l.workstreams.length<10)
    errors.push('INVALID_LEDGER');
  if(l?.productionAuthorized!==false)errors.push('LEDGER_CANNOT_AUTHORIZE_PRODUCTION');
  for(const x of l?.workstreams||[]){
    if(!x.id||seen.has(x.id)||!statuses.includes(x.status))errors.push('BAD_WORKSTREAM:'+x.id);
    seen.add(x.id);
    if(!Array.isArray(x.evidence)||!Array.isArray(x.limitations))errors.push('BAD_EVIDENCE:'+x.id);
    if(['CI_VERIFIED','STAGING_SERVER_VERIFIED','RC_VERIFIED','PRODUCTION_VERIFIED'].includes(x.status)&&
      (!Array.isArray(x.evidence)||x.evidence.length===0))errors.push('UNPROVEN_VERIFIED_STATUS:'+x.id);
    if(x.requiredForLaunch&&!['RC_VERIFIED','PRODUCTION_VERIFIED'].includes(x.status))
      pending.push({id:x.id,status:x.status,limitations:x.limitations});
  }
  return {valid:errors.length===0,readyForLaunch:errors.length===0&&pending.length===0,
    errors,pending,notProductionAuthorization:true};
}
function health(s,p){
  const alerts=[],cfg=p.telemetry,meta=s?.meta;
  const add=(color,code,minutes,value)=>alerts.push({color,code,minutes,value});
  if(!meta||!/^[0-9a-f]{40}$/.test(meta.sourceSha||'')||!meta.appVersion||
    !meta.runtimeVersion||!meta.otaId||!Array.isArray(s.windows))
    return {color:'YELLOW',alerts:[{color:'YELLOW',code:'UNKNOWN_EXACT_BUILD'}],
      liveVerified:false,autoFix:false};
  for(const minutes of cfg.windowsMinutes){
    const w=s.windows.find(x=>x.minutes===minutes);
    if(!w){add('YELLOW','WINDOW_MISSING',minutes,null);continue;}
    if(['sourceSha','appVersion','runtimeVersion','otaId'].some(k=>w[k]!==meta[k])){
      add('RED','MIXED_BUILD_WINDOW',minutes,null);continue;}
    if(!Number.isInteger(w.sessions)||w.sessions<cfg.minSessions){
      add('YELLOW','LOW_SAMPLE',minutes,w.sessions);continue;}
    const rate=k=>typeof w[k]==='number'&&w[k]>=0&&w[k]<=1?w[k]:null;
    const crash=rate('crashRate'),ad=rate('adFirstViewReadyRate'),decline=rate('adFillRelativeDecline');
    if(crash===null)add('YELLOW','CRASH_RATE_UNKNOWN',minutes,null);
    else if(crash>=cfg.crashRedRate)add('RED','CRASH_RATE',minutes,crash);
    else if(crash>=cfg.crashWarningRate)add('YELLOW','CRASH_RATE',minutes,crash);
    if(!Number.isFinite(w.navigationP95Ms))add('YELLOW','NAV_UNKNOWN',minutes,null);
    else if(w.navigationP95Ms>=cfg.navRedMs)add('RED','SLOW_NAV',minutes,w.navigationP95Ms);
    else if(w.navigationP95Ms>=cfg.navWarningMs)add('YELLOW','SLOW_NAV',minutes,w.navigationP95Ms);
    if(ad===null)add('YELLOW','FIRST_VIEW_AD_UNKNOWN',minutes,null);
    else if(ad<cfg.adReadyRedRate)add('RED','FIRST_VIEW_AD_LOSS',minutes,ad);
    else if(ad<cfg.adReadyWarningRate)add('YELLOW','FIRST_VIEW_AD_LOSS',minutes,ad);
    if(decline===null)add('YELLOW','AD_FILL_BASELINE_UNKNOWN',minutes,null);
    else if(decline>=cfg.adFillDropRed)add('RED','AD_FILL_DROP',minutes,decline);
    else if(decline>=cfg.adFillDropWarning)add('YELLOW','AD_FILL_DROP',minutes,decline);
    for(const k of ['securityIncidents','financeMismatches','season1UnexpectedWrites']){
      if(!Number.isInteger(w[k])||w[k]<0)add('YELLOW',k+'_UNKNOWN',minutes,null);
      else if(w[k]>0)add('RED',k,minutes,w[k]);
    }
    for(const k of ['rankMismatches','stuckOfflineSubmissions']){
      if(!Number.isInteger(w[k])||w[k]<0)add('YELLOW',k+'_UNKNOWN',minutes,null);
      else if(w[k]>0)add('YELLOW',k,minutes,w[k]);
    }
  }
  return {color:alerts.some(a=>a.color==='RED')?'RED':alerts.length?'YELLOW':'GREEN',
    alerts,identity:meta,liveVerified:false,autoFix:false,
    note:'Classified supplied snapshot only; no real production polling'};
}
function auditPaths(files){
  const re=/^(?:src\/lib\/buklodSeason|src\/lib\/buklodEngagementPolicy|src\/components\/points\/BuklodSeason|supabase\/.*(?:season|rank|point|reward)|scripts\/buklod-season2-|\.github\/workflows\/buklod-season2-)/i;
  const affected=files.filter(x=>re.test(x));
  return {affected,allowed:!affected.length||
    files.includes('contracts/season2-implementation-ledger.json'),
    errors:affected.length&&!files.includes('contracts/season2-implementation-ledger.json')?
      ['SEASON_FEATURE_CHANGE_WITHOUT_LEDGER_UPDATE']:[]};
}
function main(argv=process.argv.slice(2)){
  const p=POLICY(),l=LEDGER(),v=validatePolicy(p),r=readiness(l);
  if(!v.ok||!r.valid)throw Error(JSON.stringify({v,r}));
  let out;
  if(argv[0]==='validate')out={policy:v,readiness:r};
  else if(argv[0]==='launch')out=r;
  else if(argv[0]==='proposal'){
    if(!argv[1])throw Error('Missing proposal JSON path');
    out=proposalReview(load(path.resolve(argv[1])),p,
      {ownerReviewed:process.env.BUKLOD_OWNER_REVIEW_VERIFIED==='true'});
  }else if(argv[0]==='health'){
    if(!argv[1])throw Error('Missing supplied snapshot JSON path');
    out=health(load(path.resolve(argv[1])),p);
  }else if(argv[0]==='ci'){
    const base=process.env.BUKLOD_CI_BASE||'origin/main';
    const files=execFileSync('git',['diff','--name-only',base+'...HEAD'],
      {cwd:root,encoding:'utf8',timeout:10000}).trim().split('\n').filter(Boolean);
    out={policy:v,readiness:r,scope:auditPaths(files)};
  }else throw Error('Use: validate | proposal FILE | health FILE | launch | ci');
  console.log(JSON.stringify(out,null,2));
  if((argv[0]==='proposal'&&!out.allowedForDesign)||
     (argv[0]==='launch'&&!out.readyForLaunch)||
     (argv[0]==='health'&&out.color==='RED')||
     (argv[0]==='ci'&&!out.scope.allowed))process.exitCode=1;
}
if(require.main===module){try{main();}catch(e){console.error('SEASON2 FAIL CLOSED',e.message);process.exitCode=1;}}
module.exports={digest,validatePolicy,proposalReview,readiness,health,auditPaths,main};
