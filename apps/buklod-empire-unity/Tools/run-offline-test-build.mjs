// Explicit local-only offline test build. Never publishes, installs or enables paid CI.
import {existsSync, mkdirSync, openSync, closeSync, unlinkSync, readdirSync, statSync, readFileSync, writeFileSync, renameSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {heroPipelineHash} from './hero-pipeline-hash.mjs';
import {runLogged} from './run-logged-unity.mjs';
const project=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
const usage='Usage: node Tools/run-offline-test-build.mjs --prepare | --source-preflight | --validate|--build|--resume|--candidate <absolute Unity executable> <absolute Android build-tools directory>';
if(!((args.length===1&&['--prepare','--source-preflight'].includes(args[0]))||(args.length===3&&['--build','--resume','--validate','--candidate'].includes(args[0]))))throw Error(usage);
const sourcePreflight=args[0]==='--source-preflight',validate=args[0]==='--validate',candidate=args[0]==='--candidate',resume=validate||candidate||args[0]==='--resume',build=candidate||args[0]==='--resume'||args[0]==='--build',unity=args[1],sdk=args[2];
let sourceRevision=null;
if(build||validate){
 if(!isAbsolute(unity)||!isAbsolute(sdk)||!existsSync(unity)||!statSync(unity).isFile()||!existsSync(sdk)||!statSync(sdk).isDirectory())throw Error(usage);
 for(const path of [join(sdk,process.platform==='win32'?'aapt.exe':'aapt'),join(sdk,'lib','apksigner.jar')])if(!existsSync(path))throw Error('Missing Android build tool: '+path);
 const version=readFileSync(join(project,'ProjectSettings/ProjectVersion.txt'),'utf8');
 if(!/^m_EditorVersion:\s*6000\.3\.29f1\s*$/m.test(version))throw Error('Unexpected Unity project version');
}
// Owner now prioritizes offline only. Keep packaging locked until consolidated
// offline QA; explicit diagnostic opt-in is not release approval.
if(build&&process.env.BUKLOD_ALLOW_OFFLINE_DIAGNOSTIC!=='1')
 throw Error('Explicit local diagnostic opt-in required. No build started.');
if(candidate){
 sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8'}).trim();
 if(!/^[a-f0-9]{40}$/.test(sourceRevision))throw Error('Candidate source revision unavailable');
 const dirty=execFileSync('git',['status','--porcelain','--untracked-files=no','--','.','../../scripts/generate-buklod-empire-hero-glbs.py'],{cwd:project,encoding:'utf8'}).trim();
 if(dirty)throw Error('Candidate requires clean tracked Empire sources; preserve local changes before building.');
 console.log('LOCAL OFFLINE CANDIDATE: Unity EditMode deferred by explicit owner choice. No release/device approval. Source '+sourceRevision);
}
if(build){
 const embeddedJava=resolve(unity,'..','Data','PlaybackEngines','AndroidPlayer','OpenJDK');
 if(existsSync(join(embeddedJava,'bin',process.platform==='win32'?'java.exe':'java')))process.env.JAVA_HOME=embeddedJava;
}
const root=join(project,'Builds','OfflineReview');
mkdirSync(root,{recursive:true});
const lock=join(root,'.local-build.lock');
const fd=openSync(lock,'wx');
const run=(cmd,argv)=>{const r=spawnSync(cmd,argv,{cwd:project,stdio:'inherit',shell:false,env:{...process.env,PYTHONOPTIMIZE:''}});if(r.error)throw r.error;if(r.status!==0)throw Error('Stage failed: '+cmd+' ('+r.status+')');};
try{
 if(!sourcePreflight)run(process.execPath,['Tools/verify-authored-review-assets.mjs']);
 // Refresh only outdated hero groups. Existing 11-group asset receipt is still
 // independently verified; never regenerate unrelated environment/audio assets.
 let prepareArgs=resume?['--verify']:[];
 if(resume){
  const output=join(project,'Tools','ReviewOutput');
  const path=join(output,'heroes','manifest.json');
  let manifest=null;
  if(existsSync(path)){try{manifest=JSON.parse(readFileSync(path,'utf8'));}catch(error){if(!(error instanceof SyntaxError))throw error;}}
  const pipeline=heroPipelineHash(project);
  if(!Array.isArray(manifest?.heroes)||manifest.heroes.length!==13||manifest.heroes.some(h=>!h||h.geometryRevision!=='original-sculpted-geometry-v10'||h.textureResolution!==1024||h.sourcePipelineSha256!==pipeline)||existsSync(join(output,'.hero-refresh-incomplete')))prepareArgs=['--refresh-heroes'];
  else{
   // A crash or stale derivative cannot mix geometry generations.
   const hashes=new Map(manifest.heroes.map(h=>[h.id,h.sha256]));
   for(const [folder,key,id] of [['hero-lod','heroes','id'],['variants','variants','hero']]){
    try{
     const rows=JSON.parse(readFileSync(join(output,folder,'manifest.json'),'utf8'))[key];
     if(!Array.isArray(rows)||rows.length!==(folder==='hero-lod'?13:39)||rows.some(r=>!hashes.has(r[id])||r.sourceSha256!==hashes.get(r[id])))prepareArgs=['--refresh-heroes'];
    }catch{prepareArgs=['--refresh-heroes'];}
   }
  }
 }
 run(process.execPath,['Tools/test-hero-skin.mjs']);
 run(process.env.PYTHON||'python3',['Tools/test_joint_geometry.py']);
 run(process.env.PYTHON||'python3',['Tools/test_sculpt_geometry.py']);
 run(process.env.PYTHON||'python3',['Tools/smoke-hero-geometry.py']);
 if(sourcePreflight){
  run(process.env.PYTHON||'python3',['Tools/test_premium_surfaces.py']);
  console.log('BUKLOD_SOURCE_PREFLIGHT_PASS — geometry/skill smoke and fixtures only; no Unity, assets generated in release cache, APK, or production approval.');
 }else{
 run(process.execPath,['Tools/prepare-offline-review.mjs',...prepareArgs]);
 if(build||validate){
  // Local-only larger asset acquisition; do not consume Unity Cloud allowance.
  // Run independent pure-Python checks before any network acquisition.
  run(process.env.PYTHON||'python3',['Tools/test_premium_surfaces.py']);
  run(process.env.PYTHON||'python3',['Tools/acquire-authored-expansion.py']);
  process.env.BUKLOD_AUTHORED_EXPANSION='1';
  run(process.env.PYTHON||'python3',['Tools/acquire-premium-surfaces.py']);
  process.env.BUKLOD_PREMIUM_SURFACES='1';
  run(process.env.PYTHON||'python3',['Tools/prepare-hero-voice.py']);
  // Only the explicit, isolated candidate command defers the separate EditMode pass.
  // Normal validation and ordinary diagnostic build routes retain the full test gate.
  if(!candidate){
  const stamp=Date.now(),tests=join(root,'editmode-'+stamp+'.xml'),testLog=join(root,'editmode-'+stamp+'.log');
  console.log('Unity EditMode test log: '+testLog);
  try{
   await runLogged(unity,['-batchmode','-projectPath',project,'-buildTarget','Android','-runTests','-testPlatform','EditMode','-assemblyNames','Buklod.Empire.Tests','-testResults',tests,'-logFile',testLog],{cwd:project,log:testLog,label:'Unity EditMode'});
   run(process.env.PYTHON||'python3',['Tools/verify-unity-editmode.py',tests]);
  }catch(error){if(existsSync(testLog))console.error(readFileSync(testLog,'utf8').split(/\r?\n/).slice(-100).join('\n'));throw error;}
  }else console.log('EditMode tests DEFERRED — no test pass claimed. Proceeding with isolated Unity compile/import/build gates.');
  const before=new Set(readdirSync(root));
  const log=join(root,'unity-'+Date.now()+'.log');
  console.log('Unity build log: '+log);
  try{await runLogged(unity,['-batchmode','-quit','-projectPath',project,'-buildTarget','Android','-executeMethod',(validate?'Buklod.Empire.Editor.OfflineReviewBuildBootstrap.ValidateOnly':'Buklod.Empire.Editor.OfflineReviewBuildBootstrap.Build'),'-logFile',log],{cwd:project,log,label:validate?'Unity scene preflight':'Unity APK build',idleMs:build?30*60*1000:15*60*1000,hardMs:build?180*60*1000:90*60*1000});}catch(error){if(existsSync(log))console.error(readFileSync(log,'utf8').split(/\r?\n/).slice(-100).join('\n'));throw error;}
  if(validate){
   if(!readFileSync(log,'utf8').includes('BUKLOD_OFFLINE_PREFLIGHT_PASS'))throw Error('Missing Unity preflight completion marker');
   if(readdirSync(root).some(x=>!before.has(x)&&x.endsWith('.apk')))throw Error('Unexpected APK during validate-only');
   console.log('Local Unity import and motion preflight passed; no APK generated.');
  }else{
  const apks=readdirSync(root).filter(x=>!before.has(x)&&x.endsWith('.apk'));
  if(apks.length!==1)throw Error('Expected exactly one new APK; inspect '+log);
  const apk=join(root,apks[0]);
  run(process.execPath,['Tools/verify-offline-test-apk.mjs',apk,sdk]);
  const receipt=JSON.parse(readFileSync(apk+'.verified.json','utf8'));
  if(receipt.status!=='VERIFIED_ISOLATED_TEST_ARTIFACT'||receipt.productionApproved!==false||receipt.deviceVerified!==false)throw Error('Unexpected verification receipt');
  if(candidate){
   const metadata={status:'OFFLINE_BUILD_CANDIDATE_ONLY',sourceRevision,package:receipt.package,apk:apks[0],sha256:receipt.sha256,bytes:receipt.bytes,artifactSignatureVerified:true,editModeVerified:false,deviceVerified:false,visualQualityVerified:false,onlineEnabled:false,productionApproved:false};
   const path=apk+'.candidate.json';writeFileSync(path+'.tmp',JSON.stringify(metadata,null,2)+'\n');renameSync(path+'.tmp',path);
   console.log('BUKLOD_OFFLINE_CANDIDATE_APK_BUILT — signature/package verified; EditMode and device acceptance deferred.');
  }
  console.log('Isolated offline test artifact only: '+apk);
  }
 }else console.log('Review assets prepared only; no APK or Unity acceptance.');
 }
}finally{closeSync(fd);unlinkSync(lock);}
