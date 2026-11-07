#!/usr/bin/env node
/**
 * BUKLOD V7: read-only historical-source parity audit.
 * Compare skipped historical folder bytes against canonical cloud Git and the
 * verified V3+V6 candidate archive manifest. Never delete or upload originals.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const temp=process.env.TEMP||os.tmpdir();
const base=path.join(temp,'BUKLOD_CONSOLIDATED_CLOUD_MIGRATION');
const inventoryPath=path.join(temp,'BUKLOD_PRIVATE_SCAN','SUMMARY.json');
const statusPath=path.join(base,'STATUS.json');
const reportPath=path.join(base,'HISTORICAL_UNIQUE_FILES_V7.json');
const vault="faust-0612/BUKLOD-Local-Recovery";
const repo="faust-0612/BUKLOD-Migrated-Sources";
const gh=fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe')?'C:\\Program Files\\GitHub CLI\\gh.exe':'gh';
const historical=/(BUKLOD_V2[5-7]|BUKLOD_D_RESCUE|BUKLOD_D_BACKUP|BUKLODQ_R10_BUILD|BUKLOD_Production_Starter_v16|[\\/]RELEASES[\\/]|[\\/]BACKUPS[\\/]|[\\/]OLD_VERSIONS[\\/])/i;
const generated=/^(?:\.git|node_modules|\.next|\.expo|\.gradle|\.cache|\.turbo|Pods|DerivedData|__pycache__|coverage|dist|build|target|\.venv|venv|vendor|out|\.idea|sdk|android-sdk|platforms|intermediates|\.pytest_cache)$/i;
const codeExt=/\.(?:tsx?|jsx?|mjs|cjs|py|java|kt|swift|dart|sql|prisma|graphql|gql|sh|ps1|bat|cmd|html?|css|scss|mdx?)$/i;
const assetExt=/\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp3|m4a|mp4|webm|ogg|wav)$/i;
const documentExt=/\.(?:pdf|docx?|xlsx?|pptx?|sqlite3?|db|bak|dump|csv|tsv|jsonc?|ya?ml|toml|xml|ini|properties)$/i;
const artifactExt=/\.(?:zip|7z|rar|tar|gz|apk|aab|ipa|exe|msi|dmg|iso)$/i;
const norm=p=>path.resolve(p).toLowerCase();
const type=p=>codeExt.test(p)?'code':assetExt.test(p)?'media':documentExt.test(p)?'documents_and_data':artifactExt.test(p)?'artifacts':'other';
const audit={
 schema:'buklod-historical-parity/v7',started:new Date().toISOString(),
 status:'NOT_STARTED',scanComplete:true,filesExamined:0,historicalFolders:0,
 historicalFiles:0,historicalBytes:0,alreadyInGit:0,alreadyInV3V6:0,
 localContentDuplicates:0,uniqueFiles:0,uniqueBytes:0,
 uniqueByType:{},byTopRoot:{},unreadable:[],missingRoots:[],
 generatedFoldersExcluded:0,originalFilesDeleted:0,cloudUploadsMade:0,
 safeToDeleteLocal:false,uniqueFileRecords:[],error:null
};
function save(){fs.mkdirSync(base,{recursive:true});audit.updated=new Date().toISOString();fs.writeFileSync(reportPath,JSON.stringify(audit,null,2))}
function must(x,m){if(!x)throw Error(m)}
function exec(exe,args){
 const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:45*60*1000,maxBuffer:100*1024*1024,stdio:['inherit','pipe','pipe']});
 if(r.error||r.status!==0)throw Error('Command failed '+path.basename(exe)+': '+(r.error?.message||r.status)+' '+String(r.stderr||'').slice(0,220));
 return (r.stdout||'').trim();
}
function blob(file,size){
 const h=crypto.createHash('sha1').update('blob '+size+'\0');
 const fd=fs.openSync(file,'r'),buf=Buffer.alloc(1024*1024);
 try{let n;while((n=fs.readSync(fd,buf,0,buf.length,null))>0)h.update(buf.subarray(0,n))}
 finally{fs.closeSync(fd)}
 return h.digest('hex');
}
function selfTest(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'BUKLOD_V7_TEST_'));
 try{
  const p=path.join(dir,'test.tsx');fs.writeFileSync(p,'abc');
  must(blob(p,3)==='f2ba8f84ab5c1bce84a7b441cb1959cfc7093b7f','Git SHA1 blob fixture mismatch');
  must(historical.test('C:\\BUKLOD_D_BACKUP\\file'),'Historical pattern missing');
  must(historical.test('C:\\App\\RELEASES\\archive'),'Historical release pattern missing');
  must(!historical.test('C:\\BUKLOD\\src\\App.tsx'),'False-positive historical root');
  must(generated.test('node_modules')&&generated.test('sdk'),'Generated folder classifier failed');
  must(type('app.tsx')==='code'&&type('photo.webp')==='media','File type classification failed');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
 console.log('SELF TEST PASSED: content hash, historical-root classification, generated filters.');
}
if(process.argv.includes('--self-test')){selfTest();process.exit(0)}
try{
 const prior=JSON.parse(fs.readFileSync(statusPath,'utf8'));
 const inventory=JSON.parse(fs.readFileSync(inventoryPath,'utf8'));
 const v3=JSON.parse(fs.readFileSync(path.join(base,'RESUMABLE_REMAINING_ASSETS_V3.json'),'utf8'));
 const v6=JSON.parse(fs.readFileSync(path.join(base,'ARCHIVE_COMPLETENESS_AND_REPAIR_V6.json'),'utf8'));
 must(prior.sourceVerified===true&&prior.secretVaultVerified===true,'Cloud source/vault not verified');
 must(v3.cloudVerified===true&&v3.volumesVerified>=2,'Previous V3 release not verified');
 must(v6.allAvailableV3CandidatesAccountedFor===true&&v6.v6RepairArchiveVerified===true&&v6.v6RemoteVolumesVerified>=1,
   'V6 file coverage and cloud checksum not verified');
 must(Array.isArray(inventory.results)&&inventory.results.length>=30,'Inventory incomplete');
 must(exec(gh,['api','user','--jq','.login'])==='faust-0612','Wrong GitHub account');
 for(const name of [repo,vault])must(exec(gh,['repo','view',name,'--json','isPrivate','--jq','.isPrivate'])==='true','Repo not private: '+name);
 const runId=prior.sourceBranch?.split('/')[1];
 must(/^recovery-\d{14}$/.test(runId),'Unexpected original cloud source branch');
 const src=path.join(base,runId,'editable'),ref='migration/essentials-'+runId;
 must(fs.existsSync(path.join(src,'.git')),'Cloud source staging checkout not found');
 const remoteSHA=exec('git',['ls-remote','https://github.com/'+repo+'.git','refs/heads/'+ref]).split(/\s+/)[0];
 must(/^[a-f0-9]{40}$/.test(remoteSHA),'Remote essential source missing');
 exec('git',['-C',src,'fetch','--quiet','origin','refs/heads/'+ref]);
 must(exec('git',['-C',src,'rev-parse','FETCH_HEAD'])===remoteSHA,'Source remote SHA mismatch');
 audit.sourceBranch=ref;audit.sourceCommit=remoteSHA;
 const sourceBlobs=new Set();
 for(const row of exec('git',['-C',src,'ls-tree','-r','-z','FETCH_HEAD']).split('\0')){
  const m=row.match(/^\d+ blob ([a-f0-9]{40})\t/);if(m)sourceBlobs.add(m[1]);
 }
 must(sourceBlobs.size>10000,'Cloud source Git tree unexpectedly small');
 const v3Tag=v3.remoteRelease?.split('/tag/')[1];
 must(/^remaining-v3-recovery-\d{14}-[a-f0-9]{12}$/.test(v3Tag),'V3 release tag invalid');
 const staging=path.resolve(process.env.BUKLOD_MIGRATION_STAGING||path.join(base,'remaining-assets-v3'));
 const candidateFile=path.join(staging,v3Tag,'PRIVATE_RESTORE_MAP.json');
 must(fs.existsSync(candidateFile),'Original V3 private candidate manifest missing');
 const plan=JSON.parse(fs.readFileSync(candidateFile,'utf8'));
 must(plan.planDigest===v3.planDigest&&plan.tag===v3Tag&&plan.files?.length===39570,'V3 candidate plan mismatch');
 const backupBlobs=new Set();
 for(const item of [...plan.files,...(plan.aliases||[])])
  if(/^[a-f0-9]{40}$/.test(item.gitBlob||''))backupBlobs.add(item.gitBlob);
 audit.cloudSourceBlobs=sourceBlobs.size;audit.archivedCandidateBlobs=backupBlobs.size;
 const rawRoots=[...new Set([...inventory.results.map(x=>x.root),...(prior.recovered||[]).map(x=>x.origin)].filter(Boolean))];
 const roots=[];
 for(const p of rawRoots.sort((a,b)=>a.length-b.length)){
  if(!fs.existsSync(p)){audit.scanComplete=false;audit.missingRoots.push(p);continue}
  const k=norm(p);
  if(roots.some(r=>k===norm(r)||k.startsWith(norm(r)+path.sep)))continue;
  roots.push(p);
 }
 must(roots.length>=8,'Too few verified local BUKLOD inventory roots');
 const seenPaths=new Set(),uniqueBlobs=new Set(),historicalDirs=new Set();
 for(const root of roots){
  let stat;try{stat=fs.lstatSync(root)}catch{audit.scanComplete=false;audit.unreadable.push(root);continue}
  if(stat.isSymbolicLink())continue;
  if(historical.test(root)&&stat.isDirectory())historicalDirs.add(norm(root));
  const queue=stat.isFile()?[{file:root,depth:0,old:historical.test(root)}]:[{dir:root,depth:0,old:historical.test(root)}];
  while(queue.length){
   const item=queue.pop();
   if(item.depth>48){audit.scanComplete=false;continue}
   let entries;
   if(item.file)entries=[{name:path.basename(item.file),isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>false,abs:item.file}];
   else try{entries=fs.readdirSync(item.dir,{withFileTypes:true})}
     catch{audit.scanComplete=false;if(audit.unreadable.length<300)audit.unreadable.push(item.dir);continue}
   for(const entry of entries){
    if(entry.isSymbolicLink())continue;
    const full=entry.abs||path.join(item.dir,entry.name),old=item.old||historical.test(full);
    if(entry.isDirectory()){
      if(generated.test(entry.name)){audit.generatedFoldersExcluded++;continue}
      if(old&&!item.old)historicalDirs.add(norm(full));
      queue.push({dir:full,depth:item.depth+1,old});continue
    }
    if(!entry.isFile()||!old)continue;
    const key=norm(full);if(seenPaths.has(key))continue;seenPaths.add(key);
    if(++audit.filesExamined>600000)throw Error('Historical file scan safety cap reached');
    let info,sha;
    try{info=fs.statSync(full);if(!info.isFile())continue;sha=blob(full,info.size)}
    catch{audit.scanComplete=false;if(audit.unreadable.length<300)audit.unreadable.push(full);continue}
    audit.historicalFiles++;audit.historicalBytes+=info.size;
    if(sourceBlobs.has(sha)){audit.alreadyInGit++;continue}
    if(backupBlobs.has(sha)){audit.alreadyInV3V6++;continue}
    if(uniqueBlobs.has(sha)){audit.localContentDuplicates++;continue}
    uniqueBlobs.add(sha);
    const category=type(full);audit.uniqueByType[category]=(audit.uniqueByType[category]||0)+1;
    const rootName=path.basename(root).slice(0,90);
    const g=audit.byTopRoot[rootName]||(audit.byTopRoot[rootName]={files:0,bytes:0});g.files++;g.bytes+=info.size;
    audit.uniqueFiles++;audit.uniqueBytes+=info.size;
    audit.uniqueFileRecords.push({originalPath:full,bytes:info.size,gitBlob:sha,category,mtimeMs:Math.round(info.mtimeMs)});
    if(audit.historicalFiles%4000===0)console.log('Historical inspected:',audit.historicalFiles,'unique pending:',audit.uniqueFiles);
   }
  }
 }
 audit.historicalFolders=historicalDirs.size;
 audit.status='HISTORICAL_PARITY_AUDITED_PRESERVATION_PENDING';
 save();
 console.log('BUKLOD HISTORICAL PARITY AUDIT COMPLETE');
 console.log('Historical folders identified:',audit.historicalFolders,'files:',audit.historicalFiles);
 console.log('Already in canonical cloud source:',audit.alreadyInGit,'already in V3/V6:',audit.alreadyInV3V6);
 console.log('Duplicate local content:',audit.localContentDuplicates);
 console.log('UNIQUE HISTORICAL FILES REQUIRING PRESERVATION:',audit.uniqueFiles);
 console.log('Unique historical data (GiB):',(audit.uniqueBytes/1024**3).toFixed(2));
 console.log('Categories:',JSON.stringify(audit.uniqueByType));
 console.log('Unavailable roots:',audit.missingRoots.length,'unreadable:',audit.unreadable.length,'scan complete:',audit.scanComplete);
 console.log('Report:',reportPath);
 console.log('LOCAL DELETION STILL NOT AUTHORIZED. Historical unique files not yet uploaded and app builds pending.');
}catch(e){
 audit.status='HISTORICAL_AUDIT_BLOCKED';audit.error=String(e.message);save();
 console.error('SAFE STOP:',e.message);console.error('No originals deleted. Local report:',reportPath);process.exitCode=1;
}
