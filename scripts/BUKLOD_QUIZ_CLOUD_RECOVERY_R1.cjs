'use strict';
// BUKLOD QUIZ: one-time canonical source recovery (read-only on original).
// Usage: node BUKLOD_QUIZ_CLOUD_RECOVERY_R1.cjs             (preflight only)
//        node BUKLOD_QUIZ_CLOUD_RECOVERY_R1.cjs --push      (cloud upload)
// Preconditions: Git and GitHub credential for the private recovery repo.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');

const explicitSourceDir = process.env.BUKLOD_QUIZ_SOURCE_DIR;
let sourceRoot = '';

const remote = 'https://github.com/faust-0612/BUKLOD-Migrated-Sources.git';
const branch = 'migration/quiz-canonical-source-20261107';
const target = path.join('systems','quiz','BUKLOD_Quiz_Standalone_CANONICAL');
const required = ['package.json','app/exam.tsx','app/live-join.tsx'];
const supabasePaths = ['lib/supabase.ts','src/lib/supabase.ts'];
const supportingPaths = ['app/review.tsx','lib/quizSecureLocal.ts',
  'src/lib/quizSecureLocal.ts','lib/buklodQuizWebFetch.ts',
  'src/lib/buklodQuizWebFetch.ts'];

const excludedDirs = new Set(['.git','node_modules','.expo','.gradle',
  '.cache','.next','.turbo','.buklod-backups','.eas','.idea','.vscode',
  'dist','build','coverage','Pods','tmp','temp','logs']);
