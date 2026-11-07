#!/usr/bin/env node
/**
 * BUKLOD remaining available local files -> encrypted PRIVATE GitHub Release.
 * V3: no 4 GiB total cap; SHA-based duplicate detection; resumable volume uploads.
 * Original project files are strictly read-only. Never deploy, merge, or delete projects.
 * Archive contents are for recovery, not the canonical app source.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const TEMP=process.env.TEMP||os.tmpdir();
const base=path.join(TEMP,'BUKLOD_CONSOLIDATED_CLOUD_MIGRATION');
const inventoryFile=path.join(TEMP,'BUKLOD_PRIVATE_SCAN','SUMMARY.json');
const statusFile=path.join(base,'STATUS.json');
const stagingRoot=path.resolve(process.env.BUKLOD_MIGRATION_STAGING||path.join(base,'remaining-assets-v3'));
let out=stagingRoot;
const reportFile=path.join(base,'RESUMABLE_REMAINING_ASSETS_V3.json');
const repo='faust-0612/BUKLOD-Local-Recovery';
const sourceRepo='faust-0612/BUKLOD-Migrated-Sources';
const gh=fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe')?'C:\\Program Files\\GitHub CLI\\gh.exe':'gh';
const seven=fs.existsSync('C:\\Program Files\\7-Zip\\7z.exe')?'C:\\Program Files\\7-Zip\\7z.exe':'7z';
const maxPaths=500000, MAX_ASSETS=950, VOLUME_BYTES=1400*1024*1024;
const norm=p=>p.replace(/\\/g,'/');
const canon=p=>path.resolve(p).toLowerCase();
const hashString=s=>crypto.createHash('sha256').update(s).digest('hex');
const generatedDir=/^(?:\.git|node_modules|\.next|\.expo|\.gradle|\.cache|\.turbo|\.parcel-cache|Pods|DerivedData|__pycache__|coverage|dist|build|target|\.venv|venv|vendor|out|\.idea|sdk|android-sdk|platforms|intermediates|\.pytest_cache)$/i;
const generatedFile=/(?:\.log|\.tmp|\.cache|\.pyc|\.class|\.o|\.obj|\.so|\.dll|\.exe\.manifest|\.dSYM|\.DS_Store)$/i;
const historical=/(BUKLOD_V2[5-7]|BUKLOD_D_RESCUE|BUKLOD_D_BACKUP|BUKLODQ_R10_BUILD|BUKLOD_Production_Starter_v16|[\\/]RELEASES[\\/]|[\\/]BACKUPS[\\/]|[\\/]OLD_VERSIONS[\\/])/i;
const sensitiveName=/(^|[\\/])(?:\.env(?:\..*)?|\.npmrc|\.netrc|id_rsa|id_ed25519|gradle\.properties|[^\\/]*firebase-adminsdk[^\\/]*|[^\\/]*service[-_.]?account[^\\/]*|[^\\/]*private[-_.]?key[^\\/]*)$|\.(?:pem|p12|pfx|jks|keystore|key|gpg|asc)$/i;
const isSource=p=>/\.(?:tsx?|jsx?|mjs|cjs|py|sql|prisma|swift|kt|java|dart|xml|yml|yaml|toml|jsonc?|graphql|gql|sh|ps1|bat|cmd|html?|css|scss|mdx?)$/i.test(p);
const isAsset=p=>/\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp3|m4a|mp4|webm|ogg|wav|pdf|docx?|xlsx?|pptx?|zip|7z|rar|tar|gz|sqlite3?|db|bak|dump|apk|aab|ipa)$/i.test(p);
const result={
  phase:'BUKLOD remaining assets v3 content-addressed archive',
  status:'NOT_STARTED',created:new Date().toISOString(),
  repo,sourceRepo,
  localFilesRead:0,sourceBlobMatches:0,
  duplicateLocalContent:0,representativeFiles:0,representativeBytes:0,
  sourceFilesToPreserve:0,assetsToPreserve:0,otherFilesToPreserve:0,
  sensitiveFilesToPreserve:0,excludedGeneratedDirectories:0,
  excludedGeneratedFiles:0,excludedHistoricalDirectories:0,
  missingRoots:[],unreadablePaths:[],scanComplete:true,
  planDigest:null,remoteRelease:null,volumesVerified:0,
  uploadedBytesVerified:0,archiveTestVerified:false,cloudVerified:false,
  originalProjectFilesDeleted:0,remoteApplicationBuildsVerified:false,
  safeToDeleteLocal:false,errors:[]
};
function save(){fs.mkdirSync(base,{recursive:true});result.updated=new Date().toISOString();fs.writeFileSync(reportFile,JSON.stringify(result,null,2),'utf8')}
function run(exe,args,{show=false,optional=false,timeout=45*60*1000}={}){
 const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:48*1024*1024,
   stdio:show?['inherit','inherit','inherit']:['inherit','pipe','pipe']});
 if(r.error||r.status!==0){
   if(optional)return null;
   throw Error('Command failed: '+path.basename(exe)+' '+args.slice(0,3).join(' ')+' ('+(r.error?.message||r.status)+') '+String(r.stderr||'').slice(0,350));
 }
 return show?'':(r.stdout||'').trim();
}
function assert(x,msg){if(!x)throw Error(msg)}
function gitBlob(file,bytes){
 const h=crypto.createHash('sha1').update('blob '+bytes+'\0');
 const fd=fs.openSync(file,'r'),buff=Buffer.alloc(1024*1024);
 try{let n;while((n=fs.readSync(fd,buff,0,buff.length,null))>0)h.update(buff.subarray(0,n))}
 finally{fs.closeSync(fd)}
 return h.digest('hex');
}
function sha256(file){
 const h=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),b=Buffer.alloc(1024*1024);
 try{let n;while((n=fs.readSync(fd,b,0,b.length,null))>0)h.update(b.subarray(0,n))}
 finally{fs.closeSync(fd)}
 return h.digest('hex');
}
function selfTest(){
 const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-assets-algorithm-'));
 try{
  const a=path.join(tempDir,'a.txt'),b=path.join(tempDir,'same.txt');
  fs.writeFileSync(a,'same bytes');fs.writeFileSync(b,'same bytes');
  assert(gitBlob(a,10)===gitBlob(b,10),'Git blob dedup mismatch');
  assert(generatedDir.test('sdk')&&generatedDir.test('node_modules'),'Cache classifier failure');
  assert(historical.test('C:\\BUKLOD_D_BACKUP\\old'),'Historical classifier failure');
  assert(sensitiveName.test('C:\\BUKLOD\\.env.local'),'Sensitive filename classifier failure');
  assert(!sensitiveName.test('C:\\BUKLOD\\src\\index.tsx'),'False positive sensitive name');
  console.log('SELF TEST PASSED: Git blob content hashing, cache, archive and credential classification.');
 }finally{fs.rmSync(tempDir,{recursive:true,force:true})}
}
if(process.argv.includes('--self-test')){selfTest();process.exit(0)}
try{
 assert(fs.existsSync(inventoryFile)&&fs.existsSync(statusFile),'Previous local inventory / migration status missing');
 const inventory=JSON.parse(fs.readFileSync(inventoryFile,'utf8')),prior=JSON.parse(fs.readFileSync(statusFile,'utf8'));
 assert(Array.isArray(inventory.results)&&inventory.results.length>35,'Previous inventory incomplete');
 assert(prior.sourceVerified&&prior.secretVaultVerified,'Verified private source and encrypted vault required');
 assert(/^migration\/recovery-\d{14}$/.test(prior.sourceBranch),'Unknown recovery source branch');
 assert(run(gh,['api','user','--jq','.login'])==='faust-0612','Unexpected GitHub account');
 for(const name of [repo,sourceRepo])assert(run(gh,['repo','view',name,'--json','isPrivate','--jq','.isPrivate'])==='true','Repository is not PRIVATE: '+name);

 const runId=prior.sourceBranch.split('/')[1];
 const sourceBranch='migration/essentials-'+runId;
 const checkout=path.join(base,runId,'editable');
 assert(fs.existsSync(path.join(checkout,'.git')),'Previous staged source checkout unavailable');
 const remoteSHA=run('git',['ls-remote','https://github.com/'+sourceRepo+'.git','refs/heads/'+sourceBranch]).split(/\s+/)[0];
 assert(/^[0-9a-f]{40}$/i.test(remoteSHA),'Essential-source remote branch missing');
 run('git',['-C',checkout,'fetch','--quiet','origin','refs/heads/'+sourceBranch]);
 assert(run('git',['-C',checkout,'rev-parse','FETCH_HEAD'])===remoteSHA,'Remote source commit verification mismatch');
 const tree=run('git',['-C',checkout,'ls-tree','-r','-z','FETCH_HEAD']);
 const sourceBlobs=new Set(),sourcePaths=new Map();
 for(const rec of tree.split('\0')){
  const m=rec.match(/^\d+ blob ([a-f0-9]{40})\t(.+)$/);
  if(m){sourceBlobs.add(m[1]);sourcePaths.set(norm(m[2]),m[1])}
 }
 assert(sourceBlobs.size>10000,'Remote Git tree unexpectedly small');

 const entries=(prior.recovered||[]).filter(x=>x.origin&&x.cloudPath).sort((a,b)=>b.origin.length-a.origin.length);
 const originEntries=entries.map(e=>({...e,abs:canon(e.origin),file:(()=>{try{return fs.lstatSync(e.origin).isFile()}catch{return false}})()}));
 const allRoots=[...new Set([...inventory.results.map(x=>x.root),...entries.map(e=>e.origin)].filter(Boolean))];
 const roots=[];
 for(const root of allRoots.sort((a,b)=>a.length-b.length)){
   if(!fs.existsSync(root)){if(result.missingRoots.length<200)result.missingRoots.push(root);result.scanComplete=false;continue}
   const a=canon(root);
   if(roots.some(r=>a===canon(r)||a.startsWith(canon(r)+path.sep)))continue;
   roots.push(root);
 }
 assert(roots.length>=8,'Too few local BUKLOD roots; no upload');
 result.totalAvailableRoots=roots.length;

 const files=[],aliases=[],duplicateBlobs=new Map(),seenPath=new Set();
 for(const root of roots){
  let top;try{top=fs.lstatSync(root)}catch(e){result.scanComplete=false;if(result.unreadablePaths.length<500)result.unreadablePaths.push(root);continue}
  if(top.isSymbolicLink())continue;
  const stack=top.isFile()?[{file:root,depth:0}]:[{dir:root,depth:0}];
  while(stack.length){
   const item=stack.pop();
   if(item.depth>32){result.scanComplete=false;continue}
   let children;
   if(item.file)children=[{name:path.basename(item.file),isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>false,abs:item.file}];
   else{
     try{children=fs.readdirSync(item.dir,{withFileTypes:true})}
     catch(e){result.scanComplete=false;if(result.unreadablePaths.length<500)result.unreadablePaths.push(item.dir);continue}
   }
   for(const f of children){
    if(f.isSymbolicLink())continue;
    const full=f.abs||path.join(item.dir,f.name);
    if(f.isDirectory()){
      if(generatedDir.test(f.name)){result.excludedGeneratedDirectories++;continue}
      if(historical.test(full)){result.excludedHistoricalDirectories++;continue}
      stack.push({dir:full,depth:item.depth+1});continue
    }
    if(!f.isFile())continue;
    const key=canon(full);
    if(seenPath.has(key))continue;seenPath.add(key);
    result.localFilesRead++;
    if(result.localFilesRead%4000===0)console.log('Scanned',result.localFilesRead,'local files; Git content matches',result.sourceBlobMatches,'unique pending',files.length);
    if(result.localFilesRead>maxPaths)throw Error('More than '+maxPaths+' files scanned: cap exceeded; no deletion authorization');
    if(generatedFile.test(f.name)){result.excludedGeneratedFiles++;continue}
    if(historical.test(full)){result.excludedHistoricalDirectories++;continue}
    let st;try{st=fs.statSync(full)}catch(e){result.scanComplete=false;if(result.unreadablePaths.length<500)result.unreadablePaths.push(full);continue}
    if(!st.isFile())continue;
    let blob;
    try{blob=gitBlob(full,st.size)}catch(e){result.scanComplete=false;if(result.unreadablePaths.length<500)result.unreadablePaths.push(full);continue}
    const mapping=originEntries.find(x=>key===x.abs||key.startsWith(x.abs+path.sep));
    const candidateCloudPath=mapping
        ?norm(mapping.file?mapping.cloudPath:path.join(mapping.cloudPath,path.relative(mapping.origin,full)))
        :null;
    if(sourceBlobs.has(blob)){
      result.sourceBlobMatches++;
      // Sensitive names should be inside an encrypted archive even if a Git blob matches.
      if(!sensitiveName.test(full)){
       aliases.push({source:full,gitBlob:blob,remoteGitPath:candidateCloudPath&&sourcePaths.get(candidateCloudPath)===blob?candidateCloudPath:null});
       continue;
      }
    }
    if(duplicateBlobs.has(blob)){
      result.duplicateLocalContent++;
      aliases.push({source:full,sameAs:duplicateBlobs.get(blob),gitBlob:blob});
      continue;
    }
    duplicateBlobs.set(blob,full);
    files.push({source:full,bytes:st.size,mtime:Math.round(st.mtimeMs),gitBlob:blob});
    result.representativeBytes+=st.size;
    if(sensitiveName.test(full))result.sensitiveFilesToPreserve++;
    else if(isSource(full))result.sourceFilesToPreserve++;
    else if(isAsset(full))result.assetsToPreserve++;
    else result.otherFilesToPreserve++;
    // Progress emitted before all file classification exits.
   }
  }
 }
 result.representativeFiles=files.length;
 fs.mkdirSync(out,{recursive:true});
 // Stable plan digest is content-based, so unchanged re-runs resume exact assets.
 const meta=files.map(f=>[f.source,f.bytes,f.mtime,f.gitBlob].join('|')).sort();
 const aliasFingerprint=aliases.map(a=>[a.source,a.gitBlob,a.sameAs||'',a.remoteGitPath||''].join('|')).sort();
 const planDigest=hashString(meta.join('\n')+'\n'+remoteSHA+'\n'+roots.join('\n')+'\n'+aliasFingerprint.join('\n'));
 const tag='remaining-v3-'+runId+'-'+planDigest.slice(0,12);
 result.planDigest=planDigest;result.remoteRelease='https://github.com/'+repo+'/releases/tag/'+tag;
 // A distinct immutable folder for each exact content plan makes upload resumes safe.
 out=path.join(stagingRoot,tag);
 fs.mkdirSync(out,{recursive:true});
 const archive=path.join(out,'BUKLOD_REMAINING_'+tag+'.7z'),first=archive+'.001';
 const mapFile=path.join(out,'PRIVATE_RESTORE_MAP.json');
 const listFile=path.join(out,'PRIVATE_7Z_INPUTS.txt');
 const planFile=path.join(out,'PLAN_LOCK.json');
 const plan={schema:'BUKLOD-remaining-assets-v3',planDigest,tag,
    sourceBranch,sourceCommit:remoteSHA,roots,files,aliases,
    skipped:{generatedDir:result.excludedGeneratedDirectories,generatedFile:result.excludedGeneratedFiles,
       historical:result.excludedHistoricalDirectories},
    missingRoots:result.missingRoots,unreadablePaths:result.unreadablePaths,
    noLocalDeletion:true};
 if(fs.existsSync(planFile)){
   const saved=JSON.parse(fs.readFileSync(planFile,'utf8'));
   if(saved.planDigest!==planDigest)throw Error('Staged archive plan changed. Move aside old temporary staging folder before making a fresh backup; originals unchanged.');
 }
 fs.writeFileSync(planFile,JSON.stringify({planDigest,tag,representatives:files.length,bytes:result.representativeBytes},null,2));
 // PRIVATE_RESTORE_MAP contains absolute local filenames, and is included ONLY inside encrypted 7z.
 fs.writeFileSync(mapFile,JSON.stringify(plan,null,2));
 fs.writeFileSync(listFile,[mapFile,...files.map(f=>f.source)].join('\n')+'\n','utf8');
 save();
 console.log('FULL LOCAL SCAN FINISHED. Files scanned:',result.localFilesRead);
 console.log('Already represented by cloud Git content:',result.sourceBlobMatches);
 console.log('Locally duplicate content paths:',result.duplicateLocalContent);
 console.log('Unique originals to preserve:',files.length,'bytes:',Math.round(result.representativeBytes/1024/1024)+' MiB');
 console.log('Damaged/unavailable roots:',result.missingRoots.length,'I/O errors:',result.unreadablePaths.length);
 console.log('Historical folders excluded from active migration:',result.excludedHistoricalDirectories);
 if(!files.length)console.log('All file bytes already represented in Git; preserve path/provenance map as encrypted metadata-only archive.');
 if(!fs.existsSync(first)){
   // Check available temporary disk before writing a multi-GB archive. No write to damaged D: by default.
   if(typeof fs.statfsSync==='function'){
     const disk=fs.statfsSync(out);
     const free=Number(disk.bavail)*Number(disk.bsize);
     const projected=result.representativeBytes+1024*1024*1024;
     if(free<projected)throw Error('Not enough free staging disk (available '+Math.round(free/1024/1024)+' MiB; conservative requirement '+Math.round(projected/1024/1024)+' MiB). Set BUKLOD_MIGRATION_STAGING to a safe larger volume, not the corrupted Seagate drive.');
   }
   if(Math.ceil((result.representativeBytes+fs.statSync(mapFile).size)/VOLUME_BYTES)>MAX_ASSETS)
      throw Error('Would require more than 950 GitHub release volumes; preserve with separate archive tags.');
   console.log('Create encrypted multi-volume archive now. Choose and SAVE a password in a password manager.');
   run(seven,['a','-t7z','-mhe=on','-mx=1','-v1400m','-spf2','-scsUTF-8','-p',archive,'@'+listFile],{show:true,timeout:6*60*60*1000});
 }
 assert(fs.existsSync(first),'Archive first volume missing');
 console.log('Re-enter the SAME passphrase to test all encrypted volumes.');
 run(seven,['t',first],{show:true,timeout:6*60*60*1000});
 result.archiveTestVerified=true;save();

 const parts=fs.readdirSync(out).filter(n=>n.startsWith(path.basename(archive)+'.')&&/\.7z\.\d{3}$/.test(n)).sort();
 assert(parts.length>=1&&parts.length<=MAX_ASSETS,'Invalid number of archive volumes');
 let release=run(gh,['release','view',tag,'--repo',repo],{optional:true});
 if(release===null){
   run(gh,['release','create',tag,'--repo',repo,'--title','Encrypted remaining available BUKLOD recovery files','--notes',
    'Isolated encrypted archive only, no production code override. Includes encrypted original path/duplicate restoration map. No deletion permission.']);
 }
 for(let i=0;i<parts.length;i++){
   const name=parts[i],local=path.join(out,name);
   const digest=sha256(local);
   let remote=JSON.parse(run(gh,['api','repos/'+repo+'/releases/tags/'+tag]));
   let asset=(remote.assets||[]).find(x=>x.name===name);
   if(!asset){
     console.log('Uploading encrypted volume',i+1,'of',parts.length,':',name);
     run(gh,['release','upload',tag,local,'--repo',repo],{show:true,timeout:3*60*60*1000});
     remote=JSON.parse(run(gh,['api','repos/'+repo+'/releases/tags/'+tag]));
     asset=(remote.assets||[]).find(x=>x.name===name);
   }else console.log('Checking already-uploaded volume',i+1,'of',parts.length);
   assert(asset,'Cloud volume missing: '+name);
   if(asset.digest?.startsWith('sha256:')){
     assert(asset.digest.slice(7).toLowerCase()===digest,'Remote asset checksum mismatch: '+name);
   }else{
     // Only temporary downloaded checksum copy is removed; original archive & project data untouched.
     const verification=path.join(out,'REMOTE_DIGEST_CHECK');
     fs.mkdirSync(verification,{recursive:true});
     const downloaded=path.join(verification,name);
     if(fs.existsSync(downloaded))fs.rmSync(downloaded);
     run(gh,['release','download',tag,'--repo',repo,'--dir',verification,'--pattern',name],{timeout:3*60*60*1000});
     assert(sha256(downloaded)===digest,'Downloaded volume SHA mismatch: '+name);
     fs.rmSync(downloaded);
   }
   result.volumesVerified=i+1;result.uploadedBytesVerified+=fs.statSync(local).size;
   result.status='UPLOADING_VERIFIED_VOLUMES';save();
 }
 result.status='ENCRYPTED_AVAILABLE_ASSETS_CLOUD_VERIFIED';
 result.cloudVerified=true;save();
 console.log('ENCRYPTED AVAILABLE ASSETS CLOUD VERIFIED');
 console.log('Remote:',result.remoteRelease);
 console.log('Verified GitHub release volumes:',parts.length);
 console.log('Audit report:',reportFile);
 console.log('NOT SAFE TO DELETE: historical candidates, I/O gaps and app cloud-only builds remain pending.');
}catch(e){
 result.status='PARTIAL_OR_BLOCKED';result.errors.push(e.message);save();
 console.error('SAFE STOP:',e.message);
 console.error('Original projects were not modified. Report:',reportFile);
 process.exitCode=1;
}
