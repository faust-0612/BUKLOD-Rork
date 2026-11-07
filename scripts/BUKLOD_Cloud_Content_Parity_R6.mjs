#!/usr/bin/env node
// BUKLOD R6: read-only content-based cloud reconciliation for R5 local differences.
// Does NOT upload local contents, push commits, delete originals, or grant deletion clearance.
// Metadata-only Git clones are created under TEMP and safely disposed after use.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const EXPECTED_R4 = '9cef155f2378fc77a46e20325259e81136525e45';
const CATEGORY_KEYS = ['source_code','media_or_fonts','config_or_documents','other_unclassified'];
const SOURCES = [
  { id:'essentials-recovery', repository:'faust-0612/BUKLOD-Migrated-Sources',
    branch:'migration/essentials-recovery-20261107023554',
    expected:'f3e5226143090611d42b8dd7abf8a5f1ab7b33b8' },
  { id:'quiz-dev', repository:'faust-0612/BUKLOD-Migrated-Sources',
    branch:'dev/quiz-r10-main-db-reconciliation-20261107',
    expected:'2e1a1366465427fad35682b5a34e31928d7c4c81' },
  { id:'main-production-source', repository:'faust-0612/BUKLOD-Rork',
    branch:'main', expected:null },
  { id:'main-quiz-dev', repository:'faust-0612/BUKLOD-Rork',
    branch:'dev/quiz-consolidation-identity-audit-20261107', expected:null }
];

