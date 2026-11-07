#!/usr/bin/env node
// BUKLOD source completeness batch. NO deletion, OTA, merging, or changes to production.
// Resume only from previously verified isolated refined recovery branch.
// Recover genuinely useful staged-but-untracked source/assets, not toolchain/build files.
// Read current GitHub and local state before changing the recovery branch.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const TEMP=process.env.TEMP||os.tmpdir();
const base=path.join(TEMP,'BUKLOD_CONSOLIDATED_CLOUD_MIGRATION');
const statusPath=path.join(base,'STATUS.json'), refinedReport=path.join(base,'REFINED_RECOVERY_AUDIT.json');
const resultPath=path.join(base,'ESSENTIAL_SOURCES_RECONCILIATION.json');
const repo='faust-0612/BUKLOD-Migrated-Sources',vaultRepo='faust-0612/BUKLOD-Local-Recovery';
const gh=fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe')?'C:\\Program Files\\GitHub CLI\\gh.exe':'gh';
const norm=p=>p.replace(/\\/g,'/');
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function proc(exe,args,{cwd,optional=false,timeout=30*60*1000,show=false}={}) {
  const r=spawnSync(exe,args,{cwd,encoding:'utf8',windowsHide:true,timeout,maxBuffer:128*1024*1024,
   stdio:show?['inherit','inherit','inherit']:['inherit','pipe','pipe']});
  if(r.error||r.status!==0){if(optional)return null;throw Error('Command failed '+exe+': '+(r.error?.message||String(r.stderr||r.status)).slice(0,400))}
  return (r.stdout||'').trim();
}
function assert(ok,message){if(!ok)throw Error(message)}
function save(o){fs.mkdirSync(base,{recursive:true});fs.writeFileSync(resultPath,JSON.stringify(o,null,2),'utf8')}
function system(p){return (p.split('/')[1]||'other')}
const noSource=/^(?:\.git\/)|\/(?:sdk|node_modules|\.next|\.expo|\.gradle|\.cache|Pods|DerivedData|__pycache__|dist|build|coverage|out|vendor|target|\.venv|\.turbo|android-sdk|platforms\/android-\d+)\//i;
const sdkPath=/^systems\/quiz\/BUKLODQ_BUILD_[^/]+\/sdk\//i;
const sensitiveName=/(^|\/)(?:\.env(?:\..+)?|\.npmrc|\.netrc|id_rsa|id_ed25519|gradle\.properties|.*firebase-adminsdk.*|.*service[-_.]?account.*|.*credentials?.*|.*secret.*|.*private[-_.]?key.*)$|\.(?:pem|p12|pfx|jks|keystore|key|gpg|asc)$/i;
const privateValue=/(-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|sb_secret_[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9_-]{24,})/;
const allowedExt=/\.(?:tsx?|jsx?|mjs|cjs|json|jsonc|css|scss|sass|html?|mdx?|txt|yaml|yml|toml|xml|sql|prisma|graphql|gql|kt|java|swift|dart|py|rb|sh|ps1|cmd|bat|gradle|properties|ini|config|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|mp3|mp4|m4a|wav|webm|ogg|patch|diff|lock)$/i;
const alwaysAllowed=/^(?:Dockerfile|Makefile|LICENSE|\.gitignore|\.dockerignore|\.editorconfig|\.nvmrc|\.prettierrc|Gemfile|Podfile|Procfile)$/i;
const generatedSpecial=/\/(?:sdk|platforms\/android-\d+)\//i;
const sourceExt=/\.(?:tsx?|jsx?|mjs|cjs|kt|java|swift|dart|py|rb|sql|prisma|graphql|gql)$/i;
const assetExt=/\.(?:svg|png|jpe?g|webp|gif|ico|woff2?|ttf|mp3|mp4|m4a|wav|webm|ogg)$/i;
const versionedOld=/BUKLOD_V2[5-7]|BUKLOD_D_(?:RESCUE|BACKUP)|BUKLODQ_R10_BUILD|(?:^|\/)RELEASES\//i;
function exclusionCategory(p,reason) {
  const name=norm(p||''),why=String(reason||'').toLowerCase();
  if(/(?:^|\/)(?:sdk|platforms\/android-\d+|node_modules|\.gradle|\.expo|\.next|Pods|DerivedData|build|dist)(?:\/|$)/i.test(name))return 'regenerable_toolchain_or_build';
  if(/unreadable|not found|unavailable|could not|failed|error/i.test(why))return 'unavailable_or_read_error';
  if(versionedOld.test(name)||/old|historical|legacy/i.test(why))return 'historical_review';
  if(/\.((?:apk|aab|ipa|exe|dll|zip|7z|rar|tar|gz|sqlite|db|bak|dump|pdf|docx?|xlsx?))$/i.test(name))return 'archive_database_or_artifact_review';
  if(/sensitive|secret|credentials/i.test(why))return 'sensitive_vault_review';
  if(/non-source|unknown|oversized|asset/i.test(why))return 'asset_or_noncode_review';
  return 'other_or_unclassified';
}
function inspectFile(full,name) {
  if(noSource.test(name)||sdkPath.test(name)||generatedSpecial.test(name))return {status:'generated'};
  if(sensitiveName.test(name))return {status:'sensitive'};
  if(!allowedExt.test(name)&&!alwaysAllowed.test(path.basename(name)))return {status:'unknown_type'};
  let st;try{st=fs.lstatSync(full)}catch{return {status:'unreadable'}}
  if(!st.isFile())return {status:'not_regular'};
  if(st.size>24*1024*1024)return {status:'oversized'};
  if(!assetExt.test(name)&&st.size<=4*1024*1024) {
    let data;try{data=fs.readFileSync(full,'utf8')}catch{return {status:'unreadable'}}
    if(privateValue.test(data))return {status:'sensitive_content'};
    // Firebase client-side "AIza..." identifiers are not private credentials by themselves.
  }
  return {status:'recover',kind:sourceExt.test(name)?'source_code':assetExt.test(name)?'asset':'configuration_or_document',size:st.size}
}
function listFiles(root){
  const output=[],stack=[root];
  while(stack.length){
    const dir=stack.pop();
    let children;try{children=fs.readdirSync(dir,{withFileTypes:true})}catch{continue}
    for(const e of children){
      if(e.isSymbolicLink())continue;
      if(e.name==='.git'&&dir===root)continue;
      const abs=path.join(dir,e.name);
      if(e.isDirectory())stack.push(abs);
      else if(e.isFile())output.push(norm(path.relative(root,abs)));
    }
  }
  return output;
}
const output={phase:'recover ignored-but-essential files',started:new Date().toISOString(),
  status:'NOT_STARTED',originalProjectFilesDeleted:0,sourceBranch:null,report:{},
  cloudVerified:false,canonicalAppVersionsReconciled:false,remoteBuildVerified:false,
  allSourceAssetsComplete:false,safeToDeleteLocal:false,errors:[]};
