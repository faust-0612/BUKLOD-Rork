#!/usr/bin/env node
/**
 * BUKLOD V12 fresh current-root coverage reconciliation for 33,049 unitemized
 * exclusions in the old migration log. It cannot reconstruct a missing old
 * per-path exclusion list. Verifies current content, flags unknown unique files,
 * and refuses any original deletion, production changes or cloud uploads.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";

const ROOT=path.join(process.env.TEMP||os.tmpdir(),"BUKLOD_CONSOLIDATED_CLOUD_MIGRATION");
const INVENTORY=path.join(process.env.TEMP||os.tmpdir(),"BUKLOD_PRIVATE_SCAN","SUMMARY.json");
const OUTPUT=path.join(ROOT,"UNITEMIZED_EXCLUSION_COVERAGE_V12.json");
const GH=fs.existsSync("C:\\Program Files\\GitHub CLI\\gh.exe")?"C:\\Program Files\\GitHub CLI\\gh.exe":"gh";
const REPO="faust-0612/BUKLOD-Migrated-Sources";
const VAULT="faust-0612/BUKLOD-Local-Recovery";
const LIMIT=600000;
const MiB=1024**2;
const generatedDir=/^(?:\.git|node_modules|\.gradle|\.expo|\.next|\.turbo|\.cache|\.venv|venv|vendor|Pods|DerivedData|__pycache__|coverage|dist|build|out|target|intermediates|outputs|sdk|android-sdk|platforms|build-tools|system-images|\.pytest_cache|\.idea)$/i;
const filesRisk=/\.(?:tsx?|jsx?|mjs|cjs|py|java|kt|swift|dart|sql|prisma|graphql|yaml|yml|json|toml|xml|env|pem|key|jks|keystore|p12|pfx|mp4|png|jpe?g|webp|zip|tar|7z|rar|apk|aab|sqlite3?|db|bak|dump|md)$/i;
const sourceExt=/\.(?:tsx?|jsx?|mjs|cjs|py|java|kt|swift|dart|sql|prisma|graphql|yaml|yml|json|toml|xml|env|ps1|bat|cmd|sh|gradle)$/i;
const riskOf=p=>/\.(?:pem|key|jks|keystore|p12|pfx)$/i.test(p)||/[/\\]\.env(?:\.|$)/i.test(p)?
  "sensitive":sourceExt.test(p)?"source_and_config":filesRisk.test(p)?"media_and_artifacts":"unclassified";
const report={
 schema:"buklod-unitemized-current-roots-content-audit/v12",started:new Date().toISOString(),
 status:"NOT_STARTED",oldExclusionsWithoutPathRecords:33049,
 cannotReconstructOldExcludedPaths:true,
 originalFilesDeleted:0,remoteUploads:0,safeToDeleteLocal:false,
 sourceGitCommit:null,rootCandidates:0,rootsScanned:0,examinedFiles:0,hashedFiles:0,
 alreadyInGit:0,alreadyInV3V6CandidateSet:0,alreadyInV7HistoricalSet:0,
 duplicatesAcrossLocalUncovered:0,newUniqueFiles:0,newUniqueBytes:0,
 newUniqueByRisk:{},newUniqueBySize:{},newUniqueFileRecords:[],
 generatedDirectoriesSkipped:0,generatedOutputsNotYetCertified:true,
 unreadableCount:0,unreadableSample:[],missingRootsCount:0,missingRootsSample:[],
 symlinksSkipped:0,scanComplete:false,exclusionsFullyResolved:false,
 notes:["The 33,049 historical exclusions were never given path-level records; a fresh scan cannot reconstruct the old exact set.",
        "Current BUKLOD roots are scanned; known generated directories are counted but not individually content-hashed.",
        "Every unknown source/file remains protected pending encrypted backup or proof of reproducibility."],
 errors:[]
};
function save(){fs.mkdirSync(ROOT,{recursive:true});report.updated=new Date().toISOString();fs.writeFileSync(OUTPUT,JSON.stringify(report,null,2))}
function ensure(x,msg){if(!x)throw Error(msg)}
function run(exe,args,{maxBuffer=100*MiB}={}){
 const x=spawnSync(exe,args,{stdio:["inherit","pipe","pipe"],encoding:"utf8",
   timeout:45*60*1000,windowsHide:true,maxBuffer});
 if(x.error||x.status!==0)throw Error("CLI failed: "+path.basename(exe)+": "+String(x.error?.message||x.status)+" "+
   String(x.stderr||"").slice(0,180));
 return String(x.stdout||"").trim();
}
function gitBlob(file,size){
 const h=crypto.createHash("sha1").update("blob "+size+"\0");
 const fd=fs.openSync(file,"r"),b=Buffer.alloc(MiB);
 try{let n;while((n=fs.readSync(fd,b,0,b.length,null))>0)h.update(b.subarray(0,n))}
 finally{fs.closeSync(fd)}
 return h.digest("hex");
}
const normal=p=>path.resolve(p).toLowerCase();
function recordUnreadable(p){
 report.unreadableCount++;
 if(report.unreadableSample.length<20)report.unreadableSample.push({type:"unreadable",fileExtension:path.extname(p).slice(0,15)});
}
function selfTest(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"BUKLOD_V12_FIX_"));
 try{
   const test=path.join(dir,"x.ts");fs.writeFileSync(test,"abc");
   ensure(gitBlob(test,3)==="f2ba8f84ab5c1bce84a7b441cb1959cfc7093b7f","Git blob SHA1 fixture mismatch");
   ensure(generatedDir.test("node_modules")&&generatedDir.test("build")&&!generatedDir.test("src"),
      "Generated directory scan filter invalid");
   ensure(riskOf("C:\\BUKLOD\\app.tsx")==="source_and_config","Source classifier incorrect");
   ensure(riskOf("C:\\BUKLOD\\.env.local")==="sensitive","Sensitive classifier incorrect");
   ensure(riskOf("D:\\BUKLOD\\video.mp4")==="media_and_artifacts","Media classifier incorrect");
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
 console.log("SELF TEST PASSED: Git blob hashing, controlled source scan, sensitive/asset classification.");
}
if(process.argv.includes("--self-test")){selfTest();process.exit(0)}
try{
 const inventory=JSON.parse(fs.readFileSync(INVENTORY,"utf8"));
 const prior=JSON.parse(fs.readFileSync(path.join(ROOT,"STATUS.json"),"utf8"));
 const v3=JSON.parse(fs.readFileSync(path.join(ROOT,"RESUMABLE_REMAINING_ASSETS_V3.json"),"utf8"));
 const v6=JSON.parse(fs.readFileSync(path.join(ROOT,"ARCHIVE_COMPLETENESS_AND_REPAIR_V6.json"),"utf8"));
 const v7=JSON.parse(fs.readFileSync(path.join(ROOT,"HISTORICAL_UNIQUE_FILES_V7.json"),"utf8"));
 const v9=JSON.parse(fs.readFileSync(path.join(ROOT,"HISTORICAL_PRIORITY_PRESERVATION_V9.json"),"utf8"));
 const v10=JSON.parse(fs.readFileSync(path.join(ROOT,"HISTORICAL_RELEASE_PRESERVATION_V10.json"),"utf8"));
 ensure(prior.sourceVerified===true&&prior.secretVaultVerified===true,"Original cloud recovery gates failed");
 ensure(v3.cloudVerified===true&&v6.v6RepairArchiveVerified===true&&v6.v6RemoteVolumesVerified>=1,
   "V3/V6 source candidate backup not verified");
 ensure(v7.scanComplete===true&&v7.uniqueFileRecords?.length===12979,
   "V7 historical unique candidate audit missing");
 ensure(v9.status==="HISTORICAL_PRIORITY_V9_CLOUD_VERIFIED"&&v10.status==="HISTORICAL_RELEASE_V10_CLOUD_VERIFIED",
   "Private V9/V10 historical backups not verified");
 ensure(Array.isArray(inventory.results)&&inventory.results.length>=30,"Local source inventory missing");
 report.oldExclusionsWithoutPathRecords=Number(v7.previousExclusionsUnitemized||33049);
 ensure(run(GH,["api","user","--jq",".login"])==="faust-0612","Unexpected GitHub account");
 for(const repo of [REPO,VAULT])
   ensure(run(GH,["repo","view",repo,"--json","isPrivate","--jq",".isPrivate"])==="true",
     "Source or vault repo is not private");
 const token=prior.sourceBranch?.split("/")[1];
 ensure(/^recovery-\d{14}$/.test(token),"Original source recovery folder ID missing");
 const checkout=path.join(ROOT,token,"editable"),ref="migration/essentials-"+token;
 ensure(fs.existsSync(path.join(checkout,".git")),"Previous source checkout not found");
 const latest=run("git",["ls-remote","https://github.com/"+REPO+".git","refs/heads/"+ref]).split(/\s+/)[0];
 ensure(/^[a-f0-9]{40}$/.test(latest),"Cloud essentials SHA missing");
 run("git",["-C",checkout,"fetch","--quiet","origin","refs/heads/"+ref]);
 ensure(run("git",["-C",checkout,"rev-parse","FETCH_HEAD"])===latest,"Cloud Git SHA mismatch");
 report.sourceGitCommit=latest;
 const cloudBlobs=new Set();
 for(const item of run("git",["-C",checkout,"ls-tree","-r","-z","FETCH_HEAD"]).split("\0")){
   const match=item.match(/^\d+ blob ([a-f0-9]{40})\t/);
   if(match)cloudBlobs.add(match[1]);
 }
 ensure(cloudBlobs.size>10000,"Cloud source Git file inventory unexpectedly small");
 const v3Tag=String(v3.remoteRelease||"").split("/tag/")[1];
 ensure(/^remaining-v3-recovery-\d{14}-[a-f0-9]{12}$/.test(v3Tag),"V3 encrypted release ID invalid");
 const staging=path.resolve(process.env.BUKLOD_MIGRATION_STAGING||path.join(ROOT,"remaining-assets-v3"));
 const map=JSON.parse(fs.readFileSync(path.join(staging,v3Tag,"PRIVATE_RESTORE_MAP.json"),"utf8"));
 ensure(map.planDigest===v3.planDigest&&map.files?.length===39570,"V3 backup manifest changed");
 const backupBlobs=new Set();
 for(const item of [...map.files,...(map.aliases||[])])
   if(/^[a-f0-9]{40}$/.test(item.gitBlob||""))backupBlobs.add(item.gitBlob);
 ensure(backupBlobs.size>=5000,"V3 candidate SHA manifest unexpectedly incomplete");
 const historicalBlobs=new Set(v7.uniqueFileRecords.map(x=>x.gitBlob));
 ensure(historicalBlobs.size===v7.uniqueFiles,"V7 historical SHA1 collisions/duplicate content");
 const rootsRaw=[...new Set([...inventory.results.map(x=>x.root),...(prior.recovered||[]).map(x=>x.origin)]
   .filter(Boolean))].sort((a,b)=>a.length-b.length);
 const roots=[];
 for(const r of rootsRaw){
   if(!fs.existsSync(r)){
     report.missingRootsCount++;
     if(report.missingRootsSample.length<20)report.missingRootsSample.push(path.basename(r));
     continue;
   }
   const name=normal(r);
   if(roots.some(parent=>name===normal(parent)||name.startsWith(normal(parent)+path.sep)))continue;
   roots.push(r);
 }
 ensure(roots.length>=8,"Too few original inventory roots for a meaningful coverage scan");
 report.rootCandidates=rootsRaw.length;report.rootsScanned=roots.length;
 const visited=new Set(),newContent=new Set(),localDedup=new Set();
 for(const root of roots){
   let stat;try{stat=fs.lstatSync(root)}catch{recordUnreadable(root);continue}
   if(stat.isSymbolicLink()){report.symlinksSkipped++;continue}
   const queue=stat.isFile()?[{f:root,depth:0}]:[{d:root,depth:0}];
   while(queue.length){
     const item=queue.pop();
     if(item.depth>48){report.errors.push("Depth cap reached");continue}
     let entries;
     if(item.f){
       entries=[{isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>false,
         name:path.basename(item.f),complete:item.f}];
     } else {
       try{entries=fs.readdirSync(item.d,{withFileTypes:true})}
       catch{recordUnreadable(item.d);continue}
     }
     for(const e of entries){
       if(e.isSymbolicLink()){report.symlinksSkipped++;continue}
       const full=e.complete||path.join(item.d,e.name);
       if(e.isDirectory()){
         if(generatedDir.test(e.name)){report.generatedDirectoriesSkipped++;continue}
         queue.push({d:full,depth:item.depth+1});continue
       }
       if(!e.isFile())continue;
       const key=normal(full);if(visited.has(key))continue;visited.add(key);
       report.examinedFiles++;
       if(report.examinedFiles>LIMIT)throw Error("Safety cap of "+LIMIT+" current source files exceeded");
       let stat,hash;
       try{
         stat=fs.statSync(full);
         if(!stat.isFile())continue;
         hash=gitBlob(full,stat.size);
       }catch{recordUnreadable(full);continue}
       report.hashedFiles++;
       if(cloudBlobs.has(hash)){report.alreadyInGit++;continue}
       if(backupBlobs.has(hash)){report.alreadyInV3V6CandidateSet++;continue}
       if(historicalBlobs.has(hash)){report.alreadyInV7HistoricalSet++;continue}
       if(localDedup.has(hash)){report.duplicatesAcrossLocalUncovered++;continue}
       localDedup.add(hash);
       const category=riskOf(full);
       report.newUniqueByRisk[category]=(report.newUniqueByRisk[category]||0)+1;
       report.newUniqueFiles++;report.newUniqueBytes+=stat.size;
       report.newUniqueFileRecords.push({originalPath:full,gitBlob:hash,bytes:stat.size,
         category,mtimeMs:Math.round(stat.mtimeMs)});
       if(report.examinedFiles%12000===0)
         console.log("Current file audit:",report.examinedFiles,"hashed; novel unique:",report.newUniqueFiles);
     }
   }
 }
 report.scanComplete=report.missingRootsCount===0&&report.unreadableCount===0&&!report.errors.length;
 report.status=report.scanComplete?
    "FRESH_NON_GENERATED_SOURCE_PARITY_AUDITED":
    "FRESH_PARITY_INCOMPLETE_REQUIRES_REPAIR";
 // Deliberately never infer earlier 33,049 historic item identities from a new scan.
 report.exclusionsFullyResolved=false;
 save();
 console.log("BUKLOD V12 FRESH UNITEMIZED EXCLUSION RECONCILIATION COMPLETE");
 console.log("Accessible source roots:",report.rootsScanned,"current files examined:",report.examinedFiles);
 console.log("Cloud Git matches:",report.alreadyInGit,"V3/V6 matches:",report.alreadyInV3V6CandidateSet);
 console.log("Already in V7 historical candidate set:",report.alreadyInV7HistoricalSet);
 console.log("NEW UNIQUE NON-GENERATED CONTENT requiring review:",report.newUniqueFiles,
   "bytes GiB:",(report.newUniqueBytes/1024**3).toFixed(2));
 console.log("Novel file classes:",JSON.stringify(report.newUniqueByRisk));
 console.log("Generated directories omitted pending cloud-only reproducibility:",report.generatedDirectoriesSkipped);
 console.log("Missing roots:",report.missingRootsCount,"unreadable:",report.unreadableCount,
   "symlink paths skipped:",report.symlinksSkipped,"scan complete:",report.scanComplete);
 console.log("Old 33,049 exclusions still cannot be EXACTLY reconciled without original item-level logs.");
 console.log("Report with local-only file paths:",OUTPUT);
 console.log("NO LOCAL DELETION AUTHORIZED.");
}catch(e){
 report.status="BLOCKED_BEFORE_COVERAGE_COMPLETION";
 report.errors.push(String(e.message));save();
 console.error("SAFE STOP:",String(e.message));
 console.error("Original files untouched, no cloud upload. Audit:",OUTPUT);
 process.exitCode=1;
}
