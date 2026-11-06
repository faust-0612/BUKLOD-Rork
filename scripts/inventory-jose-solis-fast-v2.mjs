#!/usr/bin/env node
// BUKLOD local discovery v2: metadata-only, bounded, read-only, no uploads/deletions.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const home=process.env.USERPROFILE||os.homedir();
const argv=process.argv.slice(2); const pos=argv.indexOf('--out');
const out=pos>=0&&argv[pos+1]?argv[pos+1]:path.join(os.tmpdir(),'BUKLOD_PRIVATE_SCAN');
const roots=new Set(), errors=[];
const exists=p=>{try{return fs.existsSync(p)}catch{return false}};
const add=p=>{if(exists(p))roots.add(path.resolve(p))};
const pat=/buklod|buklodq|rork|bsoc|kabihasnang|igpat|quickcheck|r31_r40/i;
const skips=new Set(['node_modules','.git','.expo','.gradle','.next','.cache','__pycache__','coverage','dist','build','vendor']);
for(const n of ['BUKLOD-Rork','BUKLOD-Rork-WebDeploy','BUKLOD_QUIZ_SSO_WEB','BUKLOD_IGPAT_WEB_VERIFY_20260917','BUKLOD_WORKSPACE','bkr','Downloads/BUKLOD_Classroom_Standalone','Downloads/BUKLOD_Quiz_Standalone','Desktop/BuklodConnect','OneDrive/Documents/ChatGPT/BUKLOD_Quiz_Standalone'])add(path.join(home,...n.split('/')));
for(const p of ['C:\\BUKLODQ_BUILD','C:\\BUKLODQ_BUILD_R126','C:\\BUKLODQ_R10_BUILD','C:\\BUKLOD_V26_LOCAL_AAB','D:\\BUKLOD_V27_CLEAN_NO_PTT','D:\\Downloads\\BUKLOD_WORKSPACE'])add(p);
for(const parent of [home,path.join(home,'Downloads'),path.join(home,'Desktop'),path.join(home,'Documents'),'C:\\','D:\\','D:\\Download','D:\\Downloads']){
 if(!exists(parent))continue;
 try{for(const e of fs.readdirSync(parent,{withFileTypes:true}))if(pat.test(e.name)&&!e.isSymbolicLink())add(path.join(parent,e.name))}
 catch(e){errors.push({parent,error:String(e.code||e.message)})}
}
fs.mkdirSync(out,{recursive:true});
const summary={format:'BUKLOD-local-inventory-v2',generated:new Date().toISOString(),phase:'bounded metadata only; not exhaustive',results:[],errors,safeToDelete:false,transferred:0};
const save=()=>fs.writeFileSync(path.join(out,'SUMMARY.json'),JSON.stringify(summary,null,2));
save();
function git(dir,args){try{return execFileSync('git',['-C',dir,...args],{encoding:'utf8',timeout:2500,windowsHide:true,maxBuffer:65536}).trim()}catch{return null}}
let index=0;
for(const root of [...roots].sort()){
 const start=Date.now(), stack=[{p:root,depth:0}],records=[],repos=[],notes=[];
 let files=0,dirs=0,truncated=false;
 while(stack.length){
  if(Date.now()-start>12000||files>=12000||dirs>=3500){truncated=true;break}
  const {p,depth}=stack.pop();let st;
  try{st=fs.lstatSync(p)}catch(e){notes.push({p,error:String(e.code||e.message)});continue}
  if(st.isSymbolicLink())continue;
  if(st.isFile()){files++; records.push({path:p,size:st.size,category:/\.env|secret|key|credential|\.p12|\.jks|\.keystore/i.test(p)?'sensitive':/\.(csv|xlsx?|sqlite3?|db|dump|bak)$/i.test(p)?'private-review':/\.(apk|aab|zip|7z|rar|tar|bundle)$/i.test(p)?'archive':'source-candidate'});continue}
  if(!st.isDirectory())continue;dirs++;
  let entries;try{entries=fs.readdirSync(p,{withFileTypes:true})}catch(e){notes.push({p,error:String(e.code||e.message)});continue}
  if(entries.some(e=>e.name==='.git'))repos.push({path:p,head:git(p,['rev-parse','HEAD']),branch:git(p,['branch','--show-current'])});
  for(const e of entries){if(e.isSymbolicLink()||e.isDirectory()&&skips.has(e.name.toLowerCase()))continue;
   if(depth>=16){truncated=true;continue}stack.push({p:path.join(p,e.name),depth:depth+1})}
 }
 const name='PROJECT_'+String(++index).padStart(3,'0')+'.json';
 fs.writeFileSync(path.join(out,name),JSON.stringify({root,records,repos,notes,truncated,unscanned:stack.length,hashed:false,remoteVerified:false},null,2));
 summary.results.push({root,manifest:name,files,dirs,repos,truncated,unscanned:stack.length,notes:notes.length,elapsedMs:Date.now()-start});
 save();console.log('['+index+'/'+roots.size+'] '+root+' '+files+' files'+(truncated?' (PARTIAL)':''));
}
summary.finished=new Date().toISOString();save();
console.log('SUMMARY: '+path.join(out,'SUMMARY.json'));console.log('Read only; no deletion authorized.');
