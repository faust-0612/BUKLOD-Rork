#!/usr/bin/env node
'use strict';

/**
 * BUKLOD Quiz local deletion gate: DIAGNOSTIC ONLY.
 *
 * Run AFTER verifying a clean archive clone with
 * verify-quiz-cloud-restore-r1.cjs --keep.
 *
 * node scripts/audit-local-quiz-deletion-readonly-r1.cjs --archive-root "C:\...\buklod-quiz-clean-restore-..." 
 *
 * Produces NO DELETE COMMANDS. It compares every significant file in both
 * known local Quiz source folders against the immutable GitHub archive,
 * reporting differences, unarchived paths, secret/signing-key candidates,
 * symlinks, and skipped dependency/generated directories.
 *
 * A clean report is NOT sufficient for a global BUKLOD deletion clearance;
 * the operator must separately audit all other BUKLOD folders, unique assets,
 * signing keys, restore build, and independent backup.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const candidateDirs=[
  ['BUKLODQ_R10_BUILD_project_3d5647803088_04e596c8cfeb','C:\\BUKLODQ_R10_BUILD\\project'],
  ['BUKLODQ_BUILD_project_8374b517b993_481385774640','C:\\BUKLODQ_BUILD\\project'],
];
const archivePath='systems/quiz/BUKLOD_Quiz_Standalone_CANDIDATES';
const generated=/^(?:node_modules(?:[-_].+)?|\.git|\.expo|\.gradle|\.cxx|\.turbo|\.next|coverage|\.cache)$/i;
const secret=/(?:^|\/)(?:\.env(?:\..+)?|.*\.(?:jks|keystore|p8|p12|pfx|pem|key)|google-services\.json|GoogleService-Info\.plist|credentials?\.json|.*service[_-]?account.*\.json)$/i;
const MAX_TOTAL_FILES=125000;
const MAX_DEPTH=45;
const args=process.argv.slice(2);
const archiveIndex=args.indexOf('--archive-root');
if(archiveIndex<0||!args[archiveIndex+1]||args.length!==2){
  console.error('Usage: node audit-local-quiz-deletion-readonly-r1.cjs --archive-root <clean-clone-path>');
  process.exit(2);
}
const clean=path.resolve(args[archiveIndex+1]);
const report={
  status:'BLOCKED_PENDING_REVIEW',
  archiveRoot:clean,
  checkedAt:new Date().toISOString(),
  candidates:[],
  noDeletionPerformed:true,
};
let scanned=0;
function fileHash(file){
  const h=crypto.createHash('sha256');
  const fd=fs.openSync(file,'r');
  const buf=Buffer.alloc(1024*1024);
  try{
    while(true){
      const n=fs.readSync(fd,buf,0,buf.length,null);
      if(!n)break;
      h.update(buf.subarray(0,n));
    }
  }finally{fs.closeSync(fd)}
  return h.digest('hex');
}
function boundedWalk(root,visit){
  function walk(folder,relative,depth){
    if(depth>MAX_DEPTH)throw new Error('Scan depth cap exceeded');
    for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
      scanned++;if(scanned>MAX_TOTAL_FILES)throw new Error('Global scan file cap exceeded');
      const rel=relative ? relative+'/'+entry.name:entry.name;
      const abs=path.join(folder,entry.name);
      if(entry.isSymbolicLink()){visit({rel,abs,type:'symlink'});continue;}
      if(entry.isDirectory()){
        if(generated.test(entry.name)){visit({rel,abs,type:'generated_directory'});continue;}
        walk(abs,rel,depth+1);
        continue;
      }
      if(entry.isFile()){visit({rel,abs,type:'file'});continue;}
      visit({rel,abs,type:'other'});
    }
  }
  walk(root,'',0);
}

for(const [id,sourceDir] of candidateDirs){
  const snapshotDir=path.join(clean,archivePath,id);
  const manifest=JSON.parse(fs.readFileSync(
    path.join(snapshotDir,'QUIZ_RECOVERY_MANIFEST.json'),'utf8'
  ));
  const fileMap=new Map(manifest.files.map(f=>[f.rel,f]));
  const candidate={
    sourceDir,
    cloudSnapshot:id,
    manifestFiles:manifest.files.length,
    matching:0,missingFromLocal:0,
    changedSinceBackup:[],
    notBackedUp:[],
    privateKeysOrSecrets:[],
    generatedDirectoriesExcluded:[],
    unsafeLinks:[],
    error:null,
  };
  if(!fs.existsSync(sourceDir)){
    candidate.error='LOCAL_SOURCE_ROOT_MISSING';
    report.candidates.push(candidate);
    continue;
  }
  const existing=new Set();
  try{
    boundedWalk(sourceDir,({rel,abs,type})=>{
      if(type==='generated_directory'){
        candidate.generatedDirectoriesExcluded.push(rel);
        return;
      }
      if(type!=='file'){
        candidate.unsafeLinks.push(rel);
        return;
      }
      if(secret.test(rel)){
        candidate.privateKeysOrSecrets.push(rel);
        return;
      }
      const saved=fileMap.get(rel);
      if(!saved){
        candidate.notBackedUp.push(rel);
        return;
      }
      existing.add(rel);
      const st=fs.statSync(abs);
      if(st.size!==saved.bytes || fileHash(abs)!==saved.sha256){
        candidate.changedSinceBackup.push(rel);
        return;
      }
      candidate.matching++;
    });
    candidate.missingFromLocal=manifest.files.filter(f=>!existing.has(f.rel)).length;
    // Missing from local is not a cloud loss, but is evidence of a variant.
  }catch(error){
    candidate.error=String(error.message||error);
  }
  report.candidates.push(candidate);
}
const failures=report.candidates.filter(x=>
  x.error||x.changedSinceBackup.length||x.notBackedUp.length||
  x.privateKeysOrSecrets.length||x.unsafeLinks.length
);
const good=failures.length===0 && report.candidates.every(x=>x.matching>0);
report.status=good?'QUIZ_SOURCE_FILES_MATCH_CLOUD_BUT_NO_BLANKET_DELETE_CLEARANCE':'BLOCKED_PENDING_REVIEW';
console.log(JSON.stringify(report,null,2));
console.log('NO LOCAL FILES WERE DELETED. Generated directories are skipped only for triage; not independently rebuild-verified.');
if(!good)process.exitCode=1;
