#!/usr/bin/env node
// One-pass BUKLOD local-to-GitHub source recovery; never edits production or deletes originals.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const home=process.env.USERPROFILE||os.homedir(), temp=process.env.TEMP||os.tmpdir();
const input=path.join(temp,'BUKLOD_PRIVATE_SCAN','SUMMARY.json');
const working=path.join(temp,'BUKLOD_CONSOLIDATED_CLOUD_MIGRATION');
const mainRepo='faust-0612/BUKLOD-Migrated-Sources', vaultRepo='faust-0612/BUKLOD-Local-Recovery';
const statusPath=path.join(working,'STATUS.json'), runPath=path.join(working,'RUN_ID.txt');
const ignores=new Set(['.git','node_modules','.expo','.next','.gradle','.cache','.turbo','Pods','DerivedData','__pycache__','dist','build','coverage','vendor','out','.venv','venv','target','.idea','.output']);
const binary=/\.(apk|aab|zip|7z|rar|gz|tar|exe|msi|dll|dmg|ipa|pdf|docx?|pptx?|xlsx?|sqlite3?|db|bak|dump|o|so|jar|class|map|log|tmp)$/i;
const sourceExt=/\.(tsx?|jsx?|mjs|cjs|json|jsonc|html?|css|scss|md|mdx|txt|yml|yaml|xml|sql|prisma|sh|ps1|cmd|bat|gradle|properties|kt|java|swift|m|mm|h|cpp|c|dart|py|rb|toml|ini|graphql|gql|svg|png|jpe?g|webp|gif|ico|ttf|woff2?|mp3|mp4|webm|ogg|wav|patch|diff|lock)$/i;
const secretName=/((^|[\\/])\.env($|\.)|(^|[\\/])\.npmrc$|(^|[\\/])\.netrc$|gradle\.properties|firebase-adminsdk|service.account|service-account|credential|secret|private[-_.]?key|id_rsa|id_ed25519|\.(pem|p12|pfx|jks|keystore|key|asc|gpg)$|google-services\.json)/i;
const secretContent=/(-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{24,}|"private_key"\s*:\s*"-----BEGIN)/;
const state={phase:'consolidated editable GitHub recovery',started:new Date().toISOString(),unlistedExclusions:0,
  sourceRepo:mainRepo,sourceBranch:null,sourceFiles:0,sourceBytes:0,vaultFiles:0,
  recovered:[],excluded:[],errors:[],sourceVerified:false,secretVaultVerified:false,
  complete:false,safeToDeleteLocal:false,localProjectFilesDeleted:0};
const seen=new Set();
const exists=p=>{try{return fs.existsSync(p)}catch{return false}};
const GH=exists('C:\\Program Files\\GitHub CLI\\gh.exe')?'C:\\Program Files\\GitHub CLI\\gh.exe':'gh';
const SEVEN=exists('C:\\Program Files\\7-Zip\\7z.exe')?'C:\\Program Files\\7-Zip\\7z.exe':'7z';
const sanitize=s=>s.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,60);
const sid=s=>crypto.createHash('sha256').update(s.toLowerCase()).digest('hex').slice(0,10);
function group(p){const t=p.toLowerCase();for(const [n,re] of [
 ['classroom',/classroom/],['quiz',/quiz|buklodq/],['attendance',/attendance/],
 ['report',/report/],['bsoc',/bsoc/],['quickcheck',/quickcheck/],['igpat',/igpat/],
 ['kabihasnang-ligaw',/kabihasnang|_kl_/],['ios',/ios/],['home',/buklod.home/],
 ['kingdom',/kingdom/],['city',/buklod.city/],['main',/rork|main|workspace|community|wall/]
 ])if(re.test(t))return n;return 'misc'}
