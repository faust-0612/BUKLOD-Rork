#!/usr/bin/env node
// BUKLOD R9 — reconcile successful R7 and R8 private-cloud recovery against R4–R6.
// READ ONLY: no pushes, no uploads, no edits/deletion of original PC files.
// PRIVATE file names/contents are never included in shareable results.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const ARCHIVE_SHA='9cef155f2378fc77a46e20325259e81136525e45';
const REMOTE='https://github.com/faust-0612/BUKLOD-Migrated-Sources.git';
const CONFIG=[
 {name:'R7',report:'BUKLOD_R7_SANITIZED_CLOUD_SOURCE_RECOVERY.json',
  schema:'buklod-r7-sanitized-rescue/v1',
  manifest:'systems/quiz/R7_LOCAL_SOURCE_RECOVERY/RECOVERY_MANIFEST.json',
  prefix:'systems/quiz/R7_LOCAL_SOURCE_RECOVERY/',
  branch:'migration/quiz-r7-local-source-recovery-20261107'},
 {name:'R8',report:'BUKLOD_R8_SANITIZED_NATIVE_SOURCE_RECOVERY.json',
  schema:'buklod-r8-sanitized-native-rescue/v1',
  manifest:'systems/quiz/R8_NATIVE_SOURCE_RECOVERY/RECOVERY_MANIFEST.json',
  prefix:'systems/quiz/R8_NATIVE_SOURCE_RECOVERY/',
  branch:'migration/quiz-r8-native-source-recovery-20261107'}
];
const ALLOWED_CANDIDATES=new Set(['R10','BUILD']);
const CATEGORIES=['source_code','config_or_documents','media_or_fonts','other_unclassified'];
function assert(ok,message){if(!ok)throw Error(message);}
function git(args,opts={}){
 return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],
  maxBuffer:30*1024*1024,timeout:180000,...opts}).toString().trim();
}
function parseCsv(input) {
 input=input.replace(/^\uFEFF/,'');
 const records=[];let parts=[],cur='',quoted=false;
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(quoted){
   if(ch==='"'&&input[i+1]==='"'){cur+='"';i++;}
   else if(ch==='"')quoted=false;
   else cur+=ch;
  }else if(ch==='"'){assert(cur==='', 'Bad CSV quoting');quoted=true;}
  else if(ch===','){parts.push(cur);cur='';}
  else if(ch==='\n'){
   parts.push(cur.replace(/\r$/,''));cur='';
   if(parts.some(x=>x!==''))records.push(parts);
   parts=[];
  }else if(ch!=='\r')cur+=ch;
 }
 assert(!quoted,'CSV quote unterminated');
 if(cur||parts.length){parts.push(cur);records.push(parts);}
 assert(records.length,'Empty R5 private detail CSV');
 const columns=records.shift();
 for(const key of ['candidate','kind','category','relative','bytes'])
  assert(columns.includes(key),'R5 private CSV has incompatible schema');
 return records.map(values=>{
  assert(values.length===columns.length,'Malformed R5 CSV row');
  return Object.fromEntries(columns.map((name,i)=>[name,values[i]]));
 });
}
function relative(rel) {
 assert(typeof rel==='string'&&rel.length>0&&rel.length<10000,'Unsafe path length');
 assert(!rel.startsWith('/')&&!rel.includes('\\')&&!rel.includes(':')&&
  !rel.split('/').some(x=>x===''||x==='.'||x==='..'),
  'Unsafe private metadata path');
 return rel;
}
function recoveryKey(candidate,rel){
 assert(ALLOWED_CANDIDATES.has(candidate),'Unknown source candidate');
 return candidate+'\0'+relative(rel);
}
function recoveredRow(rel,prefix){
 assert(rel.startsWith(prefix),'Recovery manifest path outside expected branch prefix');
 const rest=relative(rel.slice(prefix.length));
 const parts=rest.split('/');
 const candidate=parts.shift();
 return recoveryKey(candidate,parts.join('/'));
}
function readJson(file){
 return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
}
function treeFiles(repo,prefix){
 const buf=execFileSync('git',['-C',repo,'ls-tree','-r','-z','HEAD','--',prefix],{
  encoding:'buffer',stdio:['ignore','pipe','pipe'],maxBuffer:120*1024*1024,timeout:120000
 });
 const names=new Set();let from=0;
 for(let i=0;i<buf.length;i++){
  if(buf[i]!==0)continue;
  const entry=buf.subarray(from,i);const tab=entry.indexOf(9);
  assert(tab>0,'Git tree metadata invalid');
  assert(/^100(?:644|755) blob [a-f0-9]{40}$/.test(entry.subarray(0,tab).toString('ascii')),
   'Git tree contained a nonregular file or symlink');
  const name=entry.subarray(tab+1).toString('utf8');
  assert(!names.has(name),'Duplicate file in cloud tree');
  names.add(name);from=i+1;
 }
 return names;
}
function validateRemoteManifest(repo,config,priorR7,expectedReport){
 const text=git(['-C',repo,'show','HEAD:'+config.manifest]);
 const manifest=JSON.parse(text);
 const expectedSchema=config.name==='R7'?
  'buklod-r7-source-rescue/v1':'buklod-r8-native-source-rescue/v1';
 assert(manifest.schema===expectedSchema,'Cloud manifest schema changed');
 assert(manifest.targetBranch===config.branch && manifest.privateRepo==='faust-0612/BUKLOD-Migrated-Sources',
  'Cloud manifest target/destination mismatch');
 if(config.name==='R8')assert(manifest.priorR7RecoveryCommit===priorR7,
  'R8 source manifest does not reference verified R7 revision');
 assert(manifest.recoveryFromR4===ARCHIVE_SHA,'Cloud manifest prior archive differs');
 assert(manifest.candidateFilesIncluded===expectedReport.stagedFiles &&
  manifest.bytesStaged===expectedReport.stagedBytes &&
  Array.isArray(manifest.files)&&manifest.files.length===expectedReport.stagedFiles,
  'Remote source manifest counts do not match R7/R8 restored report');
 const tree=treeFiles(repo,config.prefix);
 assert(tree.size===expectedReport.stagedFiles+2 &&
  tree.has(config.manifest) && tree.has(config.prefix+'README.md'),
  'Remote tree contains unexpected/missing files for its signed source manifest');
 const keys=new Map();
 let sum=0;
 for(const item of manifest.files){
  assert(item&&typeof item==='object'&&
   /^[0-9a-f]{64}$/.test(item.sha256)&&
   Number.isSafeInteger(item.bytes)&&item.bytes>=0,'Invalid remote manifest hash/byte count');
  assert(item.originalKind==='LOCAL_EXTRA'||item.originalKind==='CHANGED_ARCHIVED_FILE',
   'Remote manifest has unexpected source-kind entry');
  const key=recoveredRow(item.path,config.prefix);
  assert(!keys.has(key),'Duplicate candidate-relative path in branch manifest');
  assert(tree.has(item.path),'Cloud tree missing item from SHA256 recovery manifest');
  keys.set(key,{sha256:item.sha256,bytes:item.bytes,kind:item.originalKind});
  sum+=item.bytes;
 }
 assert(sum===expectedReport.stagedBytes,'Manifest byte sum did not reconcile');
 return {keyMap:keys,blobCount:tree.size,bytes:sum};
}
async function fileSHA256(filename){
 const digest=crypto.createHash('sha256');
 for await(const chunk of fs.createReadStream(filename))digest.update(chunk);
 return digest.digest('hex');
}
function candidateRoot(candidateMap,candidate){
 const cfg=candidateMap.get(candidate);
 assert(cfg&&typeof cfg.localRoot==='string','R5 candidate has no local root');
 return path.resolve(cfg.localRoot);
}
async function selfTest(){
 const rows=parseCsv('"candidate","kind","category","relative","bytes"\r\n'+
  '"BUILD","LOCAL_EXTRA","source_code","src/with,comma""quote.cpp","12"\r\n');
 assert(rows.length===1&&rows[0].relative==='src/with,comma"quote.cpp','CSV regression');
 for(const bad of ['../secret','C:/hidden','/root','app//index.ts','app\\bad.ts','']){
  let rejected=false;try{relative(bad)}catch{rejected=true;}
  assert(rejected,'Path traversal regression');
 }
 const key=recoveredRow('systems/quiz/R7_LOCAL_SOURCE_RECOVERY/BUILD/src/native.h',CONFIG[0].prefix);
 assert(key===recoveryKey('BUILD','src/native.h'),'Manifest mapping regression');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-r9-synthetic-'));
 try{
  const source=path.join(dir,'file.txt');
  fs.writeFileSync(source,'hello BUKLOD\n');
  const hash=await fileSHA256(source);
  assert(hash===crypto.createHash('sha256').update('hello BUKLOD\n').digest('hex'),
   'SHA256 file stream regression');
  const repo=path.join(dir,'repo');
  git(['init','-q','-b','test',repo]);
  git(['-C',repo,'config','user.name','Buklod Safety CI']);
  git(['-C',repo,'config','user.email','buklod@test.invalid']);
  const file=path.join(repo,'systems','quiz','R7_LOCAL_SOURCE_RECOVERY','BUILD','src','native.h');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,'// native source\n');
  git(['-C',repo,'add','.']);
  git(['-C',repo,'commit','-q','-m','synthetic']);
  const tree=treeFiles(repo,'systems/quiz/R7_LOCAL_SOURCE_RECOVERY/');
  assert(tree.size===1&&tree.has('systems/quiz/R7_LOCAL_SOURCE_RECOVERY/BUILD/src/native.h'),
   'Git tree enumeration regression');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log('BUKLOD R9 SELF-TEST PASSED: safe CSV, paths, Git tree, source mapping and SHA256.');
}
async function main() {
 const args=process.argv.slice(2);
 if(args.includes('--self-test'))return selfTest();
 assert(args.length===2&&args[0]==='--r4'&&args[1],
  'Usage: node BUKLOD_R9_Cloud_Recovery_Reconciliation.mjs --r4 FULL_R4_REPORT_PATH');
 const reportPath=path.resolve(args[1]);
 const dir=path.dirname(reportPath);
 const r4=readJson(reportPath);
 const r5=readJson(path.join(dir,'BUKLOD_R5_Sanitized_Summary.json'));
 const r6=readJson(path.join(dir,'BUKLOD_R6_Sanitized_Cloud_Content_Parity.json'));
 assert(r4.archiveCommit===ARCHIVE_SHA&&r4.deleteClearance===false,'R4 proof invalid');
 assert(r5.archivedCommit===ARCHIVE_SHA&&r5.deleteClearance===false&&
  r5.schema==='buklod-quiz-cloud-diff-r5/v1','R5 proof invalid');
 assert(r6.immutableR4Archive===ARCHIVE_SHA&&r6.sourceCoverageComplete===true&&
  r6.totalReadErrors===0&&r6.deleteClearance===false,'R6 proof invalid');
 assert(r5.candidates.length===2&&
  r5.candidates.every(x=>x.matchesPriorR4Counts===true),'R5 original counts invalid');
 const reports=CONFIG.map(c=>readJson(path.join(dir,c.report)));
 for(let i=0;i<CONFIG.length;i++){
  const r=reports[i],c=CONFIG[i];
  assert(r.schema===c.schema&&r.branch===c.branch&&r.destinationPrivateRepoVerified===true&&
   r.freshIndependentCloudCloneVerified===true&&r.allRestoredSha256Verified===true&&
   r.deleteClearance===false&&r.rawProtectedFilesUploaded===false&&
   /^[0-9a-f]{40}$/.test(r.commit),'R7/R8 recovery report invalid');
 }
 assert(reports[1].priorR7RecoveryCommit===reports[0].commit,
  'R8 chained commit mismatches R7 report');
 const input=parseCsv(fs.readFileSync(path.join(dir,'BUKLOD_R5_LOCAL_PRIVATE_DETAILS.csv'),'utf8'));
 const localCandidates=new Map(r5.candidates.map(c=>[c.candidate,c]));
 const localRecords=new Map();
 for(const row of input){
  assert(ALLOWED_CANDIDATES.has(row.candidate),'Unexpected source candidate');
  assert(['LOCAL_EXTRA','CHANGED_ARCHIVED_FILE','MISSING_LOCALLY_BUT_IN_CLOUD'].includes(row.kind),
   'Unexpected source file class');
  const key=recoveryKey(row.candidate,row.relative);
  assert(!localRecords.has(key),'Duplicate R5 local-source records');
  localRecords.set(key,row);
 }
 const eligible=[...localRecords].filter(([,row])=>row.kind!=='MISSING_LOCALLY_BUT_IN_CLOUD');
 assert(eligible.length===r6.totalFilesHashed && r6.totalFilesHashed===15770,
  'R5/R6 eligible-count reconciliation changed; verify the current audit');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-r9-trees-'));
 const recovered=new Map(), sourceStatus=[];
 try{
  for(let i=0;i<CONFIG.length;i++){
   const c=CONFIG[i],r=reports[i],clone=path.join(temp,c.name);
   console.log('R9: indexing and checking SHA of existing '+c.name+' private recovery manifest...');
   git(['clone','--quiet','-c','core.autocrlf=false','-c','core.eol=lf',
    '--filter=blob:none','--no-checkout','--single-branch','--depth','1',
    '--branch',c.branch,REMOTE,clone],{timeout:220000});
   const head=git(['-C',clone,'rev-parse','HEAD']);
   assert(head===r.commit,'Cloud branch HEAD differs from independently restored R'+(7+i));
   const {keyMap,blobCount,bytes}=validateRemoteManifest(clone,c,reports[0].commit,r);
   for(const [key,entry] of keyMap){
    assert(localRecords.has(key),'Private recovered file missing in R5 source listing');
    assert(!recovered.has(key),'Overlap between R7 and R8 source recovery; audit cannot assume unique coverage');
    const local=localRecords.get(key);
    assert(local.kind===entry.kind && Number(local.bytes)===entry.bytes,
     'Recovery remote manifest differs from original R5 local metadata');
    recovered.set(key,{...entry,source:c.name});
   }
   sourceStatus.push({recovery:c.name,branch:c.branch,commit:head,
    remoteManifestFiles:keyMap.size,remoteManifestBytes:bytes,remoteTreeFiles:blobCount});
  }
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 assert(recovered.size===reports[0].stagedFiles+reports[1].stagedFiles,
  'Remote recovered path total mismatch');
 const residualByCategory=Object.fromEntries([...CATEGORIES,'other'].map(k=>[k,{files:0,bytes:0}]));
 const residualExtensions=new Map();
 let residualFiles=0,residualBytes=0,recoveredFilesVerifiedUnchanged=0;
 let recoveredFilesChanged=0,recoveredFilesUnreadable=0,recoveredPathUnsafe=0;
 const recoveredItems=[...recovered.entries()];
 let cursor=0;
 async function worker(){
  for(;;){
   const i=cursor++;
   if(i>=recoveredItems.length)return;
   const [key,manifest]=recoveredItems[i];
   const row=localRecords.get(key);
   try{
    const originalRoot=candidateRoot(localCandidates,row.candidate);
    const filename=path.resolve(originalRoot,...relative(row.relative).split('/'));
    assert(filename.toLowerCase().startsWith((originalRoot+path.sep).toLowerCase()),
      'Escaped original working path');
    const lst=fs.lstatSync(filename);
    assert(lst.isFile()&&!lst.isSymbolicLink(),'Symlink replaced a recovered file');
    const actualRoot=fs.realpathSync.native(originalRoot);
    const actualFile=fs.realpathSync.native(filename);
    assert(actualFile.toLowerCase().startsWith((actualRoot+path.sep).toLowerCase()),
      'Recovered file resolves outside its original root');
    if(lst.size!==manifest.bytes){recoveredFilesChanged++;continue;}
    const hash=await fileSHA256(filename);
    const after=fs.statSync(filename);
    if(after.size!==lst.size||after.mtimeMs!==lst.mtimeMs){recoveredFilesChanged++;continue;}
    if(hash===manifest.sha256)recoveredFilesVerifiedUnchanged++;
    else recoveredFilesChanged++;
   }catch(e){
    if(e?.message?.includes('Escaped original working path')||
       e?.message?.includes('Symlink replaced')||
       e?.message?.includes('outside its original root'))recoveredPathUnsafe++;
    else recoveredFilesUnreadable++;
   }
  }
 }
 await Promise.all(Array.from({length:6},()=>worker()));
 for(const [key,row] of eligible){
  if(recovered.has(key))continue;
  const bytes=Number(row.bytes);
  assert(Number.isSafeInteger(bytes)&&bytes>=0,'R5 residual size invalid');
  const group=CATEGORIES.includes(row.category)?row.category:'other';
  residualByCategory[group].files++;
  residualByCategory[group].bytes+=bytes;
  residualFiles++;residualBytes+=bytes;
  const extension=path.extname(row.relative).toLowerCase();
  const ext=/^\.[a-z0-9]{1,12}$/.test(extension)?extension:'[none/other]';
  const count=residualExtensions.get(ext)||{extension:ext,files:0,bytes:0};
  count.files++;count.bytes+=bytes;residualExtensions.set(ext,count);
 }
 assert(residualFiles+recovered.size===eligible.length,
  'Final recovery and residual totals do not match input rows');
 const {candidates}=r5;
 const protectedFilesNotInR5= candidates.reduce((a,c)=>a+Number(c.extrasByCategory.protected_credentials_or_data||0),0);
 const generatedNotInR5= candidates.reduce((a,c)=>a+Number(c.extrasByCategory.generated_or_dependency||0),0);
 const originalMissingButCloudArchived=candidates.reduce((a,c)=>a+Number(c.missingLocallyButCloudArchived||0),0);
 const summary={
  schema:'buklod-r9-two-stage-source-recovery-reconciliation/v1',
  timestampUtc:new Date().toISOString(),
  githubDestinationPrivateFromPriorVerifiedR7R8:true,
  cloudCommitAndManifestVerification:sourceStatus,
  r5LocalExtraAndChangedFiles:eligible.length,
  uniqueFilesInR7R8CloudManifests:recovered.size,
  recoveredFilesStillByteIdenticalOnLaptop:recoveredFilesVerifiedUnchanged,
  recoveredOriginalFilesChanged:recoveredFilesChanged,
  recoveredOriginalFilesReadErrors:recoveredFilesUnreadable,
  recoveredOriginalPathsRejected:recoveredPathUnsafe,
  unpreservedR5DetailRecords:residualFiles,
  unpreservedR5DetailBytes:residualBytes,
  unpreservedR5ByCategory:residualByCategory,
  topUnpreservedExtensions:[...residualExtensions.values()]
   .sort((a,b)=>b.bytes-a.bytes).slice(0,30),
  previouslyOmittedProtectedFilesNotRead:protectedFilesNotInR5,
  previouslyOmittedGeneratedFilesNotAssessed:generatedNotInR5,
  archivedFilesMissingFromOriginalLocalWorkingFolder:originalMissingButCloudArchived,
  r10ReparsePointPreviouslyObserved:true,
  nonQuizProjectsFullRecoveryVerified:false,
  signingKeysSecureVaultRestoreVerified:false,
  independentEncryptedFullBackupVerified:false,
  productionDeploymentVerified:false,
  originalSourceFilesUploadedThisRun:false,
  deleteClearance:false,
  interpretation:'R7 and R8 are exact private-cloud backups of listed source bytes, not clearance to delete other PC files. Residual files may be docs, binaries, caches or sensitive. Review privately before any additional upload.'
 };
 const out=path.join(dir,'BUKLOD_R9_SANITIZED_RECOVERY_RECONCILIATION.json');
 fs.writeFileSync(out,JSON.stringify(summary,null,2)+'\n',{mode:0o600,flag:'w'});
 console.log('R9: recovered paths='+recovered.size+'; original files still byte-identical='+
  recoveredFilesVerifiedUnchanged+'; remaining R5 detail entries='+residualFiles+'.');
 console.log('SAFE SUMMARY: '+out);
 console.log('NO DELETE CLEARANCE. Original laptop files never modified.');
}
main().catch(e=>{
 // Intentionally do not dump raw relative or absolute local filenames, tokens, or Git stderr.
 console.error('R9 FAILED CLOSED: A count, Git revision, SHA, or local-file verification guard failed.');
 process.exitCode=1;
});
