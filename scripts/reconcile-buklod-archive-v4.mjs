#!/usr/bin/env node
// BUKLOD archive completeness reconciliation / targeted encrypted repair.
// Compares immutable V3 private manifest to actual V3 encrypted 7z file inventory
// (file path + uncompressed size + CRC32 on ambiguous paths).
// Uploads ONLY missing original bytes in encrypted separate-drive repair shards.
// Preserves all original projects; never edits production, branches, or database.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";

const BASE=path.join(process.env.TEMP||os.tmpdir(),"BUKLOD_CONSOLIDATED_CLOUD_MIGRATION");
const STAGING=path.resolve(process.env.BUKLOD_MIGRATION_STAGING||path.join(BASE,"remaining-assets-v3"));
const AUDIT=path.join(BASE,"ARCHIVE_COMPLETENESS_AND_REPAIR_V4.json");
const REPO="faust-0612/BUKLOD-Local-Recovery",SOURCES="faust-0612/BUKLOD-Migrated-Sources";
const GH=fs.existsSync("C:\\Program Files\\GitHub CLI\\gh.exe")?"C:\\Program Files\\GitHub CLI\\gh.exe":"gh";
const ZIP=fs.existsSync("C:\\Program Files\\7-Zip\\7z.exe")?"C:\\Program Files\\7-Zip\\7z.exe":"7z";
const MiB=1024*1024;
const MAX_SHARD_RAW_BYTES=3*1024*1024*1024;
const MAX_ASSET_PARTS=100;
const state={
 phase:"V4 exact V3 7z-vs-manifest audit and targeted repairs",started:new Date().toISOString(),
 status:"IN_PROGRESS",v3FilesExpected:0,v3FilesObserved:0,
 v3PathsAndContentMatched:0,missingFromV3Archive:0,changedSincePlan:0,
 v3AlreadyCloudVerified:false,v4RepairArchiveVerified:false,
 allAvailableV3CandidatesAccountedFor:false,safeToDeleteLocal:false,
 repairArchives:[],errors:[],originalProjectFilesDeleted:0
};
function checkpoint(){state.updated=new Date().toISOString();fs.mkdirSync(BASE,{recursive:true});fs.writeFileSync(AUDIT,JSON.stringify(state,null,2))}
function assert(ok,message){if(!ok)throw Error(message)}
function run(exe,args,{mode="capture",optional=false,timeout=6*60*60*1000}={}){
 const stdio=mode==="inherit"?["inherit","inherit","inherit"]:
    mode==="capture-interactive"?["inherit","pipe","inherit"]:["inherit","pipe","pipe"];
 const r=spawnSync(exe,args,{stdio,encoding:"utf8",windowsHide:true,timeout,maxBuffer:128*MiB});
 if(r.error||r.status!==0){
    if(optional)return null;
    throw Error(path.basename(exe)+" failed: "+(r.error?.message||r.status)+" "+String(r.stderr||"").slice(0,400));
 }
 return mode==="inherit"?"":String(r.stdout||"");
}
const norm=s=>String(s).replace(/\\/g,"/").replace(/^\/\?\//,"").replace(/^\/+/,"").replace(/\/+/g,"/").toLowerCase();
function archiveKeys(p){
 const full=norm(p), stripped=full.replace(/^[a-z]:\/?/,""), noColon=full.replace(/^([a-z]):\//,"$1/");
 return [...new Set([stripped,full,noColon])];
}
function archivedKey(p){return norm(p)}
const CRC_TABLE=new Uint32Array(256);
for(let k=0;k<256;k++){let c=k;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):(c>>>1);CRC_TABLE[k]=c>>>0}
function crc32(pathname){
 let crc=0xffffffff;const fd=fs.openSync(pathname,"r"),buf=Buffer.alloc(1024*1024);
 try{let n;while((n=fs.readSync(fd,buf,0,buf.length,null))>0)
    for(let i=0;i<n;i++)crc=CRC_TABLE[(crc^buf[i])&255]^(crc>>>8)}
 finally{fs.closeSync(fd)}
 return ((crc^0xffffffff)>>>0).toString(16).padStart(8,"0").toUpperCase();
}
function sha256(pathname){
 const h=crypto.createHash("sha256"),fd=fs.openSync(pathname,"r"),buf=Buffer.alloc(1024*1024);
 try{let n;while((n=fs.readSync(fd,buf,0,buf.length,null))>0)h.update(buf.subarray(0,n))}
 finally{fs.closeSync(fd)}
 return h.digest("hex");
}
function list7z(first,label){
 console.log("7-Zip encrypted listing:",label);
 console.log("Type the saved archive passphrase when 7-Zip waits. The prompt may not be visible because its listing is being captured.");
 // Explicit -p asks 7z for password interactively, does not echo or store it.
 const raw=run(ZIP,["l","-slt","-p",first],{mode:"capture-interactive"});
 const records=[];
 let seenSeparator=false, block=[];
 function finish(){
   const r={};
   for(const line of block){
      const m=line.match(/^([^=]+?) = (.*)$/);
      if(m)r[m[1].trim()]=m[2].trim();
   }
   if(r.Path&&r.Size!==undefined&&/^[0-9a-f]{8}$/i.test(r.CRC||"")&&r.Folder!=="+"&&r.Folder!=="true"){
      records.push({path:r.Path,size:Number(r.Size),crc:r.CRC.toUpperCase()});
   }
   block=[];
 }
 for(const line of raw.split(/\r?\n/)){
   if(/^-{5,}\s*$/.test(line)){seenSeparator=true;finish();continue}
   if(!seenSeparator)continue;
   if(!line.trim()){finish();continue}
   if(line.startsWith("Path = ")&&block.some(x=>x.startsWith("Path = ")))finish();
   block.push(line);
 }
 finish();
 if(records.length<10)throw Error("Unable to parse encrypted listing, or password wrong; parsed "+records.length+" file records");
 console.log(label,"has",records.length,"encrypted file records.");
 return records;
}
const stripDrive=s=>norm(s).replace(/^[a-z]:\/?/,"");
function shardRepair(missing,planId){
 // Split across original drive letters and avoid collisions in -spf2 stored paths.
 const groups=[];
 for(const x of missing.sort((a,b)=>a.source.localeCompare(b.source))){
   const drive=(x.source.match(/^([a-z]):[\\/]/i)||[])[1]?.toUpperCase()||"UNC";
   const key=stripDrive(x.source);
   let group=groups.find(g=>g.drive===drive&&g.bytes+x.bytes<=MAX_SHARD_RAW_BYTES&&!g.keys.has(key));
   if(!group){group={drive,files:[],keys:new Set(),bytes:0};groups.push(group)}
   group.files.push(x);group.keys.add(key);group.bytes+=x.bytes;
 }
 return groups.map((x,i)=>({...x,id:String(i+1).padStart(2,"0")+"-"+x.drive}));
}
function validateRemotePart(release,name,file){
 const meta=JSON.parse(run(GH,["api","repos/"+REPO+"/releases/tags/"+release]));
 const asset=(meta.assets||[]).find(x=>x.name===name);
 if(!asset)return false;
 const expected=sha256(file);
 if(asset.digest?.startsWith("sha256:")){
    assert(asset.digest.slice(7).toLowerCase()===expected,"Remote release SHA256 mismatch: "+name);
 }else{
    const checks=path.join(path.dirname(file),"download-verification");
    fs.mkdirSync(checks,{recursive:true});
    const pathDown=path.join(checks,name);
    if(fs.existsSync(pathDown))fs.rmSync(pathDown,{force:true});
    run(GH,["release","download",release,"--repo",REPO,"--dir",checks,"--pattern",name],{mode:"inherit",timeout:3*60*60*1000});
    assert(sha256(pathDown)===expected,"Downloaded archive SHA256 mismatch: "+name);
    fs.rmSync(pathDown,{force:true});
 }
 return true;
}
if(process.argv.includes("--self-test")){
 const a=[{source:"C:\\Users\\abc\\same.txt",bytes:2},{source:"D:\\Users\\abc\\same.txt",bytes:2}];
 const g=shardRepair(a,"test");assert(g.length===2,"drive-letter collision not isolated");
 assert(archiveKeys("C:\\Users\\Jose\\x.txt").includes("users/jose/x.txt"),"expected path normalization failed");
 const t=path.join(os.tmpdir(),"BUKLOD_V4_CRC_TEST_"+process.pid+".txt");
 try{fs.writeFileSync(t,"123456789");assert(crc32(t)==="CBF43926","CRC32 vector incorrect")}
 finally{fs.rmSync(t,{force:true})}
 console.log("SELF TEST PASSED: CRC32, -spf2 drive-collision isolation, path normalization.");process.exit(0)
}
try{
 const original=JSON.parse(fs.readFileSync(path.join(BASE,"RESUMABLE_REMAINING_ASSETS_V3.json"),"utf8"));
 assert(original.cloudVerified===true&&original.volumesVerified>=1,"Previous V3 cloud upload not SHA verified");
 state.v3AlreadyCloudVerified=true;
 assert(run(GH,["api","user","--jq",".login"]).trim()==="faust-0612","Unexpected GitHub login");
 for(const repo of [REPO,SOURCES])assert(run(GH,["repo","view",repo,"--json","isPrivate","--jq",".isPrivate"]).trim()==="true","Repository NOT private: "+repo);
 const planId=original.remoteRelease.split("/tag/")[1];
 assert(/^remaining-v3-recovery-\d{14}-[a-f0-9]{12}$/.test(planId),"Unrecognized V3 release");
 const dir=path.join(STAGING,planId);
 const mapPath=path.join(dir,"PRIVATE_RESTORE_MAP.json");
 assert(fs.existsSync(mapPath),"Original encrypted restore manifest missing in local staging. Cannot infer missing files.");
 const plan=JSON.parse(fs.readFileSync(mapPath,"utf8"));
 assert(plan.planDigest===original.planDigest&&plan.tag===planId,"Restore manifest does not match verified archive plan");
 assert(Array.isArray(plan.files)&&plan.files.length>30000,"Incomplete V3 plan");
 const first=path.join(dir,"BUKLOD_REMAINING_"+planId+".7z.001");
 assert(fs.existsSync(first),"Original encrypted archive volume missing locally");
 state.v3FilesExpected=plan.files.length;
 const archive=list7z(first,"V3");
 state.v3FilesObserved=archive.length;
 const index=new Map();
 for(const e of archive){const key=archivedKey(e.path),arr=index.get(key)||[];arr.push(e);index.set(key,arr)}
 // Determine which 7zip archive-path convention applies, without guessing.
 const modes=[
  {name:"stripped-drive", fn:p=>stripDrive(p)},
  {name:"full",fn:p=>norm(p)},
  {name:"drive-no-colon",fn:p=>norm(p).replace(/^([a-z]):\//,"$1/")}
 ];
 const sample=plan.files.slice(0,3000);
 const scores=modes.map(m=>({name:m.name,score:sample.filter(f=>index.has(m.fn(f.source))).length}));
 scores.sort((a,b)=>b.score-a.score);
 const selected=modes.find(x=>x.name===scores[0].name);
 assert(scores[0].score>=sample.length*0.65,"Cannot map V3 archived paths to original source; no repair will be uploaded. Mode scores: "+JSON.stringify(scores));
 state.archivePathConvention=selected.name;state.modeSampleScores=scores;
 // Match collisions by size AND CRC32, never by path alone when ambiguous.
 const byKey=new Map();
 for(const item of plan.files){const k=selected.fn(item.source),list=byKey.get(k)||[];list.push(item);byKey.set(k,list)}
 const missed=[],matched=[];
 let mutated=0,unreadable=0;
 for(const [key,local] of byKey){
   const archived=index.get(key)||[];
   const ambiguous=local.length>1||archived.length>1;
   const remaining=[...archived];
   for(const f of local){
     let stat;try{stat=fs.statSync(f.source)}catch{unreadable++;missed.push({...f,reason:"unreadable"});continue}
     if(!stat.isFile()){unreadable++;missed.push({...f,reason:"not-regular-file"});continue}
     if(stat.size!==f.bytes||Math.abs(stat.mtimeMs-f.mtime)>1500){mutated++;missed.push({...f,reason:"modified-since-plan"});continue}
     // Always match path AND original file size AND CRC32, including singleton paths.
     // This detects silent path collision and modified content of the same size.
     let actual;try{actual=crc32(f.source)}catch{unreadable++;missed.push({...f,reason:"cannot-read-for-CRC"});continue}
     const at=remaining.findIndex(x=>x.size===f.bytes&&x.crc===actual);
     if(at>=0){matched.push(f);remaining.splice(at,1)}
     else missed.push({...f,reason:archived.length?"archive-collision-or-size-mismatch":"no-archive-path"});
   }
 }
 state.v3PathsAndContentMatched=matched.length;
 state.missingFromV3Archive=missed.length;
 state.changedSincePlan=mutated;
 state.readErrors=unreadable;
 state.missingByReason=missed.reduce((m,x)=>(m[x.reason]=(m[x.reason]||0)+1,m),{});
 state.expectedArchiveExtraEntries=archive.length-matched.length;
 state.distinctSourcePathCollisions=[...byKey.values()].filter(x=>x.length>1).length;
 checkpoint();
 console.log("Exact V3 manifest-to-archive audit:",matched.length,"matched,",missed.length,"missing/changed,",archive.length,"archive file records.");
 console.log("Drive-letter path collisions:",state.distinctSourcePathCollisions);
 if(!missed.length){state.status="V3_ARCHIVE_PATH_COVERAGE_VERIFIED";state.allAvailableV3CandidatesAccountedFor=true;checkpoint();
  console.log("ALL V3 CANDIDATE FILES ACCOUNTED FOR. Earlier historical exclusions and app cloud-only builds remain pending.");process.exit(0)}
 if(unreadable>0){state.status="BLOCKED_BY_MISSING_OR_UNREADABLE_SOURCE";checkpoint();
  throw Error("Some original files are not readable now ("+unreadable+"). No claim of complete recovery; no uploads attempted.");}
 // Stable content-based plan and immutable, separate release name.
 for(const f of missed){
   try{f.sha256=sha256(f.source)}catch{throw Error("File vanished during repair preflight: cannot back up "+f.reason)}
 }
 const signature=crypto.createHash("sha256").update(plan.planDigest+"\n"+
   missed.map(x=>x.source+"|"+x.sha256).sort().join("\n")).digest("hex");
 const release="remaining-v4-repair-"+signature.slice(0,16);
 state.repairRelease="https://github.com/"+REPO+"/releases/tag/"+release;
 const batches=shardRepair(missed,release);
 state.repairShardCount=batches.length;
 console.log("Repair candidates:",missed.length,", repair shards:",batches.length,", estimated original bytes:",missed.reduce((s,x)=>s+x.bytes,0));
 assert(batches.length<=16,"Too many repair shards for one batch; make separate scoped backup plan.");
 const checkRelease=run(GH,["release","view",release,"--repo",REPO],{optional:true});
 if(checkRelease===null)run(GH,["release","create",release,"--repo",REPO,"--title","BUKLOD V4 targeted encrypted missing-file repairs","--notes",
  "Encrypted supplemental recovery for verified V3 archive; protected GitHub private repository. No original deletion."],{mode:"inherit"});
 const repairDir=path.join(STAGING,"repair-"+release);
 fs.mkdirSync(repairDir,{recursive:true});
 for(let j=0;j<batches.length;j++){
   const batch=batches[j],label="BUKLOD_V4_"+batch.id+"_"+signature.slice(0,12);
   const dir=path.join(repairDir,batch.id);
   fs.mkdirSync(dir,{recursive:true});
   const mapFile=path.join(dir,"ENCRYPTED_REPAIR_MAP.json");
   const listFile=path.join(dir,"REPAIR_INPUTS.txt");
   const map={schema:"BUKLOD-repair-v4",planDigest:plan.planDigest,signature,release,batch:batch.id,
     inputDrive:batch.drive,files:batch.files.map(x=>({source:x.source,bytes:x.bytes,sha256:x.sha256,reason:x.reason})),
     noOriginalDeletion:true};
   const currentMap=fs.existsSync(mapFile)?fs.readFileSync(mapFile,"utf8"):null;
   const nextMap=JSON.stringify(map,null,2);
   if(currentMap&&currentMap!==nextMap)throw Error("Existing repair map differs; refusing unsafe volume reuse");
   fs.writeFileSync(mapFile,nextMap);
   fs.writeFileSync(listFile,[mapFile,...batch.files.map(x=>x.source)].join("\n")+"\n");
   const archiveBase=path.join(dir,label+".7z");
   const firstPart=archiveBase+".001";
   if(!fs.existsSync(firstPart)){
     const estimate=batch.bytes+200*MiB;
     if(typeof fs.statfsSync==="function"){
       const disk=fs.statfsSync(dir),free=Number(disk.bavail)*Number(disk.bsize);
       assert(free>=estimate,"Insufficient safe temporary disk capacity for repair shard "+batch.id+
            " (need ~"+Math.ceil(estimate/MiB)+" MiB, available "+Math.floor(free/MiB)+" MiB)");
     }
     console.log("Creating encrypted repair shard",j+1,"of",batches.length,"; save the new archive password!");
     run(ZIP,["a","-t7z","-mhe=on","-mx=1","-v1400m","-spf2","-scsUTF-8","-p",archiveBase,"@"+listFile],{mode:"inherit"});
   }
   assert(fs.existsSync(firstPart),"Missing repair volume "+firstPart);
   console.log("Test encrypted repair shard",j+1,"(re-enter the repair password)");
   run(ZIP,["t",firstPart],{mode:"inherit"});
   // Encrypted header listing is used for content/count verification; no trust in 7z exit code alone.
   const verified=list7z(firstPart,"repair "+batch.id);
   assert(verified.length===batch.files.length+1,
     "Repair shard archive file count mismatch: found "+verified.length+" expected "+(batch.files.length+1));
   // Prove EACH repaired original path and byte content exists in this encrypted archive.
   const repairedIndex=new Map();
   for(const entry of verified){
     const k=selected.fn(entry.path);
     if(!repairedIndex.has(k))repairedIndex.set(k,[]);
     repairedIndex.get(k).push(entry);
   }
   for(const file of batch.files){
     const key=selected.fn(file.source),rec=(repairedIndex.get(key)||[]);
     assert(rec.some(x=>x.size===file.bytes&&x.crc===crc32(file.source)),
       "Archived repair file absent or CRC mismatch. No upload: "+batch.id);
     assert(sha256(file.source)===file.sha256,
       "Original file changed while repair archive was being created: "+batch.id);
   }
   const parts=fs.readdirSync(dir).filter(n=>n.startsWith(label+".7z.")&&/\.7z\.\d{3}$/.test(n)).sort();
   assert(parts.length>0&&parts.length<=MAX_ASSET_PARTS,"Unexpected number of repair volume assets");
   for(let i=0;i<parts.length;i++){
      const name=parts[i],loc=path.join(dir,name);
      const r=JSON.parse(run(GH,["api","repos/"+REPO+"/releases/tags/"+release]));
      const remote=(r.assets||[]).find(x=>x.name===name);
      if(!remote){
        console.log("Uploading shard "+batch.id+" volume "+(i+1)+"/"+parts.length);
        run(GH,["release","upload",release,loc,"--repo",REPO],{mode:"inherit",timeout:3*60*60*1000});
      }
      assert(validateRemotePart(release,name,loc),"Remote encrypted repair volume not found after upload");
   }
   state.repairArchives.push({shard:batch.id,files:batch.files.length,volumes:parts.length,verified:true});
   checkpoint();
 }
 state.status="V3_ARCHIVE_MISSING_CONTENT_REPAIRED_AND_CLOUD_VERIFIED";
 state.v4RepairArchiveVerified=true;
 state.allAvailableV3CandidatesAccountedFor=true;
 checkpoint();
 console.log("V3 ARCHIVE COMPLETENESS REPAIRED AND CLOUD VERIFIED");
 console.log("V3 matched:",matched.length,"V4 repaired:",missed.length,"new archive shards:",batches.length);
 console.log("Cloud repair:",state.repairRelease);
 console.log("Audit:",AUDIT);
 console.log("PROJECT DELETION STILL NOT AUTHORIZED: historic dirs and cloud-only app builds need audit.");
}catch(e){
 state.status="PARTIAL_OR_BLOCKED";
 state.errors.push(String(e.message));checkpoint();
 console.error("SAFE STOP:",String(e.message));
 console.error("No original local projects deleted. Audit report:",AUDIT);
 process.exitCode=1;
}
