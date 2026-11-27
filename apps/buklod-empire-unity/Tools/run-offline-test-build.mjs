// Explicit local-only offline test build. Never publishes, installs or enables paid CI.
import {existsSync, mkdirSync, openSync, closeSync, unlinkSync, readdirSync, statSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {heroPipelineHash} from './hero-pipeline-hash.mjs';
import {createHash} from 'node:crypto';
const project=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
const usage='Usage: node Tools/run-offline-test-build.mjs --prepare | --source-preflight | --validate|--build|--resume <absolute Unity executable> <absolute Android build-tools directory>';
if(!((args.length===1&&['--prepare','--source-preflight'].includes(args[0]))||(args.length===3&&['--build','--resume','--validate'].includes(args[0]))))throw Error(usage);
const sourcePreflight=args[0]==='--source-preflight',validate=args[0]==='--validate', resume=validate||args[0]==='--resume', build=args[0]==='--resume'||args[0]==='--build', unity=args[1], sdk=args[2];
if(build||validate){
 if(!isAbsolute(unity)||!isAbsolute(sdk)||!existsSync(unity)||!statSync(unity).isFile()||!existsSync(sdk)||!statSync(sdk).isDirectory())throw Error(usage);
 for(const path of [join(sdk,process.platform==='win32'?'aapt.exe':'aapt'),join(sdk,'lib','apksigner.jar')])if(!existsSync(path))throw Error('Missing Android build tool: '+path);
 const version=readFileSync(join(project,'ProjectSettings/ProjectVersion.txt'),'utf8');
 if(!/^m_EditorVersion:\s*6000\.3\.29f1\s*$/m.test(version))throw Error('Unexpected Unity project version');
}
// Owner now prioritizes offline only. Keep packaging locked until consolidated
// offline QA; explicit diagnostic opt-in is not release approval.
if(build&&process.env.BUKLOD_ALLOW_OFFLINE_DIAGNOSTIC!=='1')
 throw Error('Offline-only APK packaging is held until consolidated offline QA. No build started.');
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
  if(!Array.isArray(manifest?.heroes)||manifest.heroes.length!==13||manifest.heroes.some(h=>!h||h.geometryRevision!=='original-sculpted-geometry-v10'||h.sourcePipelineSha256!==pipeline)||existsSync(join(output,'.hero-refresh-incomplete')))prepareArgs=['--refresh-heroes'];
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
 run(process.execPath,['Tools/test-wildlife-motion.mjs']);
 run(process.env.PYTHON||'python3',['Tools/test_joint_geometry.py']);
 run(process.env.PYTHON||'python3',['Tools/test_sculpt_geometry.py']);
 run(process.env.PYTHON||'python3',['Tools/smoke-hero-geometry.py']);
 if(sourcePreflight){
  run(process.env.PYTHON||'python3',['Tools/test_premium_surfaces.py']);
  console.log('BUKLOD_SOURCE_PREFLIGHT_PASS — geometry/skill smoke and fixtures only; no Unity, assets generated in release cache, APK, or production approval.');
 }else{
 if(resume){let cache=null;try{cache=JSON.parse(readFileSync(join(project,'Tools','ReviewOutput','wildlife','manifest.json'),'utf8'));}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
 const hash=createHash('sha256').update(readFileSync(join(project,'Tools','wildlife-review.mjs'))).digest('hex');
 if(cache?.sourceGeneratorSha256!==hash)run(process.execPath,['Tools/wildlife-review.mjs']);}
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
  // Run the entire project EditMode suite BEFORE asset import or APK packaging.
  // Test Runner owns process exit; do not pass -quit to -runTests.
  const stamp=Date.now(),tests=join(root,'editmode-'+stamp+'.xml'),testLog=join(root,'editmode-'+stamp+'.log');
  console.log('Unity EditMode test log: '+testLog);
  try{
   run(unity,['-batchmode','-projectPath',project,'-buildTarget','Android','-runTests','-testPlatform','EditMode','-assemblyNames','Buklod.Empire.Tests','-testResults',tests,'-logFile',testLog]);
   run(process.env.PYTHON||'python3',['Tools/verify-unity-editmode.py',tests]);
  }catch(error){if(existsSync(testLog))console.error(readFileSync(testLog,'utf8').split(/\r?\n/).slice(-100).join('\n'));throw error;}
  const before=new Set(readdirSync(root));
  const log=join(root,'unity-'+Date.now()+'.log');
  console.log('Unity build log: '+log);
  try{run(unity,['-batchmode','-quit','-projectPath',project,'-buildTarget','Android','-executeMethod',(validate?'Buklod.Empire.Editor.OfflineReviewBuildBootstrap.ValidateOnly':'Buklod.Empire.Editor.OfflineReviewBuildBootstrap.Build'),'-logFile',log]);}catch(error){if(existsSync(log))console.error(readFileSync(log,'utf8').split(/\r?\n/).slice(-100).join('\n'));throw error;}
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
  console.log('Isolated offline test artifact only: '+apk);
  }
 }else console.log('Review assets prepared only; no APK or Unity acceptance.');
 }
}finally{closeSync(fd);unlinkSync(lock);}
