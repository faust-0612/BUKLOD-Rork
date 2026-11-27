// One local Unity QA invocation; no BuildPlayer, asset acquisition, publishing or paid CI.
import {existsSync,mkdirSync,openSync,closeSync,unlinkSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runLogged} from './run-logged-unity.mjs';
const project=fileURLToPath(new URL('../',import.meta.url));
const unity=process.argv[2]||join(process.env.ProgramFiles||'C:\\Program Files','Unity','Hub','Editor','6000.3.29f1','Editor','Unity.exe');
if(!isAbsolute(unity)||!existsSync(unity))throw Error('Use the pinned Unity 6000.3.29f1 executable.');
const version=readFileSync(join(project,'ProjectSettings/ProjectVersion.txt'),'utf8');
if(!/^m_EditorVersion:\s*6000\.3\.29f1\s*$/m.test(version))throw Error('Unexpected Unity project version');
const scene=join(project,'Assets/Generated/ReviewOnly/StylizedPhanBenchmark.unity');
if(!existsSync(scene))throw Error('Existing generated review scene missing. Prepare/import the approved diagnostic scene separately; no APK built.');
const git=(...args)=>execFileSync('git',args,{cwd:project,encoding:'utf8'}).trim();
const revision=git('rev-parse','HEAD');
const dirty=git('status','--porcelain','--untracked-files=no','--','.','../../scripts/generate-buklod-empire-hero-glbs.py');
if(dirty)throw Error('Reconcile local tracked changes before QA:\n'+dirty);
const root=join(project,'Builds','OfflineReview');mkdirSync(root,{recursive:true});
const lock=join(root,'.local-build.lock');const fd=openSync(lock,'wx');
try{
 const dir=join(root,'Stage1CombatQA',String(Date.now()));mkdirSync(dir,{recursive:true});
 const rows={};
 for(const [platform,assembly] of [['EditMode','Buklod.Empire.Tests'],['PlayMode','Buklod.Empire.PlayModeTests']]){
   const result=join(dir,platform+'.xml'),log=join(dir,platform+'.log');
   await runLogged(unity,['-batchmode','-projectPath',project,'-buildTarget','Android','-runTests','-testPlatform',platform,'-assemblyNames',assembly,'-testResults',result,'-logFile',log],{cwd:project,log,label:'Stage 1 '+platform,idleMs:15*60*1000,hardMs:90*60*1000});
   const verified=execFileSync(process.env.PYTHON||'python3',[join(project,'Tools/verify-stage1-combat.py'),platform,result],{cwd:project,encoding:'utf8'});
   console.log(verified);rows[platform]={result,log,counts:JSON.parse(verified)};
 }
 const receipt=join(dir,'stage1-combat-qa.json');
 writeFileSync(receipt+'.tmp',JSON.stringify({status:'EDITOR_COMBAT_QA_PASSED',sourceRevision:revision,unity:'6000.3.29f1',rows,deviceVerified:false,productionApproved:false},null,2)+'\n');renameSync(receipt+'.tmp',receipt);
 console.log('BUKLOD_STAGE1_COMBAT_EDITOR_QA_PASS — no APK built; Android and visual acceptance remain pending. '+receipt);
}finally{closeSync(fd);unlinkSync(lock);}
