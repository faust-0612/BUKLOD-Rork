#!/usr/bin/env node
// Read-only BUKLOD migration gate: no uploads, no pushes, no deletes or deployments.
// Requires existing STATUS.json from consolidated local migration, gh and git.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const temp=process.env.TEMP||os.tmpdir(), root=path.join(temp,'BUKLOD_CONSOLIDATED_CLOUD_MIGRATION');
const statusFile=path.join(root,'STATUS.json'),reportFile=path.join(root,'FINALIZATION_AUDIT.json');
const sourceRepo='faust-0612/BUKLOD-Migrated-Sources',vaultRepo='faust-0612/BUKLOD-Local-Recovery';
const gh=fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe')?'C:\\Program Files\\GitHub CLI\\gh.exe':'gh';
const exit=(msg)=>{console.error('BLOCKED:',msg);process.exitCode=2};
function exec(exe,args,{cwd=null,allowed=false}={}){
 const res=spawnSync(exe,args,{cwd:cwd||undefined,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,timeout:120000});
 if(res.error||res.status!==0){if(allowed)return null;throw Error(exe+' failed: '+(res.error?.message||res.stderr||res.status))}
 return (res.stdout||'').trim();
}
function save(result){fs.writeFileSync(reportFile,JSON.stringify(result,null,2))}
const groups=[
 ['main',/rork|main|community|wall/i],
 ['classroom',/classroom/i],['quiz',/quiz|buklodq/i],['attendance',/attendance/i],
 ['report',/report/i],['home',/buklod.home|home/i],['kingdom',/kingdom/i],
 ['city',/buklod.city|city/i],['bsoc',/bsoc/i],['quickcheck',/quickcheck/i],
 ['igpat',/igpat/i],['kabihasnang-ligaw',/kabihasnang/i],['ios',/ios/i],
 ['organization',/organization/i],['formation',/formation/i]];
