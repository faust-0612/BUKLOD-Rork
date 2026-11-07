#!/usr/bin/env node
/**
 * BUKLOD V9: encrypted PRIORITY historical source preservation.
 * A bounded first tranche only: other V7 unique files remain pending.
 * Original local C:/D: files are read-only, and no canonical repo/OTA is edited.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
const base=path.join(process.env.TEMP||os.tmpdir(),"BUKLOD_CONSOLIDATED_CLOUD_MIGRATION");
const stageRoot=path.resolve(process.env.BUKLOD_MIGRATION_STAGING||path.join(base,"historical-v9-priority"));
const reportFile=path.join(base,"HISTORICAL_PRIORITY_PRESERVATION_V9.json");
const repo="faust-0612/BUKLOD-Local-Recovery";
const gh=fs.existsSync("C:\\Program Files\\GitHub CLI\\gh.exe")?"C:\\Program Files\\GitHub CLI\\gh.exe":"gh";
const zip=fs.existsSync("C:\\Program Files\\7-Zip\\7z.exe")?"C:\\Program Files\\7-Zip\\7z.exe":"7z";
const MiB=1024**2, CAP=1900*MiB, MAX_FILE=200*MiB, MAX_PARTS=32;
const state={schema:"buklod-historical-priority-preservation/v9",created:new Date().toISOString(),
 status:"NOT_STARTED",v7UniqueFiles:0,v7UniqueBytes:0,selectedFiles:0,selectedBytes:0,
 remainingFiles:0,remainingBytes:0,archiveEntriesVerified:0,remoteVolumesVerified:0,
 archivedOriginalFilesDeleted:0,safeToDeleteLocal:false,cloudOnlyBuildsCertified:false,
 remoteRelease:null,issues:[]};
function save(){fs.mkdirSync(base,{recursive:true});state.updated=new Date().toISOString();fs.writeFileSync(reportFile,JSON.stringify(state,null,2))}
const assert=(x,m)=>{if(!x)throw Error(m)};
function run(exe,args,{show=false,optional=false,timeout=4*60*60*1000}={}){
 const r=spawnSync(exe,args,{stdio:show?["inherit","inherit","inherit"]:["inherit","pipe","pipe"],
   encoding:"utf8",windowsHide:true,timeout,maxBuffer:64*MiB});
 if(r.error||r.status!==0){if(optional)return null;throw Error("Command failed: "+path.basename(exe)+
   " status "+(r.error?.message||r.status)+" "+String(r.stderr||"").slice(0,160))}
 return show?"":String(r.stdout||"").trim();
}
function fileHash(f,algorithm="sha256"){
 const fd=fs.openSync(f,"r"),h=crypto.createHash(algorithm),b=Buffer.alloc(MiB);
 try{let n;while((n=fs.readSync(fd,b,0,b.length,null))>0)h.update(b.subarray(0,n))}
 finally{fs.closeSync(fd)}
 return h.digest("hex");
}
function gitBlob(f,bytes){
 const fd=fs.openSync(f,"r"),h=crypto.createHash("sha1").update("blob "+bytes+"\0"),b=Buffer.alloc(MiB);
 try{let n;while((n=fs.readSync(fd,b,0,b.length,null))>0)h.update(b.subarray(0,n))}
 finally{fs.closeSync(fd)}
 return h.digest("hex");
}
const table=new Uint32Array(256);
for(let k=0;k<256;k++){let c=k;for(let i=0;i<8;i++)c=c&1?(0xedb88320^(c>>>1)):(c>>>1);table[k]=c>>>0}
function crc32(f){
 const fd=fs.openSync(f,"r"),b=Buffer.alloc(MiB);let crc=0xffffffff;
 try{let n;while((n=fs.readSync(fd,b,0,b.length,null))>0)
  for(let i=0;i<n;i++)crc=table[(crc^b[i])&255]^(crc>>>8)}
 finally{fs.closeSync(fd)}
 return ((crc^0xffffffff)>>>0).toString(16).padStart(8,"0").toUpperCase();
}
function archivePath(p){return String(p).replace(/\\/g,"/").replace(/^\/+/,"").replace(/\/+/g,"/").toLowerCase()}

const rxSource=/\.(?:tsx?|jsx?|mjs|cjs|py|pyi|java|kt|kts|swift|dart|rs|go|c|cc|cpp|cxx|h|hpp|cs|vb|rb|php|lua|sql|prisma|graphql|gql|proto|sh|zsh|fish|ps1|bat|cmd|xaml|sln|csproj|vcxproj|gradle|groovy|pbxproj|entitlements|xcconfig|storyboard|strings|plist)$/i;
const rxMedia=/\.(?:png|jpe?g|webp|gif|svg|ico|bmp|heic|avif|psd|ai|eps|tif|tiff|woff2?|ttf|otf|mp3|m4a|mp4|mov|webm|ogg|wav|aac|flac|srt|vtt|lottie)$/i;
const rxData=/\.(?:pdf|docx?|xlsx?|xlsm|pptx?|csv|tsv|sqlite3?|db|db3|sqlitedb|bak|dump|jsonl|ndjson|parquet|arrow|feather|realm|dat|logdb)$/i;
const rxArchive=/\.(?:zip|7z|rar|tar|gz|bz2|xz|zst|apk|aab|ipa|exe|msi|dmg|iso|jar|aar|war|nupkg|crx|appx|msix)$/i;
const rxGenerated=/\.(?:class|dex|o|obj|pyc|pyo|dylib|dll|pdb|ilk|idb|exp|lib|a|gcda|gcno|pch|swiftmodule|swiftdoc|swiftinterface|xcactivitylog|pack|idx|rev|bitmap|midx)$/i;
const rxConfig=/\.(?:html?|css|scss|sass|less|md|mdx|txt|ya?ml|toml|ini|properties|xml|jsonc?|config|lock|map|conf|rules|pro|editorconfig|gitignore|gitattributes|npmrc|babelrc|prettierrc|eslintrc|env)$/i;
const generatedPaths=/(?:^|[\\/])(?:node_modules|\.gradle|build|dist|target|intermediates|outputs|\.expo|\.next|\.turbo|sdk|android-sdk|platforms|build-tools|system-images|\.git|coverage|DerivedData|Pods|__pycache__)(?:[\\/]|$)/i;
const highRiskName=/(?:^|[\\/])(?:\.env(?:\..*)?|id_rsa|id_ed25519|[^\\/]*service[-_.]?account[^\\/]*|[^\\/]*firebase-adminsdk[^\\/]*|[^\\/]*secret[^\\/]*|[^\\/]*private[-_.]?key[^\\/]*)$|\.(?:pem|p12|pfx|jks|keystore|key|gpg|asc)$/i;
const knownNoExt=/^(?:Makefile|Dockerfile|LICENSE(?:\..*)?|NOTICE(?:\..*)?|Gemfile|Podfile|Procfile|Jenkinsfile|README|CHANGELOG|gradlew|mvnw|bazel|BUILD|WORKSPACE|CODEOWNERS|CMakeLists\.txt)$/i;
const norm=p=>String(p).replace(/\\/g,"/");
const ext=p=>{const b=path.basename(p).toLowerCase();if(b.startsWith(".")&&!b.includes(".",1))return "<dotfile>";const x=path.extname(b);return x||"<no extension>";};
function classify(p){
 const n=norm(p),base=path.basename(p);
 if(highRiskName.test(n))return "sensitive_requires_encrypted_backup";
 if(generatedPaths.test(n)||rxGenerated.test(n))return "likely_regenerable_but_not_yet_proven";
 if(rxSource.test(n)||knownNoExt.test(base))return "source_or_project_build_input";
 if(rxArchive.test(n))return "archives_releases_and_dependencies";
 if(rxData.test(n))return "documents_and_databases";
 if(rxMedia.test(n))return "media_fonts_and_images";
 if(rxConfig.test(n))return "configuration_and_docs";
 return "unknown_must_preserve_until_reviewed";
}

function list7zText(raw,label){
 const records=[];
 let seenSeparator=false, block=[],zeroByteWithoutCRC=0,nonemptyWithoutCRC=0;
 function finish(){
   const r={};
   for(const line of block){
      const m=line.match(/^([^=]+?) = (.*)$/);
      if(m)r[m[1].trim()]=m[2].trim();
   }
   // In 7-Zip -slt output, an empty regular file can have Size=0
   // and a blank/omitted CRC field. Its CRC32 is mathematically 00000000.
   // Reject, rather than silently dropping, any nonempty file without CRC.
   if(r.Path&&r.Size!==undefined&&r.Folder!=="+"&&r.Folder!=="true"){
     const size=Number(r.Size);
     if(Number.isSafeInteger(size)&&size>=0){
       const rawCRC=String(r.CRC||"").trim().toUpperCase();
       let crc;
       if(/^[0-9A-F]{8}$/.test(rawCRC))crc=rawCRC;
       else if(size===0&&!rawCRC){crc="00000000";zeroByteWithoutCRC++}
       else {nonemptyWithoutCRC++}
       if(crc)records.push({path:r.Path,size,crc});
     }else nonemptyWithoutCRC++;
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
 console.log(label,"has",records.length,"encrypted file records; empty-without-CRC:",zeroByteWithoutCRC,
   "unparseable/nonempty-without-CRC:",nonemptyWithoutCRC);
 if(nonemptyWithoutCRC>0)throw Error("Archive index contains "+nonemptyWithoutCRC+
   " nonempty/unparseable entries without valid CRC. No upload.");
 if(records.length<10)throw Error("Cannot parse encrypted listing. No upload: only "+records.length+" file records.");
 return records;
}
// Exact manifest files only; 7-Zip also lists the two containing folders.
 // A folder can lack a Folder=+ marker in an encrypted technical listing.
 // Allow ONLY these recognized zero-size folder records, never arbitrary entries.


function createTestAndListEncrypted(archiveBase,firstPart,workDir){
 const script=path.join(base,"BUKLOD_V9_SECURE_HELPER.ps1"),indexFile=path.join(base,"BUKLOD_V9_INDEX_TEMP.txt");
 const embeddedPS=String.raw`param(
 [Parameter(Mandatory=$true)][string]$SevenZip,
 [Parameter(Mandatory=$true)][string]$WorkDir,
 [Parameter(Mandatory=$true)][string]$ArchiveBase,
 [Parameter(Mandatory=$true)][string]$FirstPart,
 [Parameter(Mandatory=$true)][string]$ListingFile
)
$ErrorActionPreference = 'Stop'
$secure = Read-Host 'New archive password (hidden, enter once and save it)' -AsSecureString
if ($secure.Length -eq 0) { throw 'Empty archive password is not allowed.' }
$bstr = [IntPtr]::Zero
try {
 $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 $pw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
 function RunZip([string]$arguments,[string]$operation) {
   $psi = New-Object System.Diagnostics.ProcessStartInfo
   $psi.FileName = $SevenZip
   $psi.Arguments = $arguments
   $psi.WorkingDirectory = $WorkDir
   $psi.UseShellExecute = $false
   $psi.CreateNoWindow = $true
   $psi.RedirectStandardInput = $true
   $psi.RedirectStandardOutput = $true
   $psi.RedirectStandardError = $true
   $p = New-Object System.Diagnostics.Process
   $p.StartInfo = $psi
   try {
     if (-not $p.Start()) { throw "Could not start 7-Zip for $operation" }
     $p.StandardInput.WriteLine($pw)
     $p.StandardInput.Close()
     $out = $p.StandardOutput.ReadToEnd()
     $err = $p.StandardError.ReadToEnd()
     $p.WaitForExit()
     if ($p.ExitCode -ne 0) {
        throw "$operation failed (7-Zip exit $($p.ExitCode)); no upload, originals untouched. $($err.Substring(0,[Math]::Min($err.Length,140)))"
     }
     return $out
   } finally { $p.Dispose() }
 }
 function Q([string]$value) { return '"' + $value.Replace('"','\"') + '"' }
 if (-not (Test-Path -LiteralPath $FirstPart)) {
   Write-Host 'Creating NEW encrypted V9 archive with the password just entered...'
   $text = RunZip ('a -t7z -mhe=on -mx=1 -v1400m -p ' + (Q $ArchiveBase) + ' payload') 'Archive creation'
   if (-not $text.Contains('Everything is Ok')) { throw 'Archive creation not confirmed as successful.' }
 } else {
   Write-Host 'Found prior V9 archive; attempting verification without overwriting it.'
 }
 $tested = RunZip ('t ' + (Q $FirstPart)) 'Encrypted archive test'
 if (-not $tested.Contains('Everything is Ok')) { throw 'Encrypted archive test was not confirmed as successful.' }
 if (-not $tested.Contains('7zAES')) { throw 'Archive did not report AES encryption in the 7-Zip test output. No upload.' }
 Write-Host 'AES-encrypted archive creation/test passed using the SAME hidden password.'
 $listing = RunZip ('l -slt ' + (Q $FirstPart)) 'Encrypted archive listing'
 [IO.File]::WriteAllText($ListingFile,$listing,[System.Text.UTF8Encoding]::new($false))
} finally {
 $pw = $null
 if ($null -ne $secure) { $secure.Dispose() }
 if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}


`;
 fs.writeFileSync(script,embeddedPS,"utf8");
 try{
   if(fs.existsSync(indexFile))fs.rmSync(indexFile,{force:true});
   run("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-File",script,
     "-SevenZip",zip,"-WorkDir",workDir,"-ArchiveBase",archiveBase,
     "-FirstPart",firstPart,"-ListingFile",indexFile],{show:true,timeout:6*60*60*1000});
   assert(fs.existsSync(indexFile),"Encrypted file listing not generated.");
   return list7zText(fs.readFileSync(indexFile,"utf8"),"V9 encrypted archive");
 }finally{if(fs.existsSync(indexFile))fs.rmSync(indexFile,{force:true})}
}

function selectedCandidates(v7){
 const categories={
  sensitive_requires_encrypted_backup:0,
  source_or_project_build_input:1,
  documents_and_databases:2,
  configuration_and_docs:3,
  unknown_must_preserve_until_reviewed:4,
  media_fonts_and_images:5,
  likely_regenerable_but_not_yet_proven:6,
  archives_releases_and_dependencies:7
 };
 const candidates=v7.uniqueFileRecords.map(f=>({...f,kind:classify(f.originalPath)}));
 candidates.sort((a,b)=>(categories[a.kind]??9)-(categories[b.kind]??9) ||
  a.bytes-b.bytes || a.originalPath.localeCompare(b.originalPath));
 let bytes=0;
 const yes=[],no=[];
 for(const f of candidates){
   if(f.bytes>MAX_FILE||bytes+f.bytes>CAP){no.push(f);continue}
   yes.push(f);bytes+=f.bytes;
 }
 return {selected:yes,remaining:no,bytes};
}
function selfTest(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"BUKLOD_V9_TEST_"));
 try{
   const t=path.join(temp,"source.js"),alias=path.join(temp,"000001.dat");
   fs.writeFileSync(t,"123456789");
   assert(crc32(t)==="CBF43926","CRC32 fixture invalid");
   try{fs.linkSync(t,alias)}catch{fs.copyFileSync(t,alias)}
   assert(fileHash(t)===fileHash(alias),"Temporary hardlink/copy mismatch");
   fs.unlinkSync(alias);assert(fs.existsSync(t),"Original file touched when staging link removed");
   assert(classify("D:\\BUKLOD\\src\\App.tsx")==="source_or_project_build_input","Source priority classifier");
   assert(classify("D:\\BUKLOD\\old\\camera.mp4")==="media_fonts_and_images","Media classifier");
   const fixture="---\nPath = outer.7z\nType = 7z\n---\n"+
     Array.from({length:11},(_,i)=>"Path = payload/data/"+String(i+1).padStart(6,"0")+".dat\nSize = 9\nCRC = CBF43926\n\n").join("");
   // Use a correctly separated technical listing with named containing directories.
   const proper="----------\nPath = test.7z\nType = 7z\n----------\n"+
     Array.from({length:12},(_,i)=>"Path = payload/data/"+String(i+1).padStart(6,"0")+".dat\nSize = "+
        (i===0?0:9)+"\nCRC = "+(i===0?"":"CBF43926")+"\nFolder = -\n\n").join("");
   const found=list7zText(proper,"V9 fixture");
   assert(found.length===12&&found[0].crc==="00000000","Encrypted listing zero-byte parsing");
   const plan=selectedCandidates({uniqueFileRecords:[{originalPath:"C:\\BUKLOD\\src\\a.tsx",bytes:10},
     {originalPath:"D:\\BUKLOD\\backup.tar",bytes:500*MiB}]});
   assert(plan.selected.length===1&&plan.remaining.length===1,"Priority cap does not guard huge files");
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
 console.log("SELF TEST PASSED: priority selection, source integrity, index parser and safe staging.");
}
if(process.argv.includes("--self-test")){selfTest();process.exit(0)}
try{
 const v7=JSON.parse(fs.readFileSync(path.join(base,"HISTORICAL_UNIQUE_FILES_V7.json"),"utf8"));
 const v8=JSON.parse(fs.readFileSync(path.join(base,"HISTORICAL_CLASSIFICATION_V8.json"),"utf8"));
 const v6=JSON.parse(fs.readFileSync(path.join(base,"ARCHIVE_COMPLETENESS_AND_REPAIR_V6.json"),"utf8"));
 assert(v7.scanComplete===true&&v7.status==="HISTORICAL_PARITY_AUDITED_PRESERVATION_PENDING",
   "V7 historical scan incomplete");
 assert(v8.status==="CLASSIFICATION_COMPLETE_NO_UPLOAD"&&v8.expectedUniqueFiles===v7.uniqueFiles,
   "V8 classification report missing or changed");
 assert(v6.allAvailableV3CandidatesAccountedFor===true&&v6.v6RemoteVolumesVerified>=1,
   "V6 private recovery not verified");
 assert(Array.isArray(v7.uniqueFileRecords)&&v7.uniqueFileRecords.length===12979,
   "Expected V7 unique historical inputs not found");
 assert(run(gh,["api","user","--jq",".login"])==="faust-0612","GitHub account mismatch");
 assert(run(gh,["repo","view",repo,"--json","isPrivate","--jq",".isPrivate"])==="true",
   "Cloud recovery destination is not PRIVATE");
 const plan=selectedCandidates(v7);
 const selected=plan.selected,remaining=plan.remaining;
 state.v7UniqueFiles=v7.uniqueFiles;state.v7UniqueBytes=v7.uniqueBytes;
 state.selectedFiles=selected.length;state.selectedBytes=plan.bytes;
 state.remainingFiles=remaining.length;state.remainingBytes=remaining.reduce((n,f)=>n+f.bytes,0);
 assert(selected.length>1000,"Too few priority files selected");
 assert(plan.bytes>100*MiB&&plan.bytes<=CAP,"Priority archive raw size out of allowed bounds");
 assert(state.selectedFiles+state.remainingFiles===v7.uniqueFiles,"Not all V7 files were itemized");
 assert(state.selectedBytes+state.remainingBytes===v7.uniqueBytes,"Historical raw byte accounting mismatch");
 const fingerprint=crypto.createHash("sha256").update(JSON.stringify(selected.map(f=>
   [f.originalPath,f.bytes,f.gitBlob,f.mtimeMs]))).digest("hex").slice(0,16);
 const release="historical-v9-priority-"+fingerprint;
 state.remoteRelease="https://github.com/"+repo+"/releases/tag/"+release;
 state.planId=fingerprint;
 const folder=path.join(stageRoot,"priority-"+fingerprint),payload=path.join(folder,"payload");
 const staging=path.join(payload,"data");
 fs.mkdirSync(staging,{recursive:true});
 const files=[];
 console.log("V9 priority historical recovery:",selected.length,"files,",(plan.bytes/1024**3).toFixed(2),
   "GiB. Remaining historical files:",remaining.length,"(NOT backed up by this batch).");
 const blocked=[];
 for(let i=0;i<selected.length;i++){
   const f=selected[i],short=String(i+1).padStart(6,"0")+".dat",alias=path.join(staging,short);
   let st;
   try{st=fs.statSync(f.originalPath)}
   catch{blocked.push({id:i+1,reason:"source-no-longer-readable"});continue}
   if(!st.isFile()||st.size!==f.bytes||Math.abs(st.mtimeMs-f.mtimeMs)>1500){
     blocked.push({id:i+1,reason:"source-changed"});continue
   }
   if(!fs.existsSync(alias)){
     try{fs.linkSync(f.originalPath,alias)}
     catch{
       if(typeof fs.statfsSync==="function"){
         const x=fs.statfsSync(staging),free=Number(x.bavail)*Number(x.bsize);
         assert(free>f.bytes+200*MiB,"Insufficient TEMP free disk for safe cross-volume staging.");
       }
       fs.copyFileSync(f.originalPath,alias);
     }
   }
   assert(fs.statSync(alias).size===f.bytes&&gitBlob(alias,f.bytes)===f.gitBlob,
     "Historical file checksum changed during staging: ID "+(i+1));
   files.push({index:i+1,staged:"payload/data/"+short,originalPath:f.originalPath,bytes:f.bytes,
     gitBlob:f.gitBlob,classification:f.kind});
   if((i+1)%1000===0)console.log("V9 priority staged",i+1,"of",selected.length);
 }
 assert(!blocked.length,"Historical input changed or unavailable for "+blocked.length+" files; no upload");
 assert(files.length===selected.length,"Priority staging file count mismatch");
 const mapping=path.join(payload,"PRIVATE_RESTORE_MAP_V9.json");
 const content=JSON.stringify({schema:"buklod-historical-v9-priority",
   sourceV7Digest:fingerprint,release,selectedCount:files.length,
   rawBytes:plan.bytes,remainingHistoricalFiles:state.remainingFiles,
   originalLocalFilesDeleted:0,entries:files},null,2);
 if(fs.existsSync(mapping))
   assert(fs.readFileSync(mapping,"utf8")===content,"Existing priority restore manifest differs; refuse archive reuse.");
 else fs.writeFileSync(mapping,content);
 const archive=path.join(folder,"BUKLOD_HISTORICAL_V9_"+fingerprint+".7z"),first=archive+".001";
 if(!fs.existsSync(first)&&typeof fs.statfsSync==="function"){
   const x=fs.statfsSync(folder),free=Number(x.bavail)*Number(x.bsize);
   assert(free>500*MiB,"Insufficient TEMP disk for even a small encrypted archive.");
 }
 const raw=createTestAndListEncrypted(archive,first,folder);
 const index=new Map();
 const allowDirs=new Set(["payload","payload/data"]);
 const expected=new Set(files.map(f=>f.staged.toLowerCase()));
 expected.add("payload/private_restore_map_v9.json");
 const ignored=[];
 for(const x of raw){
   const k=archivePath(x.path).replace(/\/+$/,"");
   if(allowDirs.has(k)&&x.size===0&&x.crc==="00000000"){
     assert(!ignored.includes(k),"Duplicate containing folder entry");ignored.push(k);continue
   }
   assert(expected.has(k),"Unexpected archived entry "+k+"; no upload");
   assert(!index.has(k),"Duplicate archived entry "+k);index.set(k,x);
 }
 assert(index.size===expected.size,"V9 archive file coverage mismatch: indexed "+
   index.size+" files, expected "+expected.size);
 const mapEntry=index.get("payload/private_restore_map_v9.json");
 assert(mapEntry&&mapEntry.size===fs.statSync(mapping).size&&mapEntry.crc===crc32(mapping),
   "Encrypted restore map size/CRC invalid; no upload.");
 for(let i=0;i<files.length;i++){
   const f=files[i],entry=index.get(f.staged.toLowerCase());
   assert(entry&&entry.size===f.bytes&&entry.crc===crc32(f.originalPath),
     "Historical entry CRC mismatch; no upload. Indexed ID: "+f.index);
   assert(gitBlob(f.originalPath,f.bytes)===f.gitBlob,"Original SHA1 Git blob mismatch after encryption: "+f.index);
   if((i+1)%1000===0)console.log("V9 encrypted entries individually verified:",i+1);
 }
 state.archiveEntriesVerified=files.length;save();
 const parts=fs.readdirSync(folder).filter(n=>n.startsWith(path.basename(archive)+".")
   &&/\.7z\.\d{3}$/.test(n)).sort();
 assert(parts.length>=1&&parts.length<=MAX_PARTS,"Unexpected encrypted volume count");
 if(run(gh,["release","view",release,"--repo",repo],{optional:true})===null)
   run(gh,["release","create",release,"--repo",repo,"--title",
     "BUKLOD V9 encrypted historical priority recovery","--notes",
     "Private encrypted indexed source/unknown historical preservation; not approved production or a complete historical recovery."]);
 for(let i=0;i<parts.length;i++){
   const name=parts[i],local=path.join(folder,name);
   let meta=JSON.parse(run(gh,["api","repos/"+repo+"/releases/tags/"+release]));
   let asset=(meta.assets||[]).find(a=>a.name===name);
   if(!asset){
     console.log("Uploading V9 encrypted volume",i+1,"of",parts.length);
     run(gh,["release","upload",release,local,"--repo",repo],{show:true});
     meta=JSON.parse(run(gh,["api","repos/"+repo+"/releases/tags/"+release]));
     asset=(meta.assets||[]).find(a=>a.name===name);
   }
   assert(asset,"Encrypted GitHub Release volume missing: "+name);
   const localSHA=fileHash(local);
   if(asset.digest?.startsWith("sha256:")){
     assert(localSHA===asset.digest.slice(7).toLowerCase(),"Remote encrypted volume SHA256 mismatch");
   }else{
     const dl=path.join(folder,"REMOTE_CHECK");fs.mkdirSync(dl,{recursive:true});
     const destination=path.join(dl,name);
     if(fs.existsSync(destination))fs.rmSync(destination,{force:true});
     run(gh,["release","download",release,"--repo",repo,"--dir",dl,"--pattern",name],{show:true});
     assert(fileHash(destination)===localSHA,"Downloaded remote encrypted volume SHA256 mismatch");
     fs.rmSync(destination,{force:true});
   }
   state.remoteVolumesVerified=i+1;save();
 }
 state.status="HISTORICAL_PRIORITY_V9_CLOUD_VERIFIED";
 save();
 console.log("BUKLOD HISTORICAL V9 PRIORITY ENCRYPTED CLOUD VERIFIED");
 console.log("Priority originals preserved:",state.selectedFiles,"remote encrypted volumes:",state.remoteVolumesVerified);
 console.log("HISTORICAL FILES STILL PENDING:",state.remainingFiles,"bytes GiB:",(state.remainingBytes/1024**3).toFixed(2));
 console.log("Private release:",state.remoteRelease);
 console.log("Audit report:",reportFile);
 console.log("NOT AUTHORIZED TO DELETE LOCAL FILES: remaining historical content, 33,049 unitemized exclusions, and cloud-only app builds.");
 const cleaned=path.resolve(payload);
 assert(cleaned.startsWith(path.resolve(folder)+path.sep),"Unsafe staged cleanup path");
 fs.rmSync(cleaned,{recursive:true,force:true});
}catch(e){
 state.status="PARTIAL_OR_BLOCKED";state.issues.push(String(e.message));save();
 console.error("SAFE STOP:",String(e.message));
 console.error("Original local project files unchanged. Report:",reportFile);
 process.exitCode=1;
}