function skipOld(p){return /BUKLOD_D_RESCUE|BUKLOD_D_BACKUP|BUKLODQ_BUILD_R126|BUKLODQ_R10_BUILD|BUKLOD_V2[5-7]/i.test(p)}
function exec(command,args,quiet=false,optional=false,cwd=undefined){
 const r=spawnSync(command,args,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:24*1024*1024,timeout:45*60*1000,
 stdio:quiet?['inherit','pipe','pipe']:['inherit','inherit','inherit']});
 if(r.error||r.status!==0){if(optional)return null;throw Error(command+' '+args.slice(0,3).join(' ')+' failed: '+String(r.error?.message||r.stderr||r.status).slice(0,400))}
 return quiet?(r.stdout||'').trim():'';
}
function save(){fs.mkdirSync(working,{recursive:true});state.updated=new Date().toISOString();fs.writeFileSync(statusPath,JSON.stringify(state,null,2))}
function excluded(p,reason){if(state.excluded.length<10000)state.excluded.push({path:p,reason});else state.unlistedExclusions++}
function privateRepo(repo){let check=exec(GH,['repo','view',repo,'--json','isPrivate','--jq','.isPrivate'],true,true);
 if(check===null){exec(GH,['repo','create',repo,'--private','--add-readme','--description','BUKLOD isolated cloud recovery; not a production deploy'])}
 check=exec(GH,['repo','view',repo,'--json','isPrivate','--jq','.isPrivate'],true);
 if(check!=='true')throw Error('Repository privacy check failed: '+repo)}
function sha(file){const h=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),b=Buffer.alloc(1024*1024);
 try {let n;while((n=fs.readSync(fd,b,0,b.length,null))>0)h.update(b.subarray(0,n))}
 finally {fs.closeSync(fd)} return h.digest('hex')}
if(process.argv.includes('--self-test')){
 if(group('BUKLOD_Quiz_Standalone')!=='quiz'||!skipOld('C:\\BUKLOD_V26_LOCAL_AAB'))throw Error('self test failed');
 console.log('SELF TEST PASSED');process.exit(0)}