function insist(ok, message) {
  if (!ok) throw new Error(message);
}
function csvRows(raw) {
  raw=raw.replace(/^\uFEFF/,'');
  const records=[];
  let row=[], field='', quoted=false;
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(quoted){
      if(ch==='"' && raw[i+1]==='"'){field+='"';i++;}
      else if(ch==='"'){quoted=false;}
      else field+=ch;
    } else if(ch==='"') {
      insist(field==='', 'Malformed CSV quoting');
      quoted=true;
    } else if(ch===',') {
      row.push(field);field='';
    } else if(ch==='\n') {
      row.push(field.replace(/\r$/,''));field='';
      if(row.some(x=>x!=='')) records.push(row);
      row=[];
    } else if(ch==='\r') {
      // Ignore line separators outside quoted cells; quoted cells retain CR.
    } else field+=ch;
  }
  insist(!quoted,'Unterminated CSV quote');
  if(field!=='' || row.length){row.push(field);records.push(row);}
  insist(records.length>0,'Missing R5 private CSV header');
  const header=records.shift();
  const needed=['candidate','kind','category','relative','bytes'];
  insist(needed.every(k=>header.includes(k)),'R5 private CSV lacks expected columns');
  return records.map(values=>{
    insist(values.length===header.length,'Malformed R5 CSV record');
    const item={};
    for(let i=0;i<header.length;i++) item[header[i]]=values[i];
    return item;
  });
}
function safeRelative(s) {
  insist(typeof s==='string' && s.length>0 && s.length<10000,'Invalid relative path length');
  insist(!s.startsWith('/') && !s.includes('\\') && !s.includes(':') &&
         !s.split('/').some(p=>p===''||p==='.'||p==='..'),'Path escape detected');
  return s;
}
function isSensitive(rel) {
  const p=rel.toLowerCase();
  return /(^|\/)\.env($|\.)/.test(p) ||
    /(^|\/)(\.npmrc|\.pypirc|id_rsa|id_ed25519|service[-_]?account|credentials?|secrets?|keystores?)(\/|\.|$)/.test(p) ||
    /(\.jks|\.keystore|\.pem|\.p12|\.pfx|\.key|\.sqlite3?|\.db|\.kdbx|\.asc)$/.test(p) ||
    /(^|\/)(google-services\.json|google-service-info\.plist)$/.test(p);
}
function freshBuckets() {
  return Object.fromEntries(CATEGORY_KEYS.map(k=>[k,{
    examined:0,matched:0,unmatched:0,bytesExamined:0,bytesUnmatched:0
  }]));
}
function git(args,options={}) {
  return execFileSync('git',args,{
    encoding:'utf8',maxBuffer:90*1024*1024,timeout:180000,
    stdio:['ignore','pipe','pipe'],...options
  }).toString().trim();
}
function indexTree(repoDir,sourceId,objectIndex) {
  const output=execFileSync('git',['-C',repoDir,'ls-tree','-r','-z','HEAD'],{
    encoding:'buffer',maxBuffer:90*1024*1024,timeout:120000
  });
  let count=0, start=0;
  for(let pos=0;pos<output.length;pos++){
    if(output[pos]!==0)continue;
    const split=output.indexOf(9,start);
    if(split>start){
      const metadata=output.subarray(start,split).toString('ascii');
      const match=metadata.match(/^[0-7]{6} blob ([0-9a-f]{40})$/);
      if(match){
        count++;
        let owners=objectIndex.get(match[1]);
        if(!owners){owners=new Set();objectIndex.set(match[1],owners);}
        owners.add(sourceId);
      }
    }
    start=pos+1;
  }
  return count;
}
async function gitBlobForFile(filename,size) {
  const digest=crypto.createHash('sha1');
  digest.update('blob '+String(size)+'\0');
  for await(const chunk of fs.createReadStream(filename)) digest.update(chunk);
  return digest.digest('hex');
}
async function selfTest() {
  insist(safeRelative('src/quiz.tsx')==='src/quiz.tsx','valid source path failed');
  for(const bad of ['../private','C:/root','app//main.tsx','app\\test.tsx','']){
    let rejected=false;
    try{safeRelative(bad);}catch{rejected=true;}
    insist(rejected,'invalid path accepted by R6');
  }
  const csv='"candidate","kind","category","relative","bytes"\r\n'+
    '"BUILD","LOCAL_EXTRA","source_code","src/comma,quote""test.ts","12"\r\n';
  const rows=csvRows(csv);
  insist(rows.length===1 && rows[0].relative==='src/comma,quote"test.ts',
         'Windows CSV quoted field parsing regression');
  insist(isSensitive('assets/.env.production') && isSensitive('android/keystore.jks') &&
         !isSensitive('src/quiz.tsx'),'protected file guard failed');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-r6-ci-fixture-'));
  try{
    const original=path.join(tmp,'demo.xml');
    fs.writeFileSync(original,Buffer.from('<vector>\n<path/>\n</vector>\n','utf8'));
    const bytes=fs.statSync(original).size;
    const digest=await gitBlobForFile(original,bytes);
    const checkout=git(['hash-object','--no-filters',original]);
    insist(digest===checkout,'Git blob SHA-1 hashing differs from Git hash-object');
    fs.writeFileSync(original,Buffer.from('<vector>\r\n<path/>\r\n</vector>\r\n','utf8'));
    const other=await gitBlobForFile(original,fs.statSync(original).size);
    insist(other!==digest,'R6 failed to distinguish CRLF from LF content');
  }finally{
    // Only delete the synthetic temporary fixture created by this self-test.
    fs.rmSync(tmp,{recursive:true,force:true});
  }
  console.log('BUKLOD R6 SELF-TEST PASSED: Windows CSV, protected paths, Git blob hashing, LF/CRLF and path isolation.');
}
function summaryForError(err) {
  // Never print local paths, URLs, Git auth headers or private source names.
  if(err && err.code==='ENOENT')return 'MISSING_GIT_OR_SOURCE';
  if(err && err.code==='ETIMEDOUT')return 'GIT_TIMEOUT';
  return 'REMOTE_INDEX_UNAVAILABLE';
}
async function main() {
  const args=process.argv.slice(2);
  if(args.includes('--self-test'))return selfTest();
  const argIdx=args.indexOf('--r4');
  insist(argIdx>=0 && args[argIdx+1] && args.length===2,
         'Usage: node BUKLOD_Cloud_Content_Parity_R6.mjs --r4 FULL_R4_JSON_PATH');
  const r4Path=path.resolve(args[argIdx+1]);
  const reportDir=path.dirname(r4Path);
  const r4=JSON.parse(fs.readFileSync(r4Path,'utf8').replace(/^\uFEFF/,''));
  const r5Path=path.join(reportDir,'BUKLOD_R5_Sanitized_Summary.json');
  const csvPath=path.join(reportDir,'BUKLOD_R5_LOCAL_PRIVATE_DETAILS.csv');
  const r5=JSON.parse(fs.readFileSync(r5Path,'utf8').replace(/^\uFEFF/,''));
  insist(r4.archiveCommit===EXPECTED_R4 && r4.deleteClearance===false,
         'R4 expected verified commit/deletion guard mismatch');
  insist(r5.archivedCommit===EXPECTED_R4 &&
         r5.schema==='buklod-quiz-cloud-diff-r5/v1' &&
         r5.deleteClearance===false,
         'R5 schema/revision/deletion guard mismatch');
  insist(Array.isArray(r5.candidates) && r5.candidates.length===2 &&
         r5.candidates.every(x=>x.matchesPriorR4Counts===true),
         'R5 audit failed reconciliation to R4; do not proceed');
  const allRows=csvRows(fs.readFileSync(csvPath,'utf8'));
  const candidateMap=new Map(r5.candidates.map(c=>[c.candidate,c]));
  let supportedRows=0;
  for(const row of allRows) {
    insist(candidateMap.has(row.candidate),'Unexpected candidate in private R5 details');
    insist(['LOCAL_EXTRA','CHANGED_ARCHIVED_FILE','MISSING_LOCALLY_BUT_IN_CLOUD'].includes(row.kind),
           'Unknown R5 detail record type');
    safeRelative(row.relative);
    insist(!isSensitive(row.relative),'R5 detailed CSV contains potentially sensitive filenames; stop');
    if(row.kind==='LOCAL_EXTRA'){
      insist(CATEGORY_KEYS.includes(row.category),'Unexpected extra-file category');
      supportedRows++;
    }
  }
  let expectedRows=0;
  for(const c of r5.candidates){
    const k=c.extrasByCategory;
    const calc=CATEGORY_KEYS.reduce((n,key)=>n+Number(k[key]||0),0);
    const total=Number(c.localExtraFiles)-Number(k.generated_or_dependency||0)-
      Number(k.protected_credentials_or_data||0);
    insist(calc===total,'R5 classification sum mismatch');
    expectedRows+=total;
  }
  insist(supportedRows===expectedRows,'R5 local-extra rows do not match sanitized counts');
  const existingArchive=path.join(reportDir,'source');
  insist(fs.existsSync(existingArchive),'Verified R4 archive checkout not found');
  insist(git(['-C',existingArchive,'rev-parse','HEAD'])===EXPECTED_R4,
         'Original R4 private archive checkout changed since verification');

  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-r6-cloud-tree-index-'));
  const index=new Map();
  const sourceStatus=[];
  console.log('R6: indexing cloud Git trees only (no working-tree checkout or local data upload)...');
  try{
    const r4Count=indexTree(existingArchive,'immutable-quiz-archive',index);
    sourceStatus.push({source:'immutable-quiz-archive',commit:EXPECTED_R4,
      indexedBlobs:r4Count,status:'VERIFIED_R4_CHECKOUT'});
    for(let i=0;i<SOURCES.length;i++){
      const source=SOURCES[i];
      const cloneTo=path.join(tmp,'tree-'+String(i));
      try{
        git(['clone','-c','core.autocrlf=false','-c','core.eol=lf',
          '--quiet','--filter=blob:none','--no-checkout','--depth','1',
          '--single-branch','--branch',source.branch,
          'https://github.com/'+source.repository+'.git',cloneTo]);
        const actual=git(['-C',cloneTo,'rev-parse','HEAD']);
        if(source.expected)insist(actual===source.expected,
          'Cloud branch revision drift: '+source.id);
        const n=indexTree(cloneTo,source.id,index);
        sourceStatus.push({source:source.id,commit:actual,
          indexedBlobs:n,status:'INDEXED'});
        console.log('  '+source.id+': '+n+' Git tree blobs indexed');
      }catch(err){
        sourceStatus.push({source:source.id,status:summaryForError(err),indexedBlobs:0});
        console.log('  '+source.id+': could not verify cloud tree (will NOT count as covered)');
      }
    }
  }finally{
    // Only remove metadata clones made in the OS temp dir by this R6 process.
    fs.rmSync(tmp,{recursive:true,force:true});
  }

  const result=[];
  let totalExamined=0, totalExactMatches=0,totalUnmatched=0,totalReadErrors=0;
  for(const c of r5.candidates){
    const input=allRows.filter(x=>x.candidate===c.candidate &&
      (x.kind==='LOCAL_EXTRA'||x.kind==='CHANGED_ARCHIVED_FILE'));
    const byCategory=freshBuckets();
    const matchesByCloudSource={};
    const stats={candidate:c.candidate,filesEligible:input.length,readAndHashed:0,
      exactCloudBlobMatches:0,noExactMatchInIndexedCloud:0,changedSinceR5:0,
      symlinkOrEscaped:0,readErrors:0,changedArchiveFilesTested:0,
      byCategory,matchesByCloudSource};
    const root=path.resolve(c.localRoot);
    const realRoot=fs.realpathSync.native(root);
    let offset=0;
    async function worker() {
      for(;;){
        const next=offset++;
        if(next>=input.length)return;
        const row=input[next],relative=safeRelative(row.relative);
        const filename=path.resolve(root,...relative.split('/'));
        if(!filename.toLowerCase().startsWith((root+path.sep).toLowerCase())){
          stats.symlinkOrEscaped++;continue;
        }
        try{
          const lst=fs.lstatSync(filename);
          if(!lst.isFile() || lst.isSymbolicLink()){
            stats.symlinkOrEscaped++;continue;
          }
          const realFile=fs.realpathSync.native(filename);
          if(!realFile.toLowerCase().startsWith((realRoot+path.sep).toLowerCase())){
            stats.symlinkOrEscaped++;continue;
          }
          const previousBytes=Number(row.bytes);
          insist(Number.isSafeInteger(previousBytes) && previousBytes>=0,
                 'Invalid R5 file size');
          if(lst.size!==previousBytes){
            stats.changedSinceR5++;continue;
          }
          const objId=await gitBlobForFile(filename,lst.size);
          const after=fs.statSync(filename);
          if(after.size!==lst.size || after.mtimeMs!==lst.mtimeMs){
            stats.changedSinceR5++;continue;
          }
          stats.readAndHashed++;
          if(row.kind==='CHANGED_ARCHIVED_FILE')stats.changedArchiveFilesTested++;
          const bucket=byCategory[row.category] || byCategory.other_unclassified;
          bucket.examined++;
          bucket.bytesExamined+=lst.size;
          const found=index.get(objId);
          if(found){
            stats.exactCloudBlobMatches++;
            bucket.matched++;
            for(const owner of found)
              matchesByCloudSource[owner]=(matchesByCloudSource[owner]||0)+1;
          }else{
            stats.noExactMatchInIndexedCloud++;
            bucket.unmatched++;
            bucket.bytesUnmatched+=lst.size;
          }
        }catch{
          stats.readErrors++;
        }
      }
    }
    await Promise.all(Array.from({length:6},()=>worker()));
    totalExamined+=stats.readAndHashed;
    totalExactMatches+=stats.exactCloudBlobMatches;
    totalUnmatched+=stats.noExactMatchInIndexedCloud;
    totalReadErrors+=stats.readErrors;
    result.push(stats);
    console.log(c.candidate+': '+stats.readAndHashed+' files hashed, '+
      stats.exactCloudBlobMatches+' exact cloud matches, '+
      stats.noExactMatchInIndexedCloud+' not matched in indexed branches.');
  }
  const allCloudIndexed=sourceStatus.every(s=>
    s.status==='INDEXED' || s.status==='VERIFIED_R4_CHECKOUT');
  const summary={
    schema:'buklod-r6-exact-git-blob-parity/v1',
    createdUtc:new Date().toISOString(),
    immutableR4Archive:EXPECTED_R4,
    sourceCoverageComplete:allCloudIndexed,
    indexedCloudSources:sourceStatus,
    uniqueCloudBlobIds:index.size,
    localExtraRecordsEligible:expectedRows,
    totalFilesHashed:totalExamined,
    totalExactContentMatches:totalExactMatches,
    totalNotMatchedInIndexedCloud:totalUnmatched,
    totalReadErrors,
    candidateResults:result,
    generatedAndDependencyFilesNotAssumedRecoverable:true,
    protectedCredentialFilesNotRead:true,
    rawLocalFilesUploaded:false,
    fullPCBackupCertified:false,
    deleteClearance:false,
    interpretation:'Not matched means no identical Git blob in the selected cloud refs, not proof that the file does not exist in any backup. No uploaded file, no clean restore, no signing-key recovery.'
  };
  const out=path.join(reportDir,'BUKLOD_R6_Sanitized_Cloud_Content_Parity.json');
  fs.writeFileSync(out,JSON.stringify(summary,null,2)+'\n',{encoding:'utf8',flag:'w',mode:0o600});
  console.log('SHARE ONLY THIS SUMMARY: '+out);
  console.log('NO DELETE CLEARANCE. All original PC files remain untouched.');
}
main().catch(error=>{
  console.error('R6 FAIL CLOSED: '+(error instanceof Error ? error.message : 'Unexpected error'));
  process.exitCode=1;
});
