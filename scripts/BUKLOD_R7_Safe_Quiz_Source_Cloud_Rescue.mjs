#!/usr/bin/env node
// BUKLOD R7 — bounded, privacy-gated rescue of verified R5 local project sources.
// Only a new private GitHub branch is written. Original PC files remain READ-ONLY.
// Protected/unknown/generated files are never uploaded. No deletion clearance.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import https from 'node:https';
import {execFileSync} from 'node:child_process';

const R4_SHA='9cef155f2378fc77a46e20325259e81136525e45';
const PRIVATE_REPO='faust-0612/BUKLOD-Migrated-Sources';
const GITHUB_URL='https://github.com/'+PRIVATE_REPO+'.git';
const TARGET_BRANCH='migration/quiz-r7-local-source-recovery-20261107';
const DEST_PREFIX='systems/quiz/R7_LOCAL_SOURCE_RECOVERY';
const ALLOWED=new Set(['source_code','media_or_fonts','config_or_documents']);
const MAX_SINGLE_FILE=24*1024*1024;
const MAX_TOTAL_BYTES=600*1024*1024;
const MAX_FILES=26000;

function requireSafe(condition,reason){if(!condition)throw new Error(reason);}
function git(args,options={}){
  return execFileSync('git',args,{
    encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,
    stdio:['ignore','pipe','pipe'],...options
  }).toString().trim();
}
function csvRows(raw){
  raw=raw.replace(/^\uFEFF/,'');
  const output=[];let records=[],field='',inside=false;
  for(let i=0;i<raw.length;i++){
    const c=raw[i];
    if(inside){
      if(c==='"' && raw[i+1]==='"'){field+='"';i++;}
      else if(c==='"')inside=false;else field+=c;
    }else if(c==='"'){requireSafe(field==='','Malformed quoted CSV');inside=true;}
    else if(c===','){records.push(field);field='';}
    else if(c==='\n'){
      records.push(field.replace(/\r$/,''));field='';
      if(records.some(x=>x!==''))output.push(records);
      records=[];
    }else if(c!=='\r')field+=c;
  }
  requireSafe(!inside,'Unterminated CSV');
  if(field||records.length){records.push(field);output.push(records);}
  requireSafe(output.length>0,'Missing R5 CSV');
  const cols=output.shift();
  for(const required of ['candidate','kind','category','relative','bytes'])
    requireSafe(cols.includes(required),'R5 CSV missing a column');
  return output.map(row=>{
    requireSafe(row.length===cols.length,'Bad R5 CSV column count');
    return Object.fromEntries(cols.map((name,i)=>[name,row[i]]));
  });
}
function safeRelative(rel){
  requireSafe(typeof rel==='string'&&rel.length>0&&rel.length<8000,
              'Invalid relative path');
  requireSafe(!rel.includes('\\')&&!rel.includes(':')&&!rel.startsWith('/')&&
              !rel.split('/').some(x=>!x||x==='.'||x==='..'),
              'Refusing path traversal');
  return rel;
}
function looksProtectedName(rel){
  const p=rel.toLowerCase();
  return /(^|\/)\.env($|\.)/.test(p)||
    /(^|\/)(\.npmrc|\.pypirc|id_rsa|id_ed25519|credentials?|secrets?|keystores?|service[-_]?account|private[-_]?keys?|passwords?)(\/|\.|$)/.test(p)||
    /(\.jks|\.keystore|\.p12|\.pfx|\.pem|\.key|\.sqlite3?|\.db|\.kdbx|\.asc|\.mobileprovision|\.cer|\.p8)$/i.test(p)||
    /(^|\/)(google-services\.json|google-service-info\.plist|credentials\.json|auth\.json)$/.test(p);
}
function generatedPath(rel){
  const p=rel.toLowerCase();
  return /(^|\/)(node_modules|\.git|\.expo|\.gradle|\.next|\.cache|\.turbo|coverage|__pycache__|pods|\.venv|venv|vendor|dist|build|tmp|temp|out|\.buklod-smoke|\.buklod-android-smoke)(\/|$)/.test(p);
}
const secretTokens=[
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /(?:github_pat_|gh[pousr]_|xox[baprs]-)[a-z0-9_=-]{15,}/i,
  /(?:sb_secret_|sk_live_|sk_test_)[a-z0-9_=-]{12,}/i,
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{25,}/,
  /eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /"(?:private_key|client_secret|refresh_token)"\s*:\s*"(?!\*|PLACEHOLDER|REDACTED|YOUR_)[^"]{20,}"/i,
  /(?:^|[\s,;])(?:EXPO_TOKEN|VERCEL_TOKEN|SUPABASE_SERVICE_ROLE_KEY|DATABASE_PASSWORD|GITHUB_TOKEN)\s*[:=]\s*["']?(?!process\.env|import\.meta|YOUR_|REDACTED|PLACEHOLDER)[A-Za-z0-9._\-/+=]{20,}/im
];
function looksSecretInBuffer(data,category){
  if(category==='media_or_fonts')return false;
  if(data.includes(0))return true; // source/config must be text, not arbitrary binary.
  const text=data.toString('utf8');
  if(text.includes('\uFFFD'))return true;
  return secretTokens.some(rule=>rule.test(text));
}
function checksum(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function safeOriginalFile(root,relative){
  const r=path.resolve(root);
  const requested=path.resolve(r,...safeRelative(relative).split('/'));
  requireSafe(requested.toLowerCase().startsWith((r+path.sep).toLowerCase()),
              'Local file escaped the candidate root');
  const rootReal=fs.realpathSync.native(r);
  let next=r;
  for(const segment of relative.split('/')){
    next=path.join(next,segment);
    const l=fs.lstatSync(next);
    requireSafe(!l.isSymbolicLink(),'Symlink or junction in original path');
  }
  const actual=fs.realpathSync.native(requested);
  requireSafe(actual.toLowerCase().startsWith((rootReal+path.sep).toLowerCase()),
              'Original source resolves outside its root');
  requireSafe(fs.statSync(requested).isFile(),'Not a regular file');
  return requested;
}
async function privateRepoGuard(){
  const status=await new Promise((resolve,reject)=>{
    const req=https.get('https://api.github.com/repos/'+PRIVATE_REPO,{
      headers:{'User-Agent':'BUKLOD-R7-Private-Check','Accept':'application/vnd.github+json'},
      timeout:16000
    },res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
    req.on('timeout',()=>req.destroy(new Error('Privacy verification timed out')));
    req.on('error',reject);
  });
  // Private GitHub repo is 404 for anonymous browser, but reachable through git
  // credential manager. Never allow a public repository or ambiguous 403.
  requireSafe(status===404,'Private GitHub repository check failed; no upload permitted');
  const test=git(['ls-remote',GITHUB_URL,'HEAD']);
  requireSafe(/^[a-f0-9]{40}\s+HEAD$/m.test(test),
              'Authenticated access to private backup repo could not be confirmed');
}
function initRepo(dir,branch){
  git(['init','--quiet','--initial-branch',branch,dir]);
  git(['-C',dir,'config','core.autocrlf','false']);
  git(['-C',dir,'config','core.eol','lf']);
  git(['-C',dir,'config','core.longpaths','true']);
  git(['-C',dir,'config','user.name','BUKLOD Source Recovery']);
  git(['-C',dir,'config','user.email','recovery@buklod.invalid']);
  git(['-C',dir,'remote','add','origin',GITHUB_URL]);
}
function stageAndCommit(repoDir){
  git(['-C',repoDir,'add','-f','--all','--',DEST_PREFIX]);
  const staged=git(['-C',repoDir,'ls-files','-z']);
  return staged.split('\0').filter(Boolean).length;
}
function countByCategory(){
  return Object.fromEntries([...ALLOWED,'protected','unknown','generated','changed_since_audit',
    'unreadable','potential_secret','oversize','symlink_or_escape'].map(k=>[k,0]));
}
function sanitizeName(name){
  return name==='R10' || name==='BUILD';
}
function assertAudit(r4,r5,r6){
  requireSafe(r4.archiveCommit===R4_SHA&&r4.deleteClearance===false,
              'R4 archive or fail-closed guard changed');
  requireSafe(r5.schema==='buklod-quiz-cloud-diff-r5/v1'&&
    r5.archivedCommit===R4_SHA&&r5.deleteClearance===false,'Invalid R5 report');
  requireSafe(Array.isArray(r5.candidates)&&r5.candidates.length===2&&
    r5.candidates.every(x=>x.matchesPriorR4Counts===true&&sanitizeName(x.candidate)),
    'R5 counts were not reconciled to R4');
  requireSafe(r6.schema==='buklod-r6-exact-git-blob-parity/v1'&&
    r6.immutableR4Archive===R4_SHA&&r6.sourceCoverageComplete===true&&
    r6.totalReadErrors===0&&r6.deleteClearance===false,
    'R6 exact cloud content parity incomplete');
}
async function smokeTest(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-r7-fixture-'));
  try{
    for(const item of ['app/screen.tsx','src/lib/example.sql'])safeRelative(item);
    for(const bad of ['C:/private','../secret','.env/../bad','app\\test','/root','']){
      let denied=false;try{safeRelative(bad)}catch{denied=true;}
      requireSafe(denied,'Unsafe path was accepted');
    }
    for(const sensitive of ['.env.production','android/signing.jks','assets/secret/private.pem'])
      requireSafe(looksProtectedName(sensitive),'Protected filename was accepted');
    requireSafe(generatedPath('node_modules/pkg/src/index.ts')&&
      generatedPath('android/build/resources/file.xml'),'Generated path not classified');
    requireSafe(looksSecretInBuffer(Buffer.from('ghp_abcdefghijklmnopqrst123456'),'source_code'),
      'A known secret example was accepted');
    requireSafe(!looksSecretInBuffer(Buffer.from("const x = process.env.SUPABASE_SERVICE_ROLE_KEY;\n"),'source_code'),
      'Safe environment variable reference wrongly excluded');
    const row=csvRows('"candidate","kind","category","relative","bytes"\r\n'+
      '"BUILD","LOCAL_EXTRA","source_code","src/a,quoted""x.ts","23"\r\n');
    requireSafe(row[0].relative==='src/a,quoted"x.ts','Quoted Windows CSV failed');
    const dir=path.join(tmp,'stage');
    initRepo(dir,'migration/quiz-test');
    const a=path.join(dir,DEST_PREFIX,'BUILD','src','demo.ts');
    fs.mkdirSync(path.dirname(a),{recursive:true});
    fs.writeFileSync(a,'const banner = "safe";\n');
    const m=path.join(dir,DEST_PREFIX,'MANIFEST.json');
    fs.writeFileSync(m,JSON.stringify({files:1}));
    requireSafe(stageAndCommit(dir)===2,'Git stage did not preserve demo+manifest');
    git(['-C',dir,'commit','-q','-m','synthetic read-only backup test']);
    const bare=path.join(tmp,'remote.git');
    git(['init','--bare','-q',bare]);
    git(['-C',dir,'remote','set-url','origin',bare]);
    git(['-C',dir,'push','-q','origin','HEAD:refs/heads/migration/quiz-test']);
    const restore=path.join(tmp,'restored');
    git(['clone','-q','-c','core.autocrlf=false','-c','core.eol=lf',
      '--single-branch','--branch','migration/quiz-test',bare,restore]);
    const copy=path.join(restore,DEST_PREFIX,'BUILD','src','demo.ts');
    requireSafe(checksum(copy)===checksum(a),'Synthetic cloud restore SHA256 mismatch');
    console.log('BUKLOD R7 SELF-TEST PASSED: privacy filters, source scanning, CSV, synthetic branch push and full restore SHA256.');
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
async function main(){
  const args=process.argv.slice(2);
  if(args.includes('--self-test'))return smokeTest();
  const pos=args.indexOf('--r4');
  requireSafe(pos>=0&&pos+1<args.length&&args.includes('--backup'),
              'Use: node script.mjs --r4 FULL_R4_REPORT_PATH --backup');
  const dir=path.dirname(path.resolve(args[pos+1]));
  const r4=JSON.parse(fs.readFileSync(path.join(dir,'BUKLOD_R4_Direct_Report.json'),'utf8').replace(/^\uFEFF/,''));
  const r5=JSON.parse(fs.readFileSync(path.join(dir,'BUKLOD_R5_Sanitized_Summary.json'),'utf8').replace(/^\uFEFF/,''));
  const r6=JSON.parse(fs.readFileSync(path.join(dir,'BUKLOD_R6_Sanitized_Cloud_Content_Parity.json'),'utf8').replace(/^\uFEFF/,''));
  assertAudit(r4,r5,r6);
  const rows=csvRows(fs.readFileSync(path.join(dir,'BUKLOD_R5_LOCAL_PRIVATE_DETAILS.csv'),'utf8'));
  const candidates=new Map(r5.candidates.map(c=>[c.candidate,c]));
  requireSafe(rows.length>=15770,'Local R5 detailed list unexpectedly incomplete');
  const branch=TARGET_BRANCH;
  console.log('Checking private GitHub destination and existing branch before copying local source...');
  await privateRepoGuard();
  const exists=git(['ls-remote','--heads',GITHUB_URL,'refs/heads/'+branch]);
  requireSafe(exists.length===0,'R7 destination branch already exists; refusing overwrite or duplicate push.');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-r7-verified-upload-'));
  let completed=false;
  const counted=countByCategory();
  const files=[],details={};
  let stagedBytes=0, considered=0;
  try{
    const work=path.join(temp,'git');
    initRepo(work,branch);
    for(const row of rows){
      requireSafe(candidates.has(row.candidate),'Unexpected candidate in R5 CSV');
      requireSafe(['LOCAL_EXTRA','CHANGED_ARCHIVED_FILE','MISSING_LOCALLY_BUT_IN_CLOUD'].includes(row.kind),
                  'Unexpected R5 file kind');
      if(row.kind==='MISSING_LOCALLY_BUT_IN_CLOUD')continue;
      considered++;
      if(considered>MAX_FILES)throw new Error('Maximum R7 file scan bound exceeded');
      const rel=safeRelative(row.relative);
      if(looksProtectedName(rel)){counted.protected++;continue;}
      if(generatedPath(rel)){counted.generated++;continue;}
      if(!ALLOWED.has(row.category)){counted.unknown++;continue;}
      const originalBytes=Number(row.bytes);
      if(!Number.isSafeInteger(originalBytes)||originalBytes<0){counted.unreadable++;continue;}
      if(originalBytes>MAX_SINGLE_FILE){counted.oversize++;continue;}
      const originalRoot=candidates.get(row.candidate).localRoot;
      let original;
      try{original=safeOriginalFile(originalRoot,rel);}
      catch{counted.symlink_or_escape++;continue;}
      try{
        const before=fs.statSync(original);
        if(before.size!==originalBytes){counted.changed_since_audit++;continue;}
        const bytes=fs.readFileSync(original);
        if(looksSecretInBuffer(bytes,row.category)){counted.potential_secret++;continue;}
        const changed=fs.statSync(original);
        if(changed.size!==before.size||changed.mtimeMs!==before.mtimeMs){
          counted.changed_since_audit++;continue;
        }
        const destRelative=[DEST_PREFIX,row.candidate,...rel.split('/')].join('/');
        const dest=path.join(work,...destRelative.split('/'));
        fs.mkdirSync(path.dirname(dest),{recursive:true});
        fs.writeFileSync(dest,bytes,{flag:'wx'});
        const final=fs.statSync(dest);
        const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
        if(final.size!==originalBytes||checksum(dest)!==sha256){
          throw new Error('Destination checksum mismatch; abort');
        }
        stagedBytes+=bytes.length;
        if(stagedBytes>MAX_TOTAL_BYTES)throw new Error('Upload budget exceeded; abort');
        files.push({path:destRelative,sha256,bytes:bytes.length,originalKind:row.kind});
        counted[row.category]++;
      }catch(err){
        if(err instanceof Error && (/Destination checksum mismatch|Upload budget exceeded/.test(err.message)))
          throw err;
        counted.unreadable++;
      }
    }
    requireSafe(files.length>0,'No safe project files qualify for upload');
    files.sort((a,b)=>a.path.localeCompare(b.path));
    const manifest={
      schema:'buklod-r7-source-rescue/v1',
      recoveryFromR4:R4_SHA, createdUtc:new Date().toISOString(),
      sourceR5Schema:r5.schema,sourceR6Schema:r6.schema,
      candidateFilesIncluded:files.length,
      bytesStaged:stagedBytes,
      excludedByCategory:counted,
      privateRepo:PRIVATE_REPO,targetBranch:branch,
      files,
      noOriginalsModified:true,protectedOrUnknownFilesNotUploaded:true,
      fullBackupCertified:false,deleteClearance:false
    };
    const manifestPath=path.join(work,DEST_PREFIX,'RECOVERY_MANIFEST.json');
    fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
    const readmePath=path.join(work,DEST_PREFIX,'README.md');
    fs.writeFileSync(readmePath,
      '# BUKLOD Quiz R7 extra source rescue\n\n'+
      'Read-only copy of R5 candidate project source/assets/config not included in the two older Quiz manifests. '+
      'Unknown binary/generated files and all detected secrets were excluded. '+
      'Each file has a SHA-256 digest in RECOVERY_MANIFEST.json. '+
      'This is a private recovery branch, not release-ready code. '+
      'NO LOCAL DELETION CLEARANCE.\n');
    const expectedIndex=files.length+2;
    requireSafe(stageAndCommit(work)===expectedIndex,
                'Git staged file count does not match verified R7 manifest');
    git(['-C',work,'commit','-q','-m','recovery(quiz): preserve sanitized unmatched local source from R4/R5/R6']);
    const head=git(['-C',work,'rev-parse','HEAD']);
    console.log('R7: '+files.length+' non-protected files staged ('+stagedBytes+' bytes). Uploading one new PRIVATE recovery branch...');
    git(['-C',work,'push','--quiet','--set-upstream','origin','HEAD:refs/heads/'+branch],{timeout:300000});
    const remote=git(['ls-remote','--heads',GITHUB_URL,'refs/heads/'+branch]);
    requireSafe(remote.startsWith(head+'\t'),'Remote branch SHA mismatch after push');
    console.log('R7: private GitHub branch verified. Testing fresh cloud recovery...');
    const restored=path.join(temp,'restore');
    git(['clone','--quiet','-c','core.autocrlf=false','-c','core.eol=lf',
      '--depth','1','--single-branch','--branch',branch,GITHUB_URL,restored],
      {timeout:300000});
    requireSafe(git(['-C',restored,'rev-parse','HEAD'])===head,
                'Restored cloud branch commit differs from uploaded commit');
    for(const item of files){
      const filepath=path.join(restored,...item.path.split('/'));
      requireSafe(fs.statSync(filepath).size===item.bytes &&
        checksum(filepath)===item.sha256,
        'Fresh cloud restore file did not match its manifest; no deletion clearance');
    }
    const restoredManifest=JSON.parse(fs.readFileSync(path.join(restored,DEST_PREFIX,'RECOVERY_MANIFEST.json'),'utf8'));
    requireSafe(restoredManifest.files.length===files.length &&
      restoredManifest.bytesStaged===stagedBytes,'Fresh restore manifest mismatch');
    completed=true;
    const sanitized={
      schema:'buklod-r7-sanitized-rescue/v1',
      timestampUtc:new Date().toISOString(),
      destinationPrivateRepoVerified:true,
      branch,commit:head,sourceCommit:R4_SHA,
      stagedFiles:files.length,stagedBytes,countsBySafetyCategory:counted,
      filesSkippedTotal:considered-files.length,
      freshIndependentCloudCloneVerified:true,
      allRestoredSha256Verified:true,
      rawProtectedFilesUploaded:false,
      unclassifiedAndGeneratedFilesExcluded:true,
      noOriginalPCFilesChanged:true,
      sevenKnownProtectedFilesStillRequireSeparateVault:true,
      fullPcBackupCertified:false,deleteClearance:false
    };
    const save=path.join(dir,'BUKLOD_R7_SANITIZED_CLOUD_SOURCE_RECOVERY.json');
    fs.writeFileSync(save,JSON.stringify(sanitized,null,2)+'\n');
    console.log('R7 VERIFIED private cloud recovery: '+files.length+' files restored with exact SHA-256.');
    console.log('SHARE THIS SANITIZED REPORT: '+save);
    console.log('NO DELETE CLEARANCE. Local originals, protected data and unknown artifacts remain.');
  }finally{
    // Only this tool's newly created temp staging and test clone, NEVER originals.
    fs.rmSync(temp,{recursive:true,force:true});
    if(!completed)console.log('R7 was not fully verified; original files remain untouched.');
  }
}
main().catch(err=>{
  const message=err instanceof Error?err.message:'Unknown failure';
  // Do not print git auth stderr, absolute source paths or protected filenames.
  const safe=/^(?:Use:|R4 |R5 |R6 |Invalid |Bad |Unexpected |Maximum |No safe|Git staged|Destination checksum|Upload budget|Private GitHub|Authenticated access|R7 destination|Remote branch|Restored cloud|Fresh cloud|Original source|Local file escaped|Symlink or junction|Not a regular file)/.test(message);
  console.error('R7 FAIL CLOSED: '+(safe?message:'Safety or verification error. No local originals were deleted.'));
  process.exitCode=1;
});