try{
  assert(fs.existsSync(statusPath)&&fs.existsSync(refinedReport),'Prior migration reports absent; do not rescan or delete');
  const prior=readJSON(statusPath),refined=readJSON(refinedReport);
  assert(prior.sourceVerified===true&&prior.secretVaultVerified===true,'Prior cloud source / encrypted vault not verified');
  assert(refined.status==='RECOVERY_CLEAN_BRANCH_VERIFIED_FULL_MIGRATION_PENDING','Refinement gate not verified');
  assert(refined.after.independentCloneShaVerified===true,'Previous clone verification missing');
  const origBranch=prior.sourceBranch,refinedBranch=refined.after.cleanupBranch;
  assert(/^migration\/recovery-\d{14}$/.test(origBranch),'Unexpected original recovery branch');
  assert(refinedBranch==='migration/refined-'+origBranch.split('/')[1],'Unexpected refined branch');
  const id=origBranch.split('/')[1],source=path.join(base,id,'editable');
  assert(fs.existsSync(path.join(source,'.git')),'Local staged recovery workspace missing');
  const account=proc(gh,['api','user','--jq','.login']);
  assert(account==='faust-0612','Wrong GitHub login');
  for(const x of [repo,vaultRepo])assert(proc(gh,['repo','view',x,'--json','isPrivate','--jq','.isPrivate'])==='true','Nonprivate repository: '+x);
  const current=proc('git',['-C',source,'branch','--show-current']);
  assert(current===refinedBranch,'Current source branch is not the verified refined branch: '+current);
  const trackedStatus=proc('git',['-C',source,'status','--porcelain=v1','--untracked-files=no']);
  assert(trackedStatus==='','Tracked files already modified; refusing to overwrite');
  const initial=proc('git',['-C',source,'rev-parse','HEAD']);
  const actual=proc('git',['ls-remote','https://github.com/'+repo+'.git','refs/heads/'+refinedBranch]).split(/\s+/)[0];
  assert(initial===actual,'Remote refined source SHA differs from staged HEAD');
  const cleaned='migration/essentials-'+id;
  output.sourceBranch=cleaned;
  const remoteExisting=proc('git',['ls-remote','https://github.com/'+repo+'.git','refs/heads/'+cleaned],{optional:true});
  assert(!remoteExisting,'Essentials branch exists already; refusing overwrite');
  const localExists=proc('git',['-C',source,'branch','--list',cleaned]);
  assert(!localExists,'Local essentials branch exists; refusing overwrite');
  const tracked=new Set(proc('git',['-C',source,'ls-files','-z']).split('\0').filter(Boolean).map(norm));
  const stage=listFiles(source);
  const missing=stage.filter(x=>!tracked.has(x));
  const cats={};
  const recover=[], quarantined=[],examples={};
  for(const rel of missing){
    const c=inspectFile(path.join(source,rel),rel);
    cats[c.status]=(cats[c.status]||0)+1;
    if(!examples[c.status])examples[c.status]=[];
    if(examples[c.status].length<12)examples[c.status].push(rel);
    if(c.status==='recover')recover.push({rel,kind:c.kind,size:c.size});
    if(c.status==='sensitive'||c.status==='sensitive_content'||c.status==='unreadable')quarantined.push({rel,reason:c.status});
  }
  const excludedGroups={};
  for(const e of (prior.excluded||[])) {
    const k=exclusionCategory(e.path,e.reason);
    excludedGroups[k]=(excludedGroups[k]||0)+1;
  }
  excludedGroups.not_itemized_in_original_report=Number(prior.unlistedExclusions||0);
  const perSystem={};
  for(const x of recover){const g=system(x.rel);const y=perSystem[g]||(perSystem[g]={files:0,code:0,assets:0,other:0,bytes:0});
    y.files++;y.bytes+=x.size;if(x.kind==='source_code')y.code++;else if(x.kind==='asset')y.assets++;else y.other++}
  output.report={stagedMissing:missing.length,selectedForRecovery:recover.length,
    categories:cats,categorySamples:examples,recoveryBySystem:perSystem,
    quarantinedCount:quarantined.length,quarantinedSamples:quarantined.slice(0,30),
    sourceFilesInPreviousCommit:tracked.size,exclusionsRemaining:prior.excluded.length+Number(prior.unlistedExclusions||0),
    exclusionsByCategory:excludedGroups,
    excludedEntriesWithoutItemization:Number(prior.unlistedExclusions||0),
    note:'Counts represent local staged source, NOT full proof of all available BUKLOD assets or operational builds'};
  save(output);
  // Force-add selected files that were ignored by a prior .gitignore. Never add the whole tree.
  // Keep historical versions isolated; no production branch changes.
  proc('git',['-C',source,'switch','-c',cleaned],{show:true});
  if(recover.length){
    const list=path.join(base,id,'ESSENTIAL_PATHSPEC.nul');
    fs.writeFileSync(list,Buffer.from(recover.map(x=>x.rel).join('\0')+'\0','utf8'));
    proc('git',['-C',source,'add','-f','--pathspec-from-file='+list,'--pathspec-file-nul']);
  }
  const afterPaths=new Set(proc('git',['-C',source,'ls-files','-z']).split('\0').filter(Boolean).map(norm));
  assert(recover.every(x=>afterPaths.has(x.rel)),'Failed to stage all selected essential paths');
  assert(quarantined.every(x=>!afterPaths.has(x.rel)),'Sensitive or unreadable file was staged');
  const projects={},notParseable=[];
  const rootSearch=/^systems\/([^/]+)\/([^/]+)\/(.*)$/;
  for(const p of afterPaths){
    const m=p.match(rootSearch);if(!m)continue;
    const key=m[1]+'/'+m[2];
    const rec=projects[key]||(projects[key]={group:m[1],root:'systems/'+key,files:0,packages:0,buildScripts:[],warnings:[],exampleFiles:[]});
    rec.files++;
    if(rec.exampleFiles.length<3)rec.exampleFiles.push(p);
    if(m[3]==='package.json'||m[3].endsWith('/package.json')){
      rec.packages++;
      try{
        const pkg=readJSON(path.join(source,p));
        rec.buildScripts.push({packagePath:p,scripts:Object.keys(pkg.scripts||{}).filter(x=>/^(build|test|check|lint|typecheck|web|android|ios|start|deploy)/i.test(x))});
      }catch{rec.warnings.push('Unreadable or invalid package.json at '+p);notParseable.push(p)}
    }
  }
  output.projects=Object.values(projects).sort((a,b)=>b.files-a.files).slice(0,250);
  output.projectsWithManifest=output.projects.filter(x=>x.packages>0).length;
  output.report.selectedFilesFinal=afterPaths.size-tracked.size;
  // Only report aggregate counts in GitHub; full local audit with path samples stays on PC.
  const cloudReport={
    phase:'Recovered source completeness refinement (not a release)',
    generated:new Date().toISOString(),
    sourceRefinedBranch:refinedBranch,sourceEssentialsBranch:cleaned,
    priorTrackedFileCount:tracked.size,stagedButIgnored:missing.length,
    addedRecoverableIgnoredSourceFiles:recover.length,quarantinedFileCount:quarantined.length,
    stagedMissingByCategory:cats,excludedFromEarlierWaveByCategory:excludedGroups,
    recoveredBySystem:perSystem,
    packagesFound:output.projectsWithManifest,
    pending:'Canonical current DEV and RC reconciliation, app-specific cloud builds, unavailable/old/large asset review, credential vault and recovery validation',
    noLocalProjectDeletion:true,allAppsCertifiedRemotelyBuildable:false
  };
  fs.writeFileSync(path.join(source,'ESSENTIALS_RECOVERY.md'),[
    '# BUKLOD isolated recovered-source completeness',
    '',
    'This branch does not replace current canonical BUKLOD-Rork DEV/RC or production code.',
    'The earlier recovery was already SHA-verified. This change selectively includes ignored-but-needed source/assets.',
    'Source filenames with sensitive values are not included in this branch update.',
    '',
    '## Accounting',
    'Previously untracked staged files: '+missing.length,
    'Recovered after safe classification: '+recover.length,
    'Quarantined for local/private review: '+quarantined.length,
    'Unresolved previous exclusions: '+output.report.exclusionsRemaining+' (not-itemized: '+excludedGroups.not_itemized_in_original_report+'); see JSON.',
    '',
    '## Important',
    'No build, runtime, signing, data-backup, or complete app cloud-edit certification has been performed.',
    'Do not delete original C: or D: project files until verified and reviewed.'
  ].join('\n'));
  fs.writeFileSync(path.join(source,'ESSENTIALS_RECOVERY.json'),JSON.stringify(cloudReport,null,2));
  proc('git',['-C',source,'add','--','ESSENTIALS_RECOVERY.md','ESSENTIALS_RECOVERY.json']);
  const diff=proc('git',['-C',source,'diff','--cached','--name-only','-z']);
  const all=diff.split('\0').filter(Boolean);
  const allowed=new Set([...recover.map(x=>x.rel),'ESSENTIALS_RECOVERY.md','ESSENTIALS_RECOVERY.json']);
  assert(all.every(x=>allowed.has(norm(x))),'Unexpected file staged. Refusing commit.');
  proc('git',['-C',source,'commit','-q','-m','recovery: include verified ignored source and assets in isolated cloud branch']);
  const commit=proc('git',['-C',source,'rev-parse','HEAD']);
  proc('git',['-C',source,'push','origin','HEAD:refs/heads/'+cleaned],{show:true});
  const server=proc('git',['ls-remote','https://github.com/'+repo+'.git','refs/heads/'+cleaned]).split(/\s+/)[0];
  assert(server===commit,'GitHub remote SHA mismatch after push');
  const restored=path.join(base,id,'essentials-remote-clone');
  proc('git',['clone','--quiet','--depth','1','--single-branch','--branch',cleaned,'https://github.com/'+repo+'.git',restored]);
  assert(proc('git',['-C',restored,'rev-parse','HEAD'])===commit,'Fresh clone has wrong source commit');
  const restoredPaths=new Set(proc('git',['-C',restored,'ls-files','-z']).split('\0').filter(Boolean).map(norm));
  assert(recover.every(x=>restoredPaths.has(x.rel)),'Recovered file missing from remote clone');
  output.remoteSha=commit;
  output.remoteURL='https://github.com/'+repo+'/tree/'+cleaned;
  output.cloudVerified=true;output.status='ESSENTIAL_SOURCE_WAVE_VERIFIED_FULL_MIGRATION_PENDING';
  save(output);
  console.log('ESSENTIAL SOURCE CLOUD RECOVERY VERIFIED');
  console.log('Remote branch:',output.remoteURL);
  console.log('Staged but missing:',missing.length,'safely recovered:',recover.length);
  console.log('Remaining quarantined:',quarantined.length);
  console.log('Previous excluded items, not individually itemized:',excludedGroups.not_itemized_in_original_report);
  console.log('Previous exclusions, categorized:',JSON.stringify(excludedGroups));
  console.log('Project candidates:',output.projects.length,'with package manifests:',output.projectsWithManifest);
  console.log('Git remote and fresh clone SHA: VERIFIED');
  console.log('Report:',resultPath);
  console.log('NOT SAFE TO DELETE YET: full app remote-build certification and available assets need completion.');
}catch(e){
  output.status='BLOCKED_BEFORE_SOURCE_COMPLETION';
  output.errors.push(e.message);
  save(output);
  console.error('RECOVERY BLOCKER:',e.message);
  console.error('No original project files were deleted. Local report:',resultPath);
  process.exitCode=1;
}