function skipType(p,reason){
 const a=String(p).replaceAll('\\','/').toLowerCase();
 const r=String(reason).toLowerCase();
 if(/(?:^|\/)(?:sdk|platforms\/android-\d+|node_modules|\.gradle|\.expo|cache|build|dist|pods)(?:\/|$)/.test(a))return 'regenerable-toolchain-or-build';
 if(/(?:^|\/)(?:release|releases|backups?|legacy_quarantine|recovery|archive)(?:\/|$)|BUKLOD_V2[5-7]|outdated/i.test(a))return 'historical-needs-review';
 if(/(?:\.(?:apk|aab|zip|7z|rar|tar|gz|ipa|exe|dll|pdf|docx?|xlsx?|sqlite|db|bak|dump))$/.test(a))return 'binary-or-data-needs-review';
 if(/sensitive|secret|unreadable|could not|missing|unavailable|failed/.test(r))return 'critical-data-or-read-error';
 if(/non-source|oversized|size|unknown/.test(r))return 'other-asset-needs-review';
 return 'unclassified';
}
try{
 if(!fs.existsSync(statusFile)){exit('No STATUS.json; complete initial migration first');}
 else{
 const s=JSON.parse(fs.readFileSync(statusFile,'utf8'));
 const actor=exec(gh,['api','user','--jq','.login']);
 if(actor.toLowerCase()!=='faust-0612')throw Error('GitHub login mismatch: '+actor);
 for(const repo of [sourceRepo,vaultRepo]){
  const priv=exec(gh,['repo','view',repo,'--json','isPrivate','--jq','.isPrivate']);
  if(priv!=='true')throw Error('Cloud repository not private: '+repo);
 }
 const sourceBranch=s.sourceBranch;
 if(!sourceBranch||!s.sourceVerified||!s.secretVaultVerified)throw Error('Source or encrypted vault verification incomplete');
 const sourceRemote=exec('git',['ls-remote','https://github.com/'+sourceRepo+'.git','refs/heads/'+sourceBranch]);
 const remoteSha=sourceRemote.split(/\s+/)[0];
 if(!/^[a-f0-9]{40}$/.test(remoteSha))throw Error('Missing remote source SHA');
 const id=sourceBranch.split('/').pop(),clone=path.join(root,id,'restored-source');
 if(!fs.existsSync(path.join(clone,'.git')))throw Error('Fresh remote clone from original migration missing');
 const cloneSha=exec('git',['-C',clone,'rev-parse','HEAD']);
 if(cloneSha!==remoteSha)throw Error('Remote vs independent restored clone SHA mismatch');
 const names=exec('git',['-C',clone,'ls-tree','-r','--name-only','HEAD']).split(/\r?\n/).filter(Boolean);
 const sourceEntries=names.filter(n=>n.startsWith('systems/'));
 const sdkSource=sourceEntries.filter(n=>/\/sdk\/|\/platforms\/android-\d+\/|\/build\/|\/dist\//i.test(n)).length;
 const suspectedSensitive=sourceEntries.filter(n=>/(?:^|\/)(?:\.env(?:\.|$)|id_rsa|id_ed25519|.*firebase-adminsdk.*\.json)|\.(?:p12|pfx|jks|keystore|pem|key)$|google-services\.json/i.test(n));
 const packages=names.filter(n=>/(?:^|\/)(?:package\.json|app\.json|app\.config\.[jt]s|pubspec\.yaml|settings\.gradle|build\.gradle|Dockerfile|requirements\.txt)$/.test(n));
 const observed=Object.fromEntries(groups.map(([g])=>[g,{sourceFiles:0,buildManifests:0,possibleExistingProject:false}]));
 for(const n of sourceEntries){
  for(const [g,re] of groups)if(re.test(n)){observed[g].sourceFiles++;break}
 }
 for(const n of packages){
  for(const [g,re] of groups)if(re.test(n)){observed[g].buildManifests++;observed[g].possibleExistingProject=true;break}
 }
 const reasonCounts={};const categoryCounts={};
 for(const x of (s.excluded||[])){
  reasonCounts[x.reason]=(reasonCounts[x.reason]||0)+1;
  const c=skipType(x.path,x.reason);categoryCounts[c]=(categoryCounts[c]||0)+1;
 }
 const truncatedUnclassified=Number(s.unlistedExclusions||0);
 const coveredGroups=Object.entries(observed).filter(([k,x])=>x.sourceFiles>0).map(([k])=>k);
 const highRiskEntries=(s.excluded||[]).filter(x=>{
   const c=skipType(x.path,x.reason);
   return c==='critical-data-or-read-error'||c==='other-asset-needs-review';
 }).slice(0,100);
 const results={
  status:'PARTIALLY_COMPLETE_WITH_EXPLICIT_BLOCKERS',
  checked:new Date().toISOString(),sourceRepository:sourceRepo,sourceBranch,
  sourceRemoteSha:remoteSha,remotePrivate:true,sourceRestoreShaMatch:true,
  encryptedVaultPrivate:true,sourceFileCountFromCommit:sourceEntries.length,
  sourceFileCountReportedByUploader:s.sourceFiles,
  encryptedSensitiveFilesReported:s.vaultFiles,
  ignoredOrExcludedReported:s.excluded.length+truncatedUnclassified,
  inspectedExclusions:s.excluded.length,unlistedExclusions:truncatedUnclassified,
  excludedReasonCounts:reasonCounts,excludedCategoryCounts:categoryCounts,
  sourceFilesUnderBundledSdkOrBuild:sdkSource,
  possibleSensitivePathsInEditableRepo:suspectedSensitive.slice(0,30),
  recoveredProjectCandidates:packages.slice(0,250),
  observedSystems:observed,coveredGroups,
  riskyExclusionsSample:highRiskEntries,
  buildTestsVerified:false,
  allAvailableLocalFilesAccountedFor:false,
  currentProductionBaselineReconciled:false,
  safeToDeleteLocal:false,
  nextGates:[
   'Classify remaining excluded binaries/assets, toolchains, historical sources and corrupted drive roots',
   'Verify standalone Classroom, Quiz, BSOC, QuickCheck, Main, KL, Report, IGPAT, and other systems are remotely buildable',
   'Ensure every necessary media, signing key, configuration and private database backup is cloud-restorable',
   'Review recovered versions versus updated authoritative GitHub production/DEV/RC source',
   'Verify remote editing/build/release workflows without accessing original C:/D: files',
   'Only then issue exact project-file cleanup manifest; never delete unrelated files'
  ]
 };
 save(results);
 console.log('BUKLOD REMOTE RECONCILIATION AUDIT');
 console.log('Private source repository: VERIFIED');
 console.log('Private encrypted recovery repository: VERIFIED');
 console.log('Remote SHA matches independent restored clone: YES');
 console.log('Source files in Git commit:',sourceEntries.length,'reported migrated:',s.sourceFiles);
 console.log('Excluded/unresolved entries:',results.ignoredOrExcludedReported);
 console.log('Regenerable SDK/build files IN RECOVERED REPO:',sdkSource);
 console.log('Possible secret-path findings:',suspectedSensitive.length);
 console.log('System source groups detected:',coveredGroups.join(', '));
 console.log('Project manifests found:',packages.length);
 console.log('Report:',reportFile);
 if(suspectedSensitive.length)console.log('SECURITY CHECK REQUIRED: suspicious paths detected in private recovery repo.');
 console.log('NOT SAFE FOR LOCAL DELETION. BUILD/ASSET/CANONICAL RECONCILIATION PENDING.');
 }
}catch(e){exit(e.message)}