try{
 if(!exists(input))throw Error('Inventory missing: '+input);
 const inventory=JSON.parse(fs.readFileSync(input,'utf8'));
 if(!Array.isArray(inventory.results)||inventory.results.length<40)throw Error('Invalid local inventory');
 if(exec(GH,['auth','status','--hostname','github.com'],true,true)===null)
   exec(GH,['auth','login','--hostname','github.com','--web','--git-protocol','https']);
 const actor=exec(GH,['api','user','--jq','.login'],true);
 if(actor.toLowerCase()!=='faust-0612')throw Error('Wrong GitHub login: '+actor);
 exec(GH,['auth','setup-git']);
 privateRepo(mainRepo);privateRepo(vaultRepo);
 fs.mkdirSync(working,{recursive:true});
 if(!exists(runPath))fs.writeFileSync(runPath,'recovery-'+new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14));
 const runId=fs.readFileSync(runPath,'utf8').trim();
 const branch='migration/'+runId,root=path.join(working,runId),source=path.join(root,'editable'),vault=path.join(root,'encrypted-files');
 state.sourceBranch=branch;
 fs.mkdirSync(source,{recursive:true});fs.mkdirSync(vault,{recursive:true});
 const roots=new Set(inventory.results.map(x=>x.root).filter(exists));
 for(const row of inventory.results)if(!exists(row.root))excluded(row.root,'unavailable on local disk');
 const workspace=path.join(home,'BUKLOD_WORKSPACE');
 for(const x of ['SOURCE','DEV','DOCS','SCRIPTS','CONFIG']){const p=path.join(workspace,x);if(exists(p))roots.add(p)}
 const dirs=[],files=[];
 const extracted=path.join(working,'extracted-standalone');
 fs.mkdirSync(extracted,{recursive:true});
 for(const r of [...roots].sort()){
  let stat;try{stat=fs.lstatSync(r)}catch{excluded(r,'unreadable root');continue}
  if(stat.isSymbolicLink())continue;
  if(stat.isFile()){
    if(binary.test(r)){
      if(/BUKLOD_Classroom_Standalone\.zip$/i.test(r)&&stat.size<450*1024*1024){
       const folder=path.join(extracted,'BUKLOD_Classroom_Standalone_'+sid(r));
       if(!exists(folder)){fs.mkdirSync(folder,{recursive:true});
        const unzip=exec(SEVEN,['x','-y',r,'-o'+folder],true,true);
        if(unzip===null){excluded(r,'Classroom ZIP extraction failed');continue}}
       dirs.push(folder);
      }else excluded(r,'historical binary/archive; requires separate retention decision');
      continue
    }
    files.push({file:r,root:r});
  }else if(stat.isDirectory()){
    if(path.win32.basename(r).toUpperCase()==='BUKLOD_WORKSPACE')continue;
    if(skipOld(r)){excluded(r,'old recovery/build; skipped to avoid confusing canonical GitHub source');continue}
    dirs.push(r);
  }
 }
 let sourceCap=0;
 function addFile(file,rel){
  let st;try{st=fs.lstatSync(file)}catch{excluded(file,'file unavailable');return}
  if(!st.isFile())return;
  const secret=secretName.test(file)||/(?:^|[\\/])(?:uploads|user-data)[\\/]/i.test(file);
  let confidential=secret;
  if(!confidential&&st.size<=1024*1024&&sourceExt.test(file)){
   try{confidential=secretContent.test(fs.readFileSync(file,'utf8'))}catch{}
  }
  if(confidential){
   if(st.size>300*1024*1024){excluded(file,'very large sensitive file; requires separate encrypted backup');return}
   const dest=path.join(vault,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});
   try{fs.copyFileSync(file,dest);state.vaultFiles++}catch(e){excluded(file,'sensitive file could not be read: '+e.code)}return;
  }
  if(binary.test(file)||(!sourceExt.test(file)&&!/^(?:Makefile|Dockerfile|LICENSE|\.gitignore|\.dockerignore|\.editorconfig|\.nvmrc)$/i.test(path.basename(file)))||st.size>24*1024*1024){
   excluded(file,'non-source or oversized asset; excluded from editable repo');return;
  }
  const dest=path.join(source,rel);
  if(seen.has(dest))return;seen.add(dest);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  try{fs.copyFileSync(file,dest)}catch(e){excluded(file,'file could not be copied: '+e.code);return}
  state.sourceFiles++;state.sourceBytes+=st.size;sourceCap++;
  if(sourceCap>80000||state.sourceBytes>1600*1024*1024)throw Error('Source size safety limit reached; no GitHub push');
 }
 for(const dir of dirs){
  const category=group(dir);
  const bucket=path.join('systems',category,sanitize(path.win32.basename(dir))+'_'+sid(dir));
  const start=state.sourceFiles,stack=[{p:dir,rel:'',depth:0}];
  while(stack.length){
   const item=stack.pop();
   if(item.depth>24){excluded(item.p,'scan depth limit');continue}
   let children;try{children=fs.readdirSync(item.p,{withFileTypes:true})}
   catch(e){excluded(item.p,'unreadable directory: '+e.code);continue}
   for(const d of children){
    if(d.isSymbolicLink())continue;
    const p=path.join(item.p,d.name),relative=path.join(item.rel,d.name);
    if(d.isDirectory()&&ignores.has(d.name))continue;
    if(d.isDirectory()&&/^(backup|backups|legacy_quarantine|old_versions)$/i.test(d.name)){excluded(p,'old nested snapshot');continue}
    if(d.isDirectory())stack.push({p,rel:relative,depth:item.depth+1});
    else if(d.isFile())addFile(p,path.join(bucket,relative));
   }
  }
  state.recovered.push({group:category,origin:dir,cloudPath:bucket.replaceAll('\\','/'),files:state.sourceFiles-start,
   classification:'recovered candidate; do NOT replace existing production source'});
  console.log(category,':',state.sourceFiles-start,'editable files:',dir);
  save();
 }
 for(const row of files){
  const rel=path.join('systems',group(row.file),sanitize(path.win32.basename(row.file))+'_'+sid(row.file),path.basename(row.file));
  addFile(row.file,rel);
  state.recovered.push({group:group(row.file),origin:row.file,cloudPath:rel.replaceAll('\\','/'),files:1,classification:'asset'});
 }
 const readme=[
 '# BUKLOD recovered local source workspaces','',
 'This branch is a recovery candidate, NOT current production, DEV or RC.',
 'Existing updated BUKLOD-Rork branches remain authoritative and untouched.',
 'Historical local versions are isolated by original path to prevent regression.',
 'All source files in this branch are editable using GitHub web editor.',
 'Credential files are excluded and encrypted separately.',
 'Do not delete local data until the full restore and dependency gate passes.','',
 '| System | Source path | Files |','|---|---|---:|',
 ...state.recovered.map(x=>'| '+x.group+' | '+x.cloudPath+' | '+x.files+' |')
 ].join('\n');
 fs.writeFileSync(path.join(source,'README.md'),readme);
 fs.writeFileSync(path.join(source,'MIGRATION_MANIFEST.json'),JSON.stringify({
  status:'source snapshot, not verified app builds',runId,recovered:state.recovered,excluded:state.excluded},null,2));
 if(state.sourceFiles<50)throw Error('Fewer than 50 source files found; refusing incomplete upload');
 if(!exists(path.join(source,'.git'))){
  exec('git',['init','-b',branch],false,false,source);
  exec('git',['config','user.name','BUKLOD Cloud Migration'],false,false,source);
  exec('git',['config','user.email','migration@users.noreply.github.com'],false,false,source);
  exec('git',['add','--all'],false,false,source);
  exec('git',['commit','-m','backup: isolated recovered local BUKLOD source, no production integration'],false,false,source);
 }
 const commit=exec('git',['rev-parse','HEAD'],true,false,source);
 const url='https://github.com/'+mainRepo+'.git';
 if(!exec('git',['remote'],true,false,source).split(/\s+/).includes('origin'))
  exec('git',['remote','add','origin',url],false,false,source);
 const ref='refs/heads/'+branch;
 const before=exec('git',['ls-remote','origin',ref],true,true,source);
 const remoteSha=before?before.split(/\s+/)[0]:'';
 if(remoteSha&&remoteSha!==commit)throw Error('Recovery branch already exists and differs; refusing force push');
 if(remoteSha!==commit)exec('git',['push','origin','HEAD:'+ref],false,false,source);
 const after=exec('git',['ls-remote','origin',ref],true,false,source).split(/\s+/)[0];
 if(after!==commit)throw Error('Remote source HEAD SHA mismatch');
 const verify=path.join(root,'restored-source');
 if(!exists(path.join(verify,'.git')))exec('git',['clone','--quiet','--single-branch','--depth','1','--branch',branch,url,verify]);
 if(exec('git',['rev-parse','HEAD'],true,false,verify)!==commit)throw Error('Independent source clone failed checksum comparison');
 state.sourceVerified=true;save();
 console.log('EDITABLE SOURCES VERIFIED: https://github.com/'+mainRepo+'/tree/'+branch);
 if(state.vaultFiles){
  const archive=path.join(root,'BUKLOD_KEYS_'+runId+'.7z'),first=archive+'.001';
  if(!exists(first)){
   console.log('Set a NEW archive passphrase; save it in your password manager. NOT your GitHub password.');
   exec(SEVEN,['a','-t7z','-mhe=on','-mx=0','-v1400m','-p',archive,'.'],false,false,vault);
  }
  if(!exists(first))throw Error('Encrypted vault missing');
  console.log('Enter the SAME password to test the encrypted vault.');
  exec(SEVEN,['t',first]);
  const release='keys-'+runId;
  if(exec(GH,['release','view',release,'--repo',vaultRepo],true,true)===null)
   exec(GH,['release','create',release,'--repo',vaultRepo,'--title','BUKLOD encrypted secrets rescue','--notes','Do not publish or delete local credentials.']);
  const parts=fs.readdirSync(root).filter(x=>x.startsWith(path.basename(archive)+'.')&&/\.7z\.\d{3}$/.test(x));
  for(const part of parts){
   const full=path.join(root,part);
   let r=JSON.parse(exec(GH,['api','repos/'+vaultRepo+'/releases/tags/'+release],true));
   if(!r.assets.some(a=>a.name===part))exec(GH,['release','upload',release,full,'--repo',vaultRepo]);
   r=JSON.parse(exec(GH,['api','repos/'+vaultRepo+'/releases/tags/'+release],true));
   const a=r.assets.find(x=>x.name===part);
   if(!a)throw Error('Uploaded vault part missing: '+part);
   if(a.digest&&a.digest.startsWith('sha256:')){
    if(a.digest.slice(7).toLowerCase()!==sha(full))throw Error('Remote vault SHA mismatch: '+part);
   }else{
    const check=path.join(root,'verify-vault');fs.mkdirSync(check,{recursive:true});
    exec(GH,['release','download',release,'--repo',vaultRepo,'--dir',check,'--pattern',part]);
    if(sha(path.join(check,part))!==sha(full))throw Error('Downloaded vault checksum mismatch');
   }
  }
  state.secretVaultVerified=true;
  console.log('ENCRYPTED PRIVATE VAULT VERIFIED: https://github.com/'+vaultRepo+'/releases/tag/'+release);
 }else state.secretVaultVerified=true;
 save();
 console.log('SOURCE RECOVERY PASS DONE: '+state.sourceFiles+' source files, '+state.vaultFiles+' encrypted sensitive files.');
 console.log('Unresolved/old artifacts: '+(state.excluded.length+state.unlistedExclusions)+'. STATUS: '+statusPath);
 console.log('NOT YET SAFE TO DELETE: full system recovery/build tests and historical classification pending.');
}catch(e){state.errors.push(String(e.stack||e));save();console.error('SAFE STOP: '+e.message);console.error('No project files deleted. Status: '+statusPath);process.exitCode=1}
