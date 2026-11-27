// Explicit local-only offline test build. Never publishes, installs or enables paid CI.
import {existsSync, mkdirSync, openSync, closeSync, unlinkSync, readdirSync, statSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
const usage='Usage: node Tools/run-offline-test-build.mjs --prepare | --build <absolute Unity executable> <absolute Android build-tools directory>';
if(!((args.length===1&&args[0]==='--prepare')||(args.length===3&&args[0]==='--build')))throw Error(usage);
const build=args[0]==='--build', unity=args[1], sdk=args[2];
if(build){
 if(!isAbsolute(unity)||!isAbsolute(sdk)||!existsSync(unity)||!statSync(unity).isFile()||!existsSync(sdk)||!statSync(sdk).isDirectory())throw Error(usage);
 for(const path of [join(sdk,process.platform==='win32'?'aapt.exe':'aapt'),join(sdk,'lib','apksigner.jar')])if(!existsSync(path))throw Error('Missing Android build tool: '+path);
 const version=readFileSync(join(project,'ProjectSettings/ProjectVersion.txt'),'utf8');
 if(!/^m_EditorVersion:\s*6000\.3\.29f1\s*$/m.test(version))throw Error('Unexpected Unity project version');
}
const root=join(project,'Builds','OfflineReview');
mkdirSync(root,{recursive:true});
const lock=join(root,'.local-build.lock');
const fd=openSync(lock,'wx');
const run=(cmd,argv)=>{const r=spawnSync(cmd,argv,{cwd:project,stdio:'inherit',shell:false,env:{...process.env,PYTHONOPTIMIZE:''}});if(r.error)throw r.error;if(r.status!==0)throw Error('Stage failed: '+cmd+' ('+r.status+')');};
try{
 run(process.execPath,['Tools/verify-authored-review-assets.mjs']);
 run(process.execPath,['Tools/prepare-offline-review.mjs']);
 if(build){
  const before=new Set(readdirSync(root));
  const log=join(root,'unity-'+Date.now()+'.log');
  run(unity,['-batchmode','-quit','-projectPath',project,'-buildTarget','Android','-executeMethod','Buklod.Empire.Editor.OfflineReviewBuildBootstrap.Build','-logFile',log]);
  const apks=readdirSync(root).filter(x=>!before.has(x)&&x.endsWith('.apk'));
  if(apks.length!==1)throw Error('Expected exactly one new APK; inspect '+log);
  const apk=join(root,apks[0]);
  run(process.execPath,['Tools/verify-offline-test-apk.mjs',apk,sdk]);
  const receipt=JSON.parse(readFileSync(apk+'.verified.json','utf8'));
  if(receipt.status!=='VERIFIED_ISOLATED_TEST_ARTIFACT'||receipt.productionApproved!==false||receipt.deviceVerified!==false)throw Error('Unexpected verification receipt');
  console.log('Isolated offline test artifact only: '+apk);
 }else console.log('Review assets prepared only; no APK or Unity acceptance.');
}finally{closeSync(fd);unlinkSync(lock);}