const bannedExt = /\.(?:apk|aab|ipa|7z|zip|tar|tgz|gz|keystore|jks|p12|p8|pem|key|sqlite|db|log|map)$/i;
const bannedNames = /^(?:\.env(?:\..*)?|\.npmrc|local\.properties|google-services\.json|GoogleService-Info\.plist|credentials(?:\..*)?|service-account(?:\..*)?|\.DS_Store)$/i;
const secretPatterns = [
  /\bsb_secret_[A-Za-z0-9_-]{16,}/,
  /\b(?:ghp_|gho_|ghu_|ghs_|github_pat_)[A-Za-z0-9_]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{12,}/,
  /\b(?:SUPABASE_SERVICE_ROLE_KEY|EXPO_TOKEN|EAS_ACCESS_TOKEN)\b\s*[:=]\s*['"][A-Za-z0-9._-]{25,}['"]/i,
];
const maxFileBytes = 50*1024*1024;
const maxTotalBytes = 250*1024*1024;

function git(cwd, args, capture=false) {
  return execFileSync('git',args,{cwd,encoding:'utf8',stdio:capture?'pipe':'inherit',timeout:120000});
}
function isExcluded(relative,isDirectory) {
  const segments=relative.split(path.sep);
  if (segments.some(s=>excludedDirs.has(s))) return true;
  const base=segments[segments.length-1];
  if (bannedNames.test(base)) return true;
  if (!isDirectory && bannedExt.test(base)) return true;
  return false;
}
function present(file) {
  try {return fs.statSync(file).isFile();} catch {return false;}
}
function isActualDir(file) {
  try {return fs.lstatSync(file).isDirectory() && !fs.lstatSync(file).isSymbolicLink();}
  catch {return false;}
}
function inspectCandidate(root) {
  const presentRequired=required.filter(rel=>present(path.join(root,...rel.split('/'))));
  const presentSupabase=supabasePaths.filter(rel=>present(path.join(root,...rel.split('/'))));
  const presentSupporting=supportingPaths.filter(rel=>present(path.join(root,...rel.split('/'))));
  let packageValid=false, quizScreenMarkers=false;
  if(presentRequired.includes('package.json')) {
    try {
      const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
      packageValid=!!((pkg.dependencies?.expo||pkg.devDependencies?.expo) &&
        (pkg.dependencies?.['@supabase/supabase-js']||pkg.devDependencies?.['@supabase/supabase-js']));
    } catch {packageValid=false;}
  }
  if(presentRequired.includes('app/exam.tsx')&&presentRequired.includes('app/live-join.tsx')){
    try{
      const exam=fs.readFileSync(path.join(root,'app','exam.tsx'),'utf8').slice(0,1000000);
      const join=fs.readFileSync(path.join(root,'app','live-join.tsx'),'utf8').slice(0,1000000);
      quizScreenMarkers=/buklod_quiz/i.test(exam)&&/buklod_quiz/i.test(join);
    }catch {quizScreenMarkers=false;}
  }
  return {
    root,presentRequired,presentSupabase,presentSupporting,packageValid,quizScreenMarkers,
    complete:presentRequired.length===required.length &&
      presentSupabase.length>0 && packageValid && quizScreenMarkers,
    score:presentRequired.length*8+presentSupabase.length*3+
      presentSupporting.length+Number(packageValid)*4+Number(quizScreenMarkers)*4,
  };
}
function knownSourcePaths() {
  const home=os.homedir();
  return [
    path.join(home,'Downloads','BUKLOD_Quiz_Standalone'),
    path.join(home,'OneDrive','Documents','ChatGPT','BUKLOD_Quiz_Standalone'),
    'C:\\BUKLODQ_BUILD\\project','C:\\BUKLODQ_BUILD_R126\\project',
    'C:\\BUKLODQ_R10_BUILD\\project','C:\\BUKLODQ_R10_BUILD',
    'D:\\Download\\BUKLOD_Quiz_Standalone',
    'D:\\Downloads\\BUKLOD_Quiz_Standalone',
    'D:\\BUKLOD_DATA\\BUKLOD_Quiz_Standalone',
    path.join(home,'Downloads','BUKLOD_Production_Starter_v16','BUKLOD_Production_Starter_v16'),
  ];
}
function searchBases() {
  const home=os.homedir();
  return [
    path.join(home,'Downloads'),
    path.join(home,'Documents'),
    path.join(home,'Desktop'),
    path.join(home,'OneDrive','Documents','ChatGPT'),
    'C:\\BUKLODQ_BUILD','C:\\BUKLODQ_BUILD_R126','C:\\BUKLODQ_R10_BUILD',
    'C:\\BUKLODQ_TOOLS','D:\\Download','D:\\Downloads','D:\\BUKLOD_DATA',
  ];
}
function discoverSource() {
  if(explicitSourceDir) {
    const root=path.resolve(explicitSourceDir);
    const c=inspectCandidate(root);
    if(!c.complete) throw Error('Explicit BUKLOD_QUIZ_SOURCE_DIR is not a verified Quiz project: '+
      root+' (package/exam/live/supabase/Expo/Quiz RPC checks failed).');
    process.stdout.write('EXPLICIT CANONICAL SOURCE VERIFIED: '+root+'\n');
    return root;
  }
  const seen=new Set(),candidates=[];
  function consider(dir) {
    if(!isActualDir(dir)) return;
    const resolved=path.resolve(dir), key=process.platform==='win32'?resolved.toLowerCase():resolved;
    if(seen.has(key)) return;
    seen.add(key);
    const c=inspectCandidate(resolved);
    if(c.score>0)candidates.push(c);
  }
  for(const dir of knownSourcePaths())consider(dir);
  const queue=searchBases().filter(isActualDir).map(dir=>({dir,depth:0}));
  let visited=0;
  while(queue.length && visited<2400) {
    const {dir,depth}=queue.shift();
    if(!isActualDir(dir))continue;
    ++visited;
    consider(dir);
    if(depth>=3)continue;
    let entries;
    try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{continue;}
    const children=entries.filter(ent=>ent.isDirectory()&&!ent.isSymbolicLink() &&
      !isExcluded(ent.name,true));
    // Search recognizable project folders first, even in crowded Downloads.
    children.sort((a,b)=>Number(/quiz|buklod|project|source|standalone/i.test(b.name))-
      Number(/quiz|buklod|project|source|standalone/i.test(a.name)));
    for(const ent of children.slice(0,450)) {
      // At depth 2+, avoid crawling unrelated nested backups.
      if(depth>=2&&!/quiz|buklod|project|backup|source|app|web|standalone|r\d+/i.test(ent.name))continue;
      queue.push({dir:path.join(dir,ent.name),depth:depth+1});
    }
  }
  candidates.sort((a,b)=>Number(b.complete)-Number(a.complete)||b.score-a.score);
  const complete=candidates.filter(c=>c.complete);
  process.stdout.write('QUIZ SOURCE DISCOVERY: searched '+seen.size+
    ' directories in bounded known locations, strong='+complete.length+'\n');
  for(const c of candidates.slice(0,16)) {
    process.stdout.write((c.complete?'VERIFIED ':'PARTIAL  ')+' | '+c.root+
      ' | required='+c.presentRequired.join(',')+
      ' | supabase='+c.presentSupabase.join(',')+
      ' | Quiz RPC='+c.quizScreenMarkers+
      ' | Expo manifest='+c.packageValid+'\n');
  }
  if(complete.length===1)return complete[0].root;
  if(complete.length>1)throw Error('Multiple verified Quiz sources found. Do not choose an outdated copy. Set BUKLOD_QUIZ_SOURCE_DIR to the authoritative root and rerun.');
  throw Error('No verified standalone Quiz source in known folders. The Main app is not a substitute. Check moved source/backup folders; set BUKLOD_QUIZ_SOURCE_DIR to actual project root. No upload attempted.');
}
function scanFiles() {
  const candidate=inspectCandidate(sourceRoot);
  if(!candidate.complete) throw Error('NOT CANONICAL QUIZ: source fingerprint is incomplete (package/exam/live/supabase/Expo/Quiz RPC).');
  const result=[];
  let total=0;
  function visit(directory, relDir) {
    for(const ent of fs.readdirSync(directory,{withFileTypes:true})) {
      const rel=path.join(relDir,ent.name);
      if(isExcluded(rel,ent.isDirectory())) continue;
      if(ent.isSymbolicLink()) throw Error('Symlink requires manual review: '+rel);
      if(ent.isDirectory()) {visit(path.join(directory,ent.name),rel);continue;}
      if(!ent.isFile()) continue;
      const abs=path.join(directory,ent.name);
      const stat=fs.statSync(abs);
      if(stat.size>maxFileBytes) throw Error('Large source file requires review: '+rel);
      total+=stat.size;
      if(total>maxTotalBytes||result.length>30000) throw Error('Source size/file-count safety gate exceeded');
      const buf=fs.readFileSync(abs);
      if(buf.indexOf(0)===-1) {
        const str=buf.toString('utf8');
        if(secretPatterns.some(pattern=>pattern.test(str))) {
          throw Error('Possible hardcoded secret; cloud push refused. Review: '+rel);
        }
      }
      result.push({rel:rel.split(path.sep).join('/'),bytes:stat.size,sha256:crypto.createHash('sha256').update(buf).digest('hex')});
    }
  }
  visit(sourceRoot,'');
  result.sort((a,b)=>a.rel.localeCompare(b.rel));
  for(const req of required) if(!result.some(x=>x.rel===req)) {
    throw Error('Required canonical code was excluded: '+req);
  }
  if(!supabasePaths.some(req=>result.some(x=>x.rel===req)))
    throw Error('Quiz Supabase client source was excluded');
  return {files:result,total};
}
async function main() {
  const push=process.argv.slice(2).includes('--push');
  if(process.argv.slice(2).some(a=>a!=='--push')) throw Error('Unknown argument; only --push accepted');
  sourceRoot=discoverSource();
  const {files,total}=scanFiles();
  process.stdout.write('CANONICAL QUIZ SOURCE CHECK PASSED; files='+files.length+
    ' bytes='+total+'; source='+sourceRoot+'\n');
  if(!push) {
    process.stdout.write('PREVIEW ONLY. No files copied or pushed. Add --push for upload.\n');
    return;
  }
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'buklod-quiz-cloud-'));
  try {
    git(process.cwd(),['clone','--single-branch','--depth','1','--branch',branch,remote,work]);
    const dest=path.join(work,target);
    fs.rmSync(dest,{recursive:true,force:true});
    fs.mkdirSync(dest,{recursive:true});
    for(const item of files) {
      const to=path.join(dest,...item.rel.split('/'));
      fs.mkdirSync(path.dirname(to),{recursive:true});
      fs.copyFileSync(path.join(sourceRoot,...item.rel.split('/')),to);
      const verify=crypto.createHash('sha256').update(fs.readFileSync(to)).digest('hex');
      if(verify!==item.sha256) throw Error('Copy checksum mismatch: '+item.rel);
    }
    const manifest={kind:'BUKLOD_QUIZ_CANONICAL_SOURCE',schema_version:1,
      source_basename:path.basename(sourceRoot),file_count:files.length,total_bytes:total,
      files:files,generated_at:new Date().toISOString()};
    fs.writeFileSync(path.join(dest,'QUIZ_RECOVERY_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
    git(work,['add','--',target]);
    git(work,['diff','--cached','--check']);
    const staged=git(work,['diff','--cached','--name-only'],true).trim();
    if(!staged) {
      process.stdout.write('CLOUD ALREADY UP-TO-DATE; no new commit needed.\n');
    } else {
      git(work,['commit','-m','archive(quiz): recover verified standalone exam source']);
      git(work,['push','origin','HEAD:refs/heads/'+branch]);
    }
    const local=git(work,['rev-parse','HEAD'],true).trim();
    const remoteSha=git(work,['ls-remote','origin','refs/heads/'+branch],true).trim().split(/\s+/)[0];
    if(local!==remoteSha) throw Error('Remote SHA mismatch: do not delete local Quiz source');
    process.stdout.write('CLOUD PUSH VERIFIED; commit='+local+' files='+files.length+
      ' bytes='+total+'\n'+'https://github.com/faust-0612/BUKLOD-Migrated-Sources/tree/'+branch+
      '/systems/quiz/BUKLOD_Quiz_Standalone_CANONICAL\n');
    process.stdout.write('NOTE: This verifies source upload only. Do NOT delete local data until runtime, assets, config and deployment parity are audited.\n');
  } finally {
    fs.rmSync(work,{recursive:true,force:true,maxRetries:3,retryDelay:250});
  }
}
main().catch(e=>{console.error('BLOCKER:',e.message);process.exitCode=1;});
