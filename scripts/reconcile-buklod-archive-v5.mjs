#!/usr/bin/env node
// BUKLOD V5 archive completeness + deterministic indexed encrypted repair.
// Uses short, unique hardlink/copy staging paths to prevent 7-Zip listfile omissions.
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
 phase:"V5 exact V3 audit and indexed-payload encrypted repair",started:new Date().toISOString(),
 status:"IN_PROGRESS",v3FilesExpected:0,v3FilesObserved:0,
 v3PathsAndContentMatched:0,missingFromV3Archive:0,changedSincePlan:0,
 v3AlreadyCloudVerified:false,v4RepairArchiveVerified:false,
 allAvailableV3CandidatesAccountedFor:false,safeToDeleteLocal:false,
 repairArchives:[],errors:[],originalProjectFilesDeleted:0
};
function checkpoint(){state.updated=new Date().toISOString();fs.mkdirSync(BASE,{recursive:true});fs.writeFileSync(AUDIT,JSON.stringify(state,null,2))}
function assert(ok,message){if(!ok)throw Error(message)}
function run(exe,args,{mode="capture",optional=false,timeout=6*60*60*1000,cwd=undefined}={}){
 const stdio=mode==="inherit"?["inherit","inherit","inherit"]:
    mode==="capture-interactive"?["inherit","pipe","inherit"]:["inherit","pipe","pipe"];
 const r=spawnSync(exe,args,{stdio,cwd,encoding:"utf8",windowsHide:true,timeout,maxBuffer:128*MiB});
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
// Run 7-Zip behind a secure PowerShell prompt and feed its password over STDIN.
// Do NOT put the passphrase in argv, on disk, in a report, or in a process command line.
function list7z(first,label){
 console.log("7-Zip encrypted listing:",label);
 console.log("Enter the saved archive password when explicitly prompted. It will not echo.");
 const helper=path.join(BASE,"buklod-secure-7zip-list-v4.ps1");
 const listing=path.join(BASE,"7ZIP_LIST_"+crypto.createHash("sha256").update(first).digest("hex").slice(0,16)+".txt");
 const secureScript=String.raw`param(
  [Parameter(Mandatory=$true)][string]$SevenZip,
  [Parameter(Mandatory=$true)][string]$Archive,
  [Parameter(Mandatory=$true)][string]$Output
)
$ErrorActionPreference = 'Stop'
$secret = Read-Host 'Archive password (hidden; not saved)' -AsSecureString
if ($secret.Length -eq 0) { throw 'No password was entered.' }
$bstr = [IntPtr]::Zero
$proc = $null
try {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $SevenZip
  # Encrypted 7z headers trigger the password request automatically for "l".
  # Do not supply a bare -p (which can be interpreted as empty in noninteractive listing).
  $psi.Arguments = 'l -slt "' + $Archive + '"'
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $proc = [Diagnostics.Process]::Start($psi)
  if ($null -eq $proc) { throw 'Could not launch 7-Zip.' }
  $proc.StandardInput.WriteLine($plain)
  $proc.StandardInput.Close()
  $plain = $null
  [IO.File]::WriteAllText($Output, $proc.StandardOutput.ReadToEnd(), [System.Text.UTF8Encoding]::new($false))
  $err = $proc.StandardError.ReadToEnd()
  $proc.WaitForExit()
  if ($proc.ExitCode -ne 0) {
    throw "7-Zip listing failed (exit $($proc.ExitCode)). Check the saved archive password. $($err.Substring(0,[Math]::Min($err.Length,120)))"
  }
} finally {
  $plain = $null
  $secret.Dispose()
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ($null -ne $proc) { $proc.Dispose() }
}
`;
 fs.writeFileSync(helper,secureScript,"utf8");
 let raw;
 try{
   run("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-File",helper,
     "-SevenZip",ZIP,"-Archive",first,"-Output",listing],{mode:"inherit"});
   assert(fs.existsSync(listing),"7-Zip did not write its encrypted file listing.");
   raw=fs.readFileSync(listing,"utf8");
 }finally{
   if(fs.existsSync(listing))fs.rmSync(listing,{force:true});
 }
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
 if(records.length<10)throw Error("Unable to parse encrypted listing; parsed "+records.length+" file records");
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
 const testDir=fs.mkdtempSync(path.join(os.tmpdir(),"BUKLOD_V5_STAGING_TEST_"));
 const t=path.join(testDir,"source.txt"),tempAlias=path.join(testDir,"000001.dat");
 try{
   fs.writeFileSync(t,"123456789");
   assert(crc32(t)==="CBF43926","CRC32 vector incorrect");
   fs.linkSync(t,tempAlias);
   assert(sha256(t)===sha256(tempAlias),"Temp hardlink did not preserve original bytes");
   fs.unlinkSync(tempAlias);
   assert(fs.existsSync(t),"Removing temp hardlink affected source file");
   const safe=norm("payload\\data\\000001.dat");
   assert(safe==="payload/data/000001.dat","Fixed indexed archive path invalid");
 }finally{fs.rmSync(testDir,{recursive:true,force:true})}
 console.log("SELF TEST PASSED: CRC32, deterministic paths, -spf2 drive isolation, and non-destructive staging hardlinks.");process.exit(0)
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
 const release="remaining-v5-indexed-repair-"+signature.slice(0,16);
 state.repairRelease="https://github.com/"+REPO+"/releases/tag/"+release;
 state.v5ExpectedRepairFiles=missed.length;
 const repairDir=path.join(STAGING,"repair-v5-indexed-"+signature.slice(0,16));
 const payload=path.join(repairDir,"payload");
 const data=path.join(payload,"data");
 fs.mkdirSync(data,{recursive:true});
 const ordered=missed.slice().sort((a,b)=>a.source.toLowerCase().localeCompare(b.source.toLowerCase()));
 const manifest=[];
 let hardLinks=0,copied=0,totalCurrentBytes=0;
 console.log("V5 indexed staging:",ordered.length,"files. Original C:/D: source paths remain untouched.");
 for(let i=0;i<ordered.length;i++){
   const f=ordered[i],id=String(i+1).padStart(6,"0");
   const original=f.source;
   const shortPath="payload/data/"+id+".dat";
   const staged=path.join(data,id+".dat");
   const stat=fs.statSync(original);
   assert(stat.isFile(),"Original changed to non-file: repair ID "+id);
   assert(sha256(original)===f.sha256,"Original content changed since V3 repair audit: repair ID "+id);
   if(!fs.existsSync(staged)){
     // Same-volume hardlinks are zero-copy, read-only backup inputs. No original bytes are altered.
     try{fs.linkSync(original,staged);hardLinks++}
     catch(e){
       if(typeof fs.statfsSync==="function"){
         const d=fs.statfsSync(repairDir),free=Number(d.bavail)*Number(d.bsize);
         assert(free>=stat.size+200*MiB,"Insufficient safe staging disk space for repair ID "+id);
       }
       fs.copyFileSync(original,staged);copied++;
     }
   }
   assert(fs.statSync(staged).size===stat.size&&sha256(staged)===f.sha256,
       "Indexed staging content mismatch for repair ID "+id);
   manifest.push({archivedPath:shortPath,originalPath:original,
        size:stat.size,sha256:f.sha256,previousReason:f.reason});
   totalCurrentBytes+=stat.size;
   if((i+1)%400===0)console.log("Staged",i+1,"of",ordered.length,"indexed repair files.");
 }
 state.v5HardLinksCreated=hardLinks;
 state.v5CopiedTemporaryFiles=copied;
 state.v5OriginalBytes=totalCurrentBytes;
 const mapping=path.join(payload,"PRIVATE_V5_RESTORE_MAP.json");
 const privateMap=JSON.stringify({schema:"buklod-v5-indexed-recovery",
   signature,originalV3PlanDigest:plan.planDigest,originalRelease:original.remoteRelease,
   targetRelease:state.repairRelease,entries:manifest,originalLocalFilesDeleted:0},null,2);
 if(fs.existsSync(mapping)){
   assert(fs.readFileSync(mapping,"utf8")===privateMap,"Existing V5 restore map differs; refusing to reuse archive.");
 }else fs.writeFileSync(mapping,privateMap,"utf8");
 const archiveBase=path.join(repairDir,"BUKLOD_V5_INDEXED_"+signature.slice(0,16)+".7z");
 const firstPart=archiveBase+".001";
 if(!fs.existsSync(firstPart)){
   if(typeof fs.statfsSync==="function"){
     const d=fs.statfsSync(repairDir),free=Number(d.bavail)*Number(d.bsize);
     const estimate=Math.min(totalCurrentBytes+300*MiB,3*1024*MiB);
     assert(free>=estimate,"Not enough staging disk space for encrypted V5 archive. No original files changed.");
   }
   console.log("Creating encrypted indexed V5 archive. Save its NEW password!");
   // Exactly one short, controlled relative directory is passed to 7z.
   // This avoids the V4 @list/absolute path omission that archived only 2 of 2,631 files.
   run(ZIP,["a","-t7z","-mhe=on","-mx=1","-v1400m","-p",
       archiveBase,"payload"],{mode:"inherit",cwd:repairDir,timeout:6*60*60*1000});
 }
 assert(fs.existsSync(firstPart),"Expected V5 .7z.001 volume not created.");
 console.log("Testing V5 encrypted archive (enter new archive password).");
 run(ZIP,["t",firstPart],{mode:"inherit",timeout:6*60*60*1000});
 const entries=list7z(firstPart,"V5 indexed repair");
 assert(entries.length===manifest.length+1,
   "V5 encrypted file count mismatch. Expected "+(manifest.length+1)+", found "+entries.length+". No upload.");
 const archiveIndex=new Map();
 for(const item of entries)archiveIndex.set(norm(item.path),item);
 const privateEntry=archiveIndex.get("payload/private_v5_restore_map.json");
 assert(privateEntry&&privateEntry.size===fs.statSync(mapping).size&&privateEntry.crc===crc32(mapping),
   "Encrypted original-path restoration manifest missing or mismatched. No upload.");
 let verifiedFiles=0;
 for(const file of manifest){
   const stored=archiveIndex.get(norm(file.archivedPath));
   assert(stored&&stored.size===file.size&&stored.crc===crc32(file.originalPath),
      "Missing or mismatched encrypted indexed file: "+file.archivedPath+". No upload.");
   assert(sha256(file.originalPath)===file.sha256,
      "Original content changed during V5 archiving: "+file.archivedPath+". No upload.");
   verifiedFiles++;
   if(verifiedFiles%500===0)console.log("Indexed archive CRC verified",verifiedFiles,"/",manifest.length);
 }
 state.v5ArchiveEntriesVerified=verifiedFiles;
 checkpoint();
 const parts=fs.readdirSync(repairDir)
   .filter(n=>n.startsWith(path.basename(archiveBase)+".")&&/\.7z\.\d{3}$/.test(n)).sort();
 assert(parts.length>0&&parts.length<=MAX_ASSET_PARTS,"Invalid number of V5 archive volumes");
 const releaseExists=run(GH,["release","view",release,"--repo",REPO],{optional:true});
 if(releaseExists===null)run(GH,["release","create",release,"--repo",REPO,
   "--title","BUKLOD V5 encrypted indexed recovery","--notes",
   "Private encrypted repair with unique short paths and restore manifest. No production or local originals altered."],
   {mode:"inherit"});
 for(let k=0;k<parts.length;k++){
   const part=parts[k],loc=path.join(repairDir,part);
   const remote=JSON.parse(run(GH,["api","repos/"+REPO+"/releases/tags/"+release]));
   if(!(remote.assets||[]).some(x=>x.name===part)){
     console.log("Uploading encrypted V5 volume",k+1,"of",parts.length);
     run(GH,["release","upload",release,loc,"--repo",REPO],{mode:"inherit",timeout:3*60*60*1000});
   }else console.log("Checking already uploaded V5 volume",k+1,"of",parts.length);
   assert(validateRemotePart(release,part,loc),"Cloud repair volume missing.");
   state.v5RemoteVolumesVerified=k+1;checkpoint();
 }
 state.status="V5_ALL_MISSING_ARCHIVE_FILES_RECOVERED_AND_CLOUD_VERIFIED";
 state.v5RepairArchiveVerified=true; // Previous V4 repair remained partial; V5 is independent.
 state.allAvailableV3CandidatesAccountedFor=true;
 checkpoint();
 console.log("V5 EXACT INDEXED REPAIR CLOUD VERIFIED");
 console.log("Recovered original files:",manifest.length,"Verified remote volumes:",parts.length);
 console.log("Private cloud archive:",state.repairRelease);
 console.log("Audit:",AUDIT);
 console.log("NO LOCAL PROJECT DELETION AUTHORIZED; historical assets and cloud app builds remain pending.");
 // Remove only script-owned TEMP hardlinks, copies, and plaintext restoration map.
 // Originals are never located under this TEMP staging directory.
 assert(path.resolve(payload).startsWith(path.resolve(repairDir)+path.sep),"Unsafe TEMP cleanup path.");
 fs.rmSync(payload,{recursive:true,force:true});
}catch(e){
 state.status="PARTIAL_OR_BLOCKED";
 state.errors.push(String(e.message));checkpoint();
 console.error("SAFE STOP:",String(e.message));
 console.error("No original local projects deleted. Audit report:",AUDIT);
 process.exitCode=1;
}
