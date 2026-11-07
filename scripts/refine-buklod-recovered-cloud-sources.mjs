#!/usr/bin/env node
// BUKLOD remote source wave refinement. DOES NOT delete local original projects, merge or deploy.
// Prunes only tracked copies of bundled Android SDK using "git rm --cached" on isolated recovery branch.
// Reconciles staged vs committed file paths and pushes verified, clean isolated branch.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
const TMP=process.env.TEMP||os.tmpdir();
const work=path.join(TMP,'BUKLOD_CONSOLIDATED_CLOUD_MIGRATION');
const original=path.join(work,'STATUS.json');
const repo='faust-0612/BUKLOD-Migrated-Sources';
const mem='faust-0612/BUKLOD-Local-Recovery';
const GH=fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe')?'C:\\Program Files\\GitHub CLI\\gh.exe':'gh';
const reportPath=path.join(work,'REFINED_RECOVERY_AUDIT.json');
const stageRoot=(id)=>path.join(work,id,'editable');
const cloneRoot=(id)=>path.join(work,id,'clean-remote-clone');
function run(exe,args,{cwd=null,quiet=true,optional=false,timeout=900000}={}){
  const out=spawnSync(exe,args,{cwd:cwd||undefined,encoding:'utf8',maxBuffer:64*1024*1024,
    windowsHide:true,timeout,stdio:quiet?['inherit','pipe','pipe']:['inherit','inherit','inherit']});
  if(out.error||out.status!==0){
    if(optional)return null;
    throw Error(exe+' '+args.slice(0,4).join(' ')+' exit '+out.status+': '+String(out.error?.message||out.stderr).slice(0,500));
  }
  return quiet?out.stdout.trim():'';
}
const checked=(x,why)=>{if(!x)throw Error(why)};
const md=p=>p.replaceAll('\\','/');
const json=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2))};
const sensitivePattern=/((^|\/)(\.env(\.|$)|\.npmrc|\.netrc)|firebase-adminsdk|id_(rsa|ed25519)|\.(pem|p12|pfx|jks|keystore|key)$|google-services\.json)/i;
const tokenPattern=/(-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{24,}|sb_secret_[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{35})/;
const sdkDir=/^(systems\/quiz\/BUKLODQ_BUILD_[^/]+\/sdk)\/.+$/i;
const cachePath=/(^|\/)(?:node_modules|\.gradle|\.expo|\.next|DerivedData|Pods|__pycache__)\/|\/(?:build|dist)\/|\.lockb$/i;
const historical=/(?:BUKLOD_V2[5-7]|BUKLOD_D_RESCUE|BUKLOD_D_BACKUP|BUKLODQ_R10_BUILD|BUKLOD_Production_Starter_v16|\/RELEASES\/|\/BACKUPS\/)/i;
function group(p){
  const a=p.toLowerCase();
  for(const [g,r] of [['classroom',/classroom/],['quiz',/quiz|buklodq/],['attendance',/attendance/],['report',/report/],
    ['bsoc',/bsoc/],['quickcheck',/quickcheck/],['igpat',/igpat/],['kabihasnang-ligaw',/kabihasnang/],
    ['ios',/ios/],['home',/buklod.home|\/home\//],['kingdom',/kingdom/],['city',/buklod.city/],
    ['main',/rork|main|community|wall/]])if(r.test(a))return g;
  return 'other';
}
function collect(root){
  let out=[], stack=[root];
  while(stack.length){
    const dir=stack.pop();
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      if(e.name==='.git'&&dir===root)continue;
      if(e.isSymbolicLink())continue;
      const x=path.join(dir,e.name);
      if(e.isDirectory())stack.push(x);
      else if(e.isFile())out.push(md(path.relative(root,x)));
    }
  }
  return out;
}
function classify(p,reason){
  const low=p.toLowerCase(),why=(reason||'').toLowerCase();
  if(/\/sdk\/platforms\/android-\d+\/|\/sdk\/|\/node_modules\/|\/\.gradle\/|\/\.expo\/|\/pods\//.test(low))return 'regenerable';
  if(/unreadable|unavailable|could not|error|failed/.test(why))return 'unavailable_or_io_error';
  if(/\.(?:apk|aab|zip|7z|rar|tar|gz|ipa|exe|dll|pdf|docx?|xlsx?|sqlite|db|bak|dump)$/i.test(p))return 'archive_or_binary_review';
  if(historical.test(low))return 'old_version_review';
  if(/non-source|unknown|oversized/.test(why))return 'asset_or_source_review';
  return 'uncategorized';
}
const result={checked:new Date().toISOString(),status:'NOT_YET_SAFE_TO_DELETE',cloudRepository:repo,
  before:{},after:{},sourceSystems:[],criticalUnresolved:[],excludedBuckets:{},
  batchActions:[],securityWarnings:[],dataCompletenessVerified:false,
  remoteBuildVerified:false,canonicalBaselineReconciled:false,safeToDeleteLocal:false};
try{
  checked(fs.existsSync(original),'Migration STATUS.json missing');
  const prior=JSON.parse(fs.readFileSync(original,'utf8'));
  checked(prior.sourceVerified===true&&prior.secretVaultVerified===true,'Original cloud recovery not verified');
  checked(/^migration\/recovery-\d{14}$/.test(prior.sourceBranch),'Unexpected source recovery branch');
  const id=prior.sourceBranch.split('/')[1],source=stageRoot(id);
  checked(fs.existsSync(path.join(source,'.git')),'Staged recovery git source missing');
  checked(run(GH,['api','user','--jq','.login'])==='faust-0612','Authenticated GitHub user mismatch');
  for(const name of [repo,mem])
    checked(run(GH,['repo','view',name,'--json','isPrivate','--jq','.isPrivate'])==='true','Not a verified private repository: '+name);
  const origin=run('git',['-C',source,'remote','get-url','origin']);
  checked(origin.replace(/\.git$/,'').endsWith('/'+repo),'Unexpected remote origin: '+origin);
  // Resolve the immutable original recovery head, not the currently selected cleanup branch.
  const originalSha=run('git',['-C',source,'rev-parse','refs/heads/'+prior.sourceBranch]);
  const onServer=run('git',['ls-remote','https://github.com/'+repo+'.git','refs/heads/'+prior.sourceBranch]).split(/\s+/)[0];
  checked(originalSha===onServer,'Recovery branch changed since verification; refusing modifications');
  checked(!run('git',['-C',source,'status','--porcelain','--untracked-files=no']),'Working tree has tracked local edits. Refusing automatic commit.');
  const trackedRaw=run('git',['-C',source,'ls-files','-z']);
  const tracked=new Set(trackedRaw.split('\0').filter(Boolean).map(md));
  const staged=collect(source);
  const missing=staged.filter(p=>!tracked.has(p));
  const missingTypes={};
  const essentialMissing=[];
  const suspiciousMissing=[];
  for(const p of missing){
    const type=sensitivePattern.test(p)?'sensitive':
      sdkDir.test(p)||cachePath.test(p)?'generated':
      /\.(?:tsx?|jsx?|mjs|cjs|swift|kt|java|dart|py|sql|yaml|yml|json|jsonc|prisma)$/i.test(p)?'possibly_essential_code':
      /\.(?:png|jpg|jpeg|webp|svg|mp3|mp4|wav|webm)$/i.test(p)?'asset':
      'other';
    missingTypes[type]=(missingTypes[type]||0)+1;
    if(type==='possibly_essential_code'||type==='asset')essentialMissing.push(p);
    if(type==='sensitive')suspiciousMissing.push(p);
  }
  const sdkRoots=new Set();
  for(const p of tracked){const match=p.match(sdkDir);if(match)sdkRoots.add(match[1])}
  result.before={
    uploaderReportedFiles:prior.sourceFiles,trackedFiles:tracked.size,actualStagedFiles:staged.length,
    stagedNotTracked:missing.length,stagedNotTrackedByType:missingTypes,
    notTrackedEssentialSamples:essentialMissing.slice(0,75),
    notTrackedSensitivePathCount:suspiciousMissing.length,
    recoverySourceSha:originalSha,generatedSdkRoots:[...sdkRoots]
  };
  const excluded=prior.excluded||[];
  for(const entry of excluded){const k=classify(entry.path,entry.reason);result.excludedBuckets[k]=(result.excludedBuckets[k]||0)+1}
  result.excludedBuckets.notRecordedInEarlierCappedLog=Number(prior.unlistedExclusions||0);
  result.before.excludedTotal=excluded.length+Number(prior.unlistedExclusions||0);
  result.criticalUnresolved=excluded.filter(x=>['unavailable_or_io_error','asset_or_source_review'].includes(classify(x.path,x.reason))).slice(0,60);
  // Investigate suspicious contents before adding or pushing a refined commit.
  const tokenPaths=[];
  for(const name of staged){
    if(sdkDir.test(name))continue;
    const full=path.join(source,name);
    const stat=fs.statSync(full);
    if(stat.size>1024*1024||!/\.(?:tsx?|jsx?|mjs|cjs|json|yaml|yml|env|properties|xml|sql|py|sh|ps1)$/i.test(name))continue;
    if(tokenPattern.test(fs.readFileSync(full,'utf8')))tokenPaths.push(name);
    if(tokenPaths.length>=30)break;
  }
  result.securityWarnings=tokenPaths.map(x=>'Possible hardcoded credential: '+x);
  if(suspiciousMissing.length)result.securityWarnings.push(suspiciousMissing.length+' sensitive paths exist staged but are not tracked.');
  if(tokenPaths.length)throw Error('Possible hardcoded tokens in staged source. Refusing new branch push; investigate private repo and rotate if needed.');
  // Prepare recovery-only cleanup branch. Every SDK removal is INDEX-ONLY, NOT file deletion.
  const cleaned='migration/refined-'+id;
  const onLocal=run('git',['-C',source,'branch','--list',cleaned]);
  const current=run('git',['-C',source,'branch','--show-current']);
  if(!onLocal){
    checked(current===prior.sourceBranch,'Unexpected local branch; refusing branch creation.');
    run('git',['-C',source,'switch','-c',cleaned],{quiet:false});
  }else{
    checked(current===cleaned,'Refined branch exists; selected branch differs. Refusing to modify.');
  }
  // Remove only bundled Android SDK directories from Git INDEX, not filesystem.
  for(const sdk of sdkRoots){
    run('git',['-C',source,'rm','-q','--cached','-r','--ignore-unmatch','--',sdk],{quiet:true});
    result.batchActions.push('untracked bundled SDK directory in Git index: '+sdk);
  }
  if(sdkRoots.size){
    const ignore=path.join(source,'.gitignore');
    let txt=fs.existsSync(ignore)?fs.readFileSync(ignore,'utf8'):'';
    const rules=['# Android SDK bundles installed locally, never app source',...[...sdkRoots].map(x=>'/'+x+'/')];
    for(const rule of rules)if(!txt.split(/\r?\n/).includes(rule))txt+='\n'+rule;
    fs.writeFileSync(ignore,txt.replace(/^\n/,''));
    run('git',['-C',source,'add','--','.gitignore']);
  }
  const cleanRaw=run('git',['-C',source,'ls-files','-z']);
  const cleanPaths=cleanRaw.split('\0').filter(Boolean).map(md);
  const bySystem={};
  for(const p of cleanPaths.filter(x=>x.startsWith('systems/'))){
    const g=group(p);if(!bySystem[g])bySystem[g]={files:0,buildConfigs:0,projects:new Set()};
    bySystem[g].files++;
    const a=p.split('/');if(a.length>2)bySystem[g].projects.add(a[2]);
    if(/(?:^|\/)(?:package\.json|app\.config\.[jt]s|app\.json|pubspec\.yaml|build\.gradle|settings\.gradle|requirements\.txt|Dockerfile)$/.test(p))
      bySystem[g].buildConfigs++;
  }
  result.sourceSystems=Object.entries(bySystem).map(([name,obj])=>({name,files:obj.files,projectCandidateCount:obj.projects.size,buildConfigs:obj.buildConfigs}));
  result.after={trackedFilesAfterIndexPrune:cleanPaths.length,sdkFilesStillTracked:cleanPaths.filter(x=>sdkDir.test(x)).length,
     otherGeneratedSdkOrBuildCandidates:cleanPaths.filter(x=>/\/sdk\/|\/platforms\/android-\d+\/|\/build\/|\/dist\//i.test(x)).length,
     cleanupBranch:cleaned,missingEssentialSourceFileCount:essentialMissing.length};
  // Include only a bounded report; NO private credentials or full file contents.
  const committedReport={generated:new Date().toISOString(),status:'SOURCE RECOVERY REFINEMENT (NOT COMPLETE)',
    sourceSystems:result.sourceSystems,originalSourceBranch:prior.sourceBranch,refinedBranch:cleaned,
    removedRegenerableSdkPathCount:tracked.size-cleanPaths.length,
    stagedButNotTrackedByType:missingTypes,
    unresolvedExcludedTotal:result.before.excludedTotal,
    caution:'No build, runtime or asset restore verification yet. Do not delete local projects or promote outdated code.'};
  json(path.join(source,'RECOVERY_REFINEMENT.json'),committedReport);
  run('git',['-C',source,'add','--','RECOVERY_REFINEMENT.json']);
  const pending=run('git',['-C',source,'status','--porcelain','--untracked-files=no']);
  if(pending){
    run('git',['-C',source,'commit','-q','-m','chore(recovery): prune regenerated Android SDK from isolated source branch and retain audit'],{quiet:true});
  }
  const commit=run('git',['-C',source,'rev-parse','HEAD']);
  const checkRemote=run('git',['ls-remote','https://github.com/'+repo+'.git','refs/heads/'+cleaned],{optional:true});
  const existing=checkRemote?checkRemote.split(/\s+/)[0]:null;
  checked(!existing||existing===commit,'Refined cloud branch already contains a different commit; refusing force push.');
  if(!existing)run('git',['-C',source,'push','origin','HEAD:refs/heads/'+cleaned],{quiet:false});
  const verified=run('git',['ls-remote','https://github.com/'+repo+'.git','refs/heads/'+cleaned]).split(/\s+/)[0];
  checked(verified===commit,'Remote refined source SHA mismatch');
  const fresh=cloneRoot(id);
  if(!fs.existsSync(path.join(fresh,'.git')))
    run('git',['clone','--quiet','--single-branch','--depth','1','--branch',cleaned,'https://github.com/'+repo+'.git',fresh],{quiet:true});
  checked(run('git',['-C',fresh,'rev-parse','HEAD'])===commit,'Clean fresh-clone SHA mismatch');
  const freshCount=run('git',['-C',fresh,'ls-files','-z']).split('\0').filter(Boolean).length;
  result.after={...result.after,refinedRemoteSha:commit,independentCloneShaVerified:true,
    remoteTrackedFiles:freshCount,finalReconciledMissingCount:essentialMissing.length};
  result.status='RECOVERY_CLEAN_BRANCH_VERIFIED_FULL_MIGRATION_PENDING';
  result.safeToDeleteLocal=false;
  json(reportPath,result);
  console.log('CLOUD RECOVERY BRANCH CLEANED AND VERIFIED');
  console.log('Refined branch: https://github.com/'+repo+'/tree/'+cleaned);
  console.log('Bundled SDK roots removed from Git INDEX:',sdkRoots.size);
  console.log('Missing staged-vs-tracked files:',missing.length,'possibly essential:',essentialMissing.length);
  console.log('Excluded unresolved:',result.before.excludedTotal);
  console.log('Recovered systems:',result.sourceSystems.map(x=>x.name+'='+x.files).join(', '));
  console.log('Report:',reportPath);
  console.log('LOCAL DELETION STILL NOT AUTHORIZED. All app builds/assets and 43k exclusions need final gate.');
}catch(e){
  result.status='BLOCKED_BEFORE_CLEAN_REMOTE_VERIFICATION';
  result.error=String(e.message);
  json(reportPath,result);
  console.error('BLOCKER:',e.message);
  console.error('No original local BUKLOD project files deleted. Audit:',reportPath);
  process.exitCode=1;
}
