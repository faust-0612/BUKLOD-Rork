#!/usr/bin/env node
// BUKLOD residual-asset cloud preservation. No deployment or source merge.
// Scans only identified existing BUKLOD roots; classifies all available files,
// then encrypted-archives unmatched non-regenerable files to a PRIVATE GitHub Release.
// No original local project files are ever modified or deleted.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';

const temp=process.env.TEMP||os.tmpdir();
const base=path.join(temp,'BUKLOD_CONSOLIDATED_CLOUD_MIGRATION');
const summary=path.join(temp,'BUKLOD_PRIVATE_SCAN','SUMMARY.json');
const status=path.join(base,'STATUS.json');
const repo='faust-0612/BUKLOD-Local-Recovery',sourceRepo='faust-0612/BUKLOD-Migrated-Sources';
const reportPath=path.join(base,'REMAINING_AVAILABLE_ASSET_PRESERVATION.json');
const outRoot=path.join(base,'remaining-asset-batch');
const gh=fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe')?'C:\\Program Files\\GitHub CLI\\gh.exe':'gh';
const seven=fs.existsSync('C:\\Program Files\\7-Zip\\7z.exe')?'C:\\Program Files\\7-Zip\\7z.exe':'7z';
const maxArchiveBytes=4*1024*1024*1024;
const maxFiles=100000;
const canonical=p=>path.resolve(p).toLowerCase();
const normalized=p=>p.replace(/\\/g,'/');
const codeExt=/\.(?:tsx?|jsx?|cjs|mjs|py|java|kt|swift|dart|sql|prisma|graphql|gql|sh|ps1|bat|cmd|html?|css|scss|sass|mdx?|ya?ml|toml|jsonc?|xml|ini|properties)$/i;
const artifactExt=/\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp3|m4a|mp4|webm|ogg|wav|pdf|docx?|xlsx?|pptx?|zip|7z|rar|tar|gz|sqlite3?|db|bak|dump|apk|aab|ipa|keystore|jks|p12|pem|key)$/i;
const recoverPrefixes=/(BUKLOD|KABIHASNANG_LIGAW|buklodq)/i;
const generated=/^(?:\.git|node_modules|\.next|\.expo|\.gradle|\.cache|\.turbo|Pods|DerivedData|__pycache__|coverage|dist|build|target|\.venv|venv|vendor|out|\.idea|sdk|android-sdk|platforms)$/i;
const historical=/(BUKLOD_V2[5-7]|BUKLOD_D_RESCUE|BUKLOD_D_BACKUP|BUKLODQ_R10_BUILD|BUKLOD_Production_Starter_v16|RELEASES|BACKUPS|OLD_VERSIONS)/i;
const result={
  phase:'residual BUKLOD asset preservation',status:'NOT_STARTED',created:new Date().toISOString(),
  cloudRepo:repo,seenLocalFiles:0,alreadyInVerifiedCloudGit:0,regenCandidates:0,
  historicalCandidates:0,missingLocalRoots:[],unreadableLocalPaths:[],
  preservationCandidates:0,preservationBytes:0,sourceCandidatesNotInCloud:0,
  assetCandidatesNotInCloud:0,unknownCandidatesNotInCloud:0,
  partialScan:false,remoteArchiveShaVerified:false,originalProjectFilesDeleted:0,
  cloudBuildsVerified:false,safeToDeleteLocal:false,error:null
};
function safeSave(){fs.mkdirSync(base,{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(result,null,2))}
function run(exe,args,{optional=false,show=false,cwd=null}={}){
 const r=spawnSync(exe,args,{cwd:cwd||undefined,encoding:'utf8',windowsHide:true,timeout:45*60*1000,
   maxBuffer:16*1024*1024,stdio:show?['inherit','inherit','inherit']:['inherit','pipe','pipe']});
 if(r.error||r.status!==0){if(optional)return null;throw Error(exe+' '+args.slice(0,4).join(' ')+' failed: '+(r.error?.message||String(r.stderr||r.status)).slice(0,260))}
 return (r.stdout||'').trim();
}
function sha(file){const h=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),b=Buffer.alloc(1024*1024);
try{let n;while((n=fs.readSync(fd,b,0,b.length,null))>0)h.update(b.subarray(0,n))}finally{fs.closeSync(fd)}return h.digest('hex')}
const bytes=(n)=>Math.round(n/(1024*1024)*10)/10+'MiB';
try{
 if(!fs.existsSync(summary)||!fs.existsSync(status))throw Error('Local inventory or migration verification summary missing');
 const old=JSON.parse(fs.readFileSync(status,'utf8'));
 const inventory=JSON.parse(fs.readFileSync(summary,'utf8'));
 if(!old.sourceVerified||!old.secretVaultVerified)throw Error('Cloud source and credential vault not previously verified');
 if(!Array.isArray(inventory.results))throw Error('Malformed local source inventory');
 if(run(gh,['api','user','--jq','.login'])!=='faust-0612')throw Error('Wrong GitHub account');
 for(const r of [repo,sourceRepo])
  if(run(gh,['repo','view',r,'--json','isPrivate','--jq','.isPrivate'])!=='true')throw Error('Destination repository not verified private '+r);
 const sourceBranch='migration/essentials-'+old.sourceBranch.split('/')[1];
 const src=path.join(base,old.sourceBranch.split('/')[1],'editable');
 if(!fs.existsSync(path.join(src,'.git')))throw Error('Local source staging checkout missing');
 const remoteSha=run('git',['ls-remote','https://github.com/'+sourceRepo+'.git','refs/heads/'+sourceBranch]).split(/\s+/)[0];
 if(!/^[0-9a-f]{40}$/.test(remoteSha))throw Error('Missing latest essentials cloud source branch');
 // Read committed files from remote-ref. Source repo local checkout may include a newer documentation commit,
 // but source mappings are stable under the isolated essentials branch.
 // Fetch remote checkout independently, without changing the owner's local active branch.
 run('git',['-C',src,'fetch','--quiet','origin','refs/heads/'+sourceBranch]);
 const ref='FETCH_HEAD';
 if(run('git',['-C',src,'rev-parse',ref])!==remoteSha)throw Error('Cloud essentials fetch checksum mismatched; refusing asset upload');
 const tracked=new Set(run('git',['-C',src,'ls-tree','-r','--name-only',ref]).split(/\r?\n/).filter(Boolean).map(normalized));
 const originMap=(old.recovered||[]).filter(x=>x.origin&&x.cloudPath).sort((a,b)=>b.origin.length-a.origin.length);
 const allRoots=[...new Set(inventory.results.map(x=>x.root).filter(Boolean).concat((old.recovered||[]).map(x=>x.origin)))];
 const selected=[];
 for(const original of allRoots.sort((a,b)=>a.length-b.length)){
   if(!fs.existsSync(original)){result.missingLocalRoots.push(original);continue}
   const norm=canonical(original);
   if(selected.some(p=>norm===canonical(p)||norm.startsWith(canonical(p)+path.sep)))continue;
   selected.push(original);
 }
 const archiveList=[];
 const seen=new Set();
 for(const original of selected){
  let stats;try{stats=fs.lstatSync(original)}catch(e){result.unreadableLocalPaths.push(original);continue}
  if(stats.isSymbolicLink())continue;
  const stack=stats.isDirectory()?[{dir:original,depth:0}]:[];
  if(stats.isFile())stack.push({single:original,depth:0});
  while(stack.length){
    const item=stack.pop();
    if(item.depth>28){result.partialScan=true;continue}
    let children;
    if(item.single){children=[{name:path.basename(item.single),isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>false,absolute:item.single}]}
    else try{children=fs.readdirSync(item.dir,{withFileTypes:true})}catch(e){if(result.unreadableLocalPaths.length<1000)result.unreadableLocalPaths.push(item.dir);result.partialScan=true;continue}
    for(const f of children){
     if(f.isSymbolicLink())continue;
     const full=f.absolute||path.join(item.dir,f.name);
     const parts=normalized(full).split('/');
     if(f.isDirectory()){
       if(generated.test(f.name)){result.regenCandidates++;continue}
       if(historical.test(full)){result.historicalCandidates++;continue}
       stack.push({dir:full,depth:item.depth+1});continue
     }
     if(!f.isFile())continue;
     const key=canonical(full);if(seen.has(key))continue;seen.add(key);
     result.seenLocalFiles++;
     if(result.seenLocalFiles>maxFiles){result.partialScan=true;throw Error('Scan exceeded 100,000 file cap; do not assume all paths checked')}
     const match=originMap.find(x=>{
       const prefix=canonical(x.origin);
       return key===prefix||key.startsWith(prefix+path.sep);
     });
     if(match){
       const rel=key===canonical(match.origin)?path.basename(full):path.relative(match.origin,full);
       const expected=normalized(path.join(match.cloudPath,rel));
       if(tracked.has(expected)){result.alreadyInVerifiedCloudGit++;continue}
     }
     // Preserve non-regenerable available files not already in Git. Historical paths stay marked for review,
     // not promoted into current source and not silently declared deletable.
     if(historical.test(full)){result.historicalCandidates++;continue}
     let st;try{st=fs.statSync(full)}catch(e){if(result.unreadableLocalPaths.length<1000)result.unreadableLocalPaths.push(full);result.partialScan=true;continue}
     if(!st.isFile())continue;
     const name=path.basename(full);
     if(!codeExt.test(name)&&!artifactExt.test(name)){
        result.unknownCandidatesNotInCloud++;
        // Unknown types can be significant; preserve them unless they are empty or huge.
     } else if(codeExt.test(name)) result.sourceCandidatesNotInCloud++;
       else result.assetCandidatesNotInCloud++;
     if(result.preservationBytes+st.size>maxArchiveBytes)throw Error('Preservation candidates exceed 4GiB safe upload cap. Audit-only partial: '+bytes(result.preservationBytes));
     archiveList.push(full);result.preservationBytes+=st.size;result.preservationCandidates++;
     if(result.seenLocalFiles%4000===0)console.log('Scanned',result.seenLocalFiles,'local files; candidates',result.preservationCandidates);
    }
  }
 }
 const uniq=Array.from(new Set(archiveList)).sort();
 result.preservationCandidates=uniq.length;
 fs.mkdirSync(outRoot,{recursive:true});
 const listFile=path.join(outRoot,'PRESERVATION_INPUTS.txt');
 fs.writeFileSync(listFile,uniq.join('\n')+'\n','utf8');
 safeSave();
 console.log('Scan done. Local files seen:',result.seenLocalFiles);
 console.log('Already in source Git:',result.alreadyInVerifiedCloudGit);
 console.log('Preservation candidates:',uniq.length,'estimated bytes:',bytes(result.preservationBytes));
 console.log('Historical entries not auto-promoted:',result.historicalCandidates);
 console.log('Potential unavailable roots:',result.missingLocalRoots.length,'partial scan:',result.partialScan);
 if(result.partialScan||result.unreadableLocalPaths.length)console.log('WARNING: inaccessible roots/files; report recorded; no local deletion authorization.');
 if(uniq.length===0){result.status='NO_ADDITIONAL_AVAILABLE_ASSET_FILES';safeSave();console.log('No additional files to upload in this scope');process.exit(0)}
 const tag='remaining-assets-'+old.sourceBranch.split('/')[1];
 const archive=path.join(outRoot,'BUKLOD_REMAINING_ASSETS_'+tag+'.7z');
 const first=archive+'.001';
 if(!fs.existsSync(first)){
    console.log('Set and save a NEW 7z password in your password manager. This is not your GitHub password.');
    run(seven,['a','-t7z','-mhe=on','-mx=0','-v1400m','-p','-scsUTF-8','-spf',archive,'@'+listFile],{show:true});
 }
 if(!fs.existsSync(first))throw Error('Encrypted archive first volume missing');
 console.log('Re-enter encryption password to test the archive.');
 run(seven,['t',first],{show:true});
 const parts=fs.readdirSync(outRoot).filter(x=>x.startsWith(path.basename(archive)+'.')&&/\.7z\.\d{3}$/.test(x)).sort();
 if(!parts.length)throw Error('Archive volume list empty');
 const release=run(gh,['release','view',tag,'--repo',repo],{optional:true});
 if(release===null)run(gh,['release','create',tag,'--repo',repo,'--title','Encrypted BUKLOD remaining available assets','--notes',
      'Available noncanonical source/assets, encrypted only. Remote checksum verification required. No local deletion.']);
 for(const name of parts){
   const loc=path.join(outRoot,name);
   let obj=JSON.parse(run(gh,['api','repos/'+repo+'/releases/tags/'+tag]));
   let asset=(obj.assets||[]).find(x=>x.name===name);
   if(!asset){run(gh,['release','upload',tag,loc,'--repo',repo],{show:true});
      obj=JSON.parse(run(gh,['api','repos/'+repo+'/releases/tags/'+tag]));
      asset=(obj.assets||[]).find(x=>x.name===name)}
   if(!asset)throw Error('Uploaded volume missing: '+name);
   const localSHA=sha(loc);
   if(asset.digest?.startsWith('sha256:')){
     if(localSHA!==asset.digest.slice(7).toLowerCase())throw Error('Remote SHA mismatch '+name);
   }else{
     const check=path.join(outRoot,'REMOTE_VERIFY');fs.mkdirSync(check,{recursive:true});
     run(gh,['release','download',tag,'--repo',repo,'--dir',check,'--pattern',name]);
     if(sha(path.join(check,name))!==localSHA)throw Error('Downloaded archive SHA mismatch '+name);
   }
 }
 result.status='CLOUD_ASSET_PRESERVATION_CHECKSUM_VERIFIED';
 result.remoteArchiveShaVerified=true;
 result.remoteURL='https://github.com/'+repo+'/releases/tag/'+tag;
 result.encryptedVolumeCount=parts.length;
 safeSave();
 console.log('CLOUD ASSET PRESERVATION VERIFIED:',result.remoteURL);
 console.log('REMOTE SHA256 matched:',parts.length,'volumes.');
 console.log('Report:',reportPath);
 console.log('PROJECT FILE DELETION STILL NOT AUTHORIZED until build + archival exclusions audited.');
}catch(e){
 result.error=e.message;result.status='PARTIAL_OR_BLOCKED';safeSave();
 console.error('SAFE STOP:',e.message);
 console.error('Original projects untouched. Report:',reportPath);
 process.exitCode=1;
}
