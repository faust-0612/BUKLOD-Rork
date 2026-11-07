#!/usr/bin/env node
/**
 * BUKLOD V13 - selective, PROOF-GATED local cleanup
 * User goal: no local BUKLOD copies required for ongoing development.
 * Auto-delete ONLY files with verifiable byte-content in remote Git or
 * fully verified private V3/V6/V9/V10 recovery archives, plus known regenerable
 * caches inside explicitly identified BUKLOD roots.
 * Never delete non-BUKLOD personal files, currently-unverified unique files,
 * archived restore maps, app credentials/keystores, or user-wide folders.
 * This tool executes on the OWNER'S Windows computer, NOT on GitHub.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";

const TEMP=process.env.TEMP||os.tmpdir();
const BASE=path.join(TEMP,"BUKLOD_CONSOLIDATED_CLOUD_MIGRATION");
const INVENTORY=path.join(TEMP,"BUKLOD_PRIVATE_SCAN","SUMMARY.json");
const RECEIPT=path.join(process.env.LOCALAPPDATA||TEMP,"BUKLOD_CLOUD_CLEANUP_RECEIPTS");
const AUDIT=path.join(RECEIPT,"BUKLOD_SELECTIVE_DELETE_V13.json");
const GH=fs.existsSync("C:\\Program Files\\GitHub CLI\\gh.exe")?"C:\\Program Files\\GitHub CLI\\gh.exe":"gh";
const SOURCE_REPO="faust-0612/BUKLOD-Migrated-Sources";
const MAIN_REPO="faust-0612/BUKLOD-Rork";
const VAULT_REPO="faust-0612/BUKLOD-Local-Recovery";
const MiB=1024**2;
const LIMIT=800000;
const MAX_ERRORS=50;
const dirProduct=/(?:^|[\\/])(?:BUKLOD[^\\/]*|BUKLODQ[^\\/]*|BUKLODKINGDOM[^\\/]*|KABIHASNANG[_ -]?LIGAW[^\\/]*)(?:[\\/]|$)/i;
const basenameProduct=/^(?:BUKLOD|BUKLODQ|BUKLODKINGDOM|KABIHASNANG[-_ ]?LIGAW)[-_. ]?/i;
const generatedDirs=/^(?:node_modules|\.next|\.expo|\.gradle|\.cache|\.turbo|\.parcel-cache|dist|build|out|coverage|Pods|DerivedData|__pycache__|target|\.venv|venv|sdk|android-sdk|platforms|intermediates|\.pytest_cache)$/i;
const generatedFiles=/\.(?:tmp|cache|pyc|o|obj|class|dex|dSYM|gcda|gcno|pch|log)$/i;
const sensitive=/(?:^|[\\/])(?:\.env(?:\..*)?|\.npmrc|\.netrc|gradle\.properties|google-services\.json|GoogleService-Info\.plist|id_rsa|id_ed25519|[^\\/]*(?:credential|service[-_.]?account|firebase-adminsdk|secret|private[-_.]?key)[^\\/]*)$|\.(?:pem|key|jks|keystore|p12|pfx|gpg|asc)$/i;
const nonBUKLOD=/(?:^|[\\/])(?:_PHONE_RESTORE|PHONE_RECOVERY)(?:[\\/]|$)|(?:^|[\\/])(?:Kingdom\.Of\.The\.Planet\.Of\.The\.Apes|Godzilla\.X\.Kong)[^\\/]*\.(?:mp4|mkv|avi)$|\.(?:iso)$/i;
const protectedFolders=/^(?:\.git|\.svn|\.hg)$/i;
const forbiddenBase=/^(?:[a-z]:\\?|[a-z]:\\users\\[^\\]+|[a-z]:\\users\\[^\\]+\\(?:desktop|documents|downloads|pictures|videos|onedrive|appdata)|[a-z]:\\(?:program files(?: \(x86\))?|windows|users|programdata|recovery))\\?$/i;
const rootCategories=new Set(["main","quiz","classroom","faculty","attendance","kl","igpat","quickcheck","report","bsoc","kingdom","misc"]);
const norm=p=>path.resolve(p).toLowerCase();
const exactUnder=(p,root)=>p===root||p.startsWith(root+path.sep);
const records={schema:"buklod-selective-cleanup/v13",started:new Date().toISOString(),
 result:"NOT_STARTED",executionMode:process.argv.includes("--execute")?"DELETE_VERIFIED_ONLY":"AUDIT_ONLY",
 canonicalMainRepo:MAIN_REPO,sourceRecoveryRepo:SOURCE_REPO,encryptedVaultRepo:VAULT_REPO,
 sourceGitCommit:null,mainGitCommit:null,sourceGitObjects:0,mainGitObjects:0,
 candidateRoots:0,acceptedRoots:0,rejectedRoots:[],filesExamined:0,filesBacked:0,
 generatedEligible:0,filesDeleted:0,bytesDeleted:0,directoriesRemoved:0,
 backedSourceGit:0,backedEncryptedManifests:0,
 candidateCount:0,candidateBytes:0,
 keptSensitive:0,keptPersonal:0,keptUniqueUnproven:0,keptOther:0,unreadable:0,
 skippedSymlinks:0,errors:[],protectedExamples:[],
 archiveTagsVerified:[],preservedOriginalFilesMayRemain:true,
 cloudOnlyBuildsVerified:false,allLocalBuklodFilesDeleted:false,
 successNotEquivalentToProductionRelease:true};
function persist(){
 fs.mkdirSync(RECEIPT,{recursive:true});
 records.updated=new Date().toISOString();
 fs.writeFileSync(AUDIT,JSON.stringify(records,null,2),"utf8");
}
function assert(ok,msg){if(!ok)throw Error(msg)}
function exec(exe,args,{optional=false}={}){
 const r=spawnSync(exe,args,{stdio:["inherit","pipe","pipe"],encoding:"utf8",
  windowsHide:true,timeout:45*60*1000,maxBuffer:120*MiB});
 if(r.error||r.status!==0){if(optional)return null;throw Error(path.basename(exe)+
  " failed: "+String(r.error?.message||r.status)+" "+String(r.stderr||"").slice(0,180))}
 return String(r.stdout||"").trim();
}
function jread(file){return JSON.parse(fs.readFileSync(file,"utf8"))}
function blob(file,size){
 const h=crypto.createHash("sha1").update("blob "+size+"\0");
 const fd=fs.openSync(file,"r"),b=Buffer.alloc(MiB);
 try{let n;while((n=fs.readSync(fd,b,0,b.length,null))>0)h.update(b.subarray(0,n))}
 finally{fs.closeSync(fd)}
 return h.digest("hex");
}
function riskProtect(file){
 if(sensitive.test(file))return "sensitive";
 if(nonBUKLOD.test(file))return "personal";
 return null;
}
function candidateRoot(p,allowGroup=false){
 if(typeof p!=="string"||!path.isAbsolute(p))return false;
 const resolved=path.resolve(p);
 if(forbiddenBase.test(resolved))return false;
 const local=norm(resolved);
 if(exactUnder(local,norm(BASE))||exactUnder(local,norm(RECEIPT))||
    exactUnder(local,norm(path.join(TEMP,"BUKLOD_PRIVATE_SCAN"))))return false;
 if(/[\\/]AppData[\\/]/i.test(resolved))return false; // never delete from application data.
 if(/[\\/](?:\.git|node_modules)[\\/]/i.test(resolved))return false;
 const basename=path.basename(resolved);
 if(basenameProduct.test(basename))return true;
 // A named BUKLOD directory may legitimately contain third-party folders;
 // accept only an inventory-verified root under it.
 if(dirProduct.test(resolved))return true;
 // For safely inventoried standalone apps, the original consolidated source
 // provenance must explicitly name the app and original root.
 return allowGroup&&/^(?:quiz|classroom|faculty|quickcheck|igpat|bsoc|kabihasnang[-_ ]?ligaw)$/i.test(basename);
}
function cloudReleaseVerified(tag){
 assert(/^(?:remaining-v3-recovery-|remaining-v6-indexed-repair-|historical-v9-priority-|historical-v10-releases-)[0-9a-z-]+$/.test(tag),
   "Unexpected encrypted cloud archive release tag.");
 const r=jparse(exec(GH,["api","repos/"+VAULT_REPO+"/releases/tags/"+tag]));
 assert(Array.isArray(r.assets)&&r.assets.length>0,"Encrypted release missing remote asset "+tag);
 for(const asset of r.assets){
   assert(asset.size>0&&String(asset.name).endsWith(".001")||asset.size>0&&/\.7z\.\d{3}$/.test(asset.name),
      "Unexpected recovery asset in release "+tag);
   assert(asset.digest?.startsWith("sha256:")&&/^[a-f0-9]{64}$/i.test(asset.digest.slice(7)),
      "GitHub recovery asset has no server SHA256 digest: "+tag);
 }
 records.archiveTagsVerified.push({tag,volumes:r.assets.length});
}
function jparse(s){return JSON.parse(s)}
function gitBlobsOfRemoteCheckout(){
 const st=jread(path.join(BASE,"STATUS.json"));
 assert(st.sourceVerified===true&&st.secretVaultVerified===true,
   "Source and signing/secrets archive source-recovery gates are not verified.");
 const runID=String(st.sourceBranch||"").split("/")[1];
 assert(/^recovery-\d{14}$/.test(runID),"Source checkout recovery ID missing.");
 const checkout=path.join(BASE,runID,"editable");
 assert(fs.existsSync(path.join(checkout,".git")),"Verified isolated cloud source checkout not available.");
 const branch="migration/essentials-"+runID;
 const SHA=exec("git",["ls-remote","https://github.com/"+SOURCE_REPO+".git","refs/heads/"+branch])
   .split(/\s+/)[0];
 assert(/^[a-f0-9]{40}$/.test(SHA),"Cannot establish essentials remote SHA.");
 exec("git",["-C",checkout,"fetch","--quiet","origin","refs/heads/"+branch]);
 assert(exec("git",["-C",checkout,"rev-parse","FETCH_HEAD"])===SHA,
   "Source remote and fetched SHA do not match.");
 records.sourceGitCommit=SHA;
 const source=new Set();
 for(const item of exec("git",["-C",checkout,"ls-tree","-r","-z","FETCH_HEAD"]).split("\0")){
   const m=item.match(/^\d+ blob ([a-f0-9]{40})\t/);if(m)source.add(m[1]);
 }
 assert(source.size>=10000,"Too few recovered cloud source files");
 records.sourceGitObjects=source.size;
 return {source,st};
}
function gitBlobsOfMain(){
 const SHA=exec(GH,["api","repos/"+MAIN_REPO+"/commits/main","--jq",".sha"]);
 assert(/^[a-f0-9]{40}$/.test(SHA),"Cannot establish canonical main SHA");
 records.mainGitCommit=SHA;
 // Main Git API may truncate for large trees; only use it if fully returned.
 const out=exec(GH,["api","repos/"+MAIN_REPO+"/git/trees/"+SHA+"?recursive=1"],{optional:true});
 if(!out)return new Set();
 try{
  const tree=JSON.parse(out);
  if(tree.truncated)return new Set();
  const blobs=new Set(tree.tree.filter(x=>x.type==="blob"&&/^[a-f0-9]{40}$/.test(x.sha)).map(x=>x.sha));
  records.mainGitObjects=blobs.size;
  return blobs;
 }catch{return new Set()}
}
function v3AndV6Blobs(v3){
 const tag=String(v3.remoteRelease||"").split("/tag/")[1];
 assert(tag&&tag.startsWith("remaining-v3-recovery-"),"V3 original release tag unavailable");
 const map=jread(path.join(BASE,"remaining-assets-v3",tag,"PRIVATE_RESTORE_MAP.json"));
 assert(map.planDigest===v3.planDigest&&Array.isArray(map.files)&&map.files.length===39570,
   "V3/V6 indexed candidate mapping mismatch; refuse deletion");
 const blobs=new Set();
 for(const item of [...map.files,...(map.aliases||[])])
    if(/^[a-f0-9]{40}$/.test(item.gitBlob||""))blobs.add(item.gitBlob);
 assert(blobs.size>=5000,"Unexpectedly empty verified V3/V6 content pool");
 return blobs;
}
function historicalProof(v7,v9,v10){
 assert(v7.status==="HISTORICAL_PARITY_AUDITED_PRESERVATION_PENDING"&&
    v7.uniqueFileRecords?.length===12979,"V7 historical records unverified");
 // Reconstruct EXACT deterministic V9 selection: confirmed matching checksum
 // is used to prove files in the encrypted remote release, not merely plans.
 const priorSort=v7.uniqueFileRecords.map(f=>({...f,kind:classifyV9(f.originalPath)}))
   .sort((a,b)=>v9Priority(a.kind)-v9Priority(b.kind)||a.bytes-b.bytes||
     a.originalPath.localeCompare(b.originalPath));
 const p9=[],un9=[];let raw9=0;
 for(const f of priorSort){if(f.bytes>200*MiB||raw9+f.bytes>1900*MiB){un9.push(f);continue}
   p9.push(f);raw9+=f.bytes}
 const fp9=crypto.createHash("sha256").update(JSON.stringify(p9.map(f=>
   [f.originalPath,f.bytes,f.gitBlob,f.mtimeMs]))).digest("hex").slice(0,16);
 assert(fp9===v9.planId&&p9.length===v9.selectedFiles&&raw9===v9.selectedBytes&&un9.length===v9.remainingFiles,
   "V9 immutable preserved-file list cannot be reconstructed. No deletion.");
 const priority=f=>/\.(?:apk|aab)$/i.test(f.originalPath)?0:
     /\.(?:zip|tar|tgz|7z|gz|rar)$/i.test(f.originalPath)?1:
     /\.(?:mp4|mov|webm)$/i.test(f.originalPath)?3:2;
 const p10=[],un10=[];let raw10=0;
 for(const f of [...un9].sort((a,b)=>priority(a)-priority(b)||a.bytes-b.bytes||a.originalPath.localeCompare(b.originalPath))){
   const basename=path.basename(f.originalPath);
   if(/^(?:Kingdom\.Of\.The\.Planet\.Of\.The\.Apes|Godzilla\.X\.Kong)/i.test(basename)||
      /[_-]PHONE[_-]RESTORE|PHONE_RECOVERY/i.test(f.originalPath)||
      /\.iso$/i.test(basename)||f.bytes>1900*MiB||raw10+f.bytes>1900*MiB){un10.push(f);continue}
   p10.push(f);raw10+=f.bytes;
 }
 const fp10=crypto.createHash("sha256").update(JSON.stringify(p10.map(f=>
   [f.originalPath,f.bytes,f.gitBlob,f.mtimeMs]))).digest("hex").slice(0,16);
 assert(fp10===v10.planId&&p10.length===v10.selectedFiles&&raw10===v10.selectedBytes&&
   un10.length===v10.remainingFiles,"V10 immutable preserved-file list cannot be reconstructed. No deletion.");
 return new Set([...p9,...p10].map(f=>f.gitBlob));
}
const rxSource=/\.(?:tsx?|jsx?|mjs|cjs|py|pyi|java|kt|kts|swift|dart|rs|go|c|cc|cpp|cxx|h|hpp|cs|vb|rb|php|lua|sql|prisma|graphql|gql|proto|sh|zsh|fish|ps1|bat|cmd|xaml|sln|csproj|vcxproj|gradle|groovy|pbxproj|entitlements|xcconfig|storyboard|strings|plist)$/i;
const rxMedia=/\.(?:png|jpe?g|webp|gif|svg|ico|bmp|heic|avif|psd|ai|eps|tif|tiff|woff2?|ttf|otf|mp3|m4a|mp4|mov|webm|ogg|wav|aac|flac|srt|vtt|lottie)$/i;
const rxData=/\.(?:pdf|docx?|xlsx?|xlsm|pptx?|csv|tsv|sqlite3?|db|db3|sqlitedb|bak|dump|jsonl|ndjson|parquet|arrow|feather|realm|dat|logdb)$/i;
const rxArchive=/\.(?:zip|7z|rar|tar|gz|bz2|xz|zst|apk|aab|ipa|exe|msi|dmg|iso|jar|aar|war|nupkg|crx|appx|msix)$/i;
const rxGenerated=/\.(?:class|dex|o|obj|pyc|pyo|dylib|dll|pdb|ilk|idb|exp|lib|a|gcda|gcno|pch|swiftmodule|swiftdoc|swiftinterface|xcactivitylog|pack|idx|rev|bitmap|midx)$/i;
const rxConfig=/\.(?:html?|css|scss|sass|less|md|mdx|txt|ya?ml|toml|ini|properties|xml|jsonc?|config|lock|map|conf|rules|pro|editorconfig|gitignore|gitattributes|npmrc|babelrc|prettierrc|eslintrc|env)$/i;
const generatedPaths=/(?:^|[\\/])(?:node_modules|\.gradle|build|dist|target|intermediates|outputs|\.expo|\.next|\.turbo|sdk|android-sdk|platforms|build-tools|system-images|\.git|coverage|DerivedData|Pods|__pycache__)(?:[\\/]|$)/i;
const highRiskName=/(?:^|[\\/])(?:\.env(?:\..*)?|id_rsa|id_ed25519|[^\\/]*service[-_.]?account[^\\/]*|[^\\/]*firebase-adminsdk[^\\/]*|[^\\/]*secret[^\\/]*|[^\\/]*private[-_.]?key[^\\/]*)$|\.(?:pem|p12|pfx|jks|keystore|key|gpg|asc)$/i;
const knownNoExt=/^(?:Makefile|Dockerfile|LICENSE(?:\..*)?|NOTICE(?:\..*)?|Gemfile|Podfile|Procfile|Jenkinsfile|README|CHANGELOG|gradlew|mvnw|bazel|BUILD|WORKSPACE|CODEOWNERS|CMakeLists\.txt)$/i;
const normV9=p=>String(p).replace(/\\/g,"/");
const ext=p=>{const b=path.basename(p).toLowerCase();if(b.startsWith(".")&&!b.includes(".",1))return "<dotfile>";const x=path.extname(b);return x||"<no extension>";};
function classifyV9(p){
 const n=normV9(p),base=path.basename(p);
 if(highRiskName.test(n))return "sensitive_requires_encrypted_backup";
 if(generatedPaths.test(n)||rxGenerated.test(n))return "likely_regenerable_but_not_yet_proven";
 if(rxSource.test(n)||knownNoExt.test(base))return "source_or_project_build_input";
 if(rxArchive.test(n))return "archives_releases_and_dependencies";
 if(rxData.test(n))return "documents_and_databases";
 if(rxMedia.test(n))return "media_fonts_and_images";
 if(rxConfig.test(n))return "configuration_and_docs";
 return "unknown_must_preserve_until_reviewed";
}


function v9Priority(x){
 const p={sensitive_requires_encrypted_backup:0,source_or_project_build_input:1,
   documents_and_databases:2,configuration_and_docs:3,unknown_must_preserve_until_reviewed:4,
   media_fonts_and_images:5,likely_regenerable_but_not_yet_proven:6,archives_releases_and_dependencies:7};
 return p[x]??9;
}
function selfTest(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"BUKLOD_V13_CHECK_"));
 try{
  const t=path.join(dir,"x.txt");fs.writeFileSync(t,"abc");
  assert(blob(t,3)==="f2ba8f84ab5c1bce84a7b441cb1959cfc7093b7f","Git blob digest incorrect");
  assert(candidateRoot("D:\\BUKLOD_V26_LOCAL_AAB"),"BUKLOD root not recognized");
  assert(!candidateRoot("C:\\Users\\Jose Solis\\Documents"),"User documents incorrectly eligible");
  assert(!candidateRoot("C:\\Users\\Jose Solis\\Desktop"),"Desktop incorrectly eligible");
  assert(riskProtect("D:\\BUKLOD_D_RESCUE\\_PHONE_RESTORE\\x.tar")==="personal",
    "Personal phone restore was not protected");
  assert(riskProtect("D:\\BUKLOD\\config\\.env.production")==="sensitive",
    "App secret not protected");
  assert(riskProtect("D:\\BUKLOD\\android\\gradle.properties")==="sensitive",
    "Gradle credentials must survive local cleanup");
  assert(riskProtect("D:\\BUKLOD\\android\\app\\google-services.json")==="sensitive",
    "Firebase credentials must survive local cleanup");
  assert(generatedDirs.test("node_modules")&&generatedDirs.test("build"),
    "Cache classification invalid");
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
 console.log("SELF TEST PASSED: protected roots, personal/secret guards, Git content hash, cache classification.");
}
if(process.argv.includes("--self-test")){selfTest();process.exit(0)}
function validatedCloudPrerequisites(){
 const st=jread(path.join(BASE,"STATUS.json"));
 const v3=jread(path.join(BASE,"RESUMABLE_REMAINING_ASSETS_V3.json"));
 const v6=jread(path.join(BASE,"ARCHIVE_COMPLETENESS_AND_REPAIR_V6.json"));
 const v7=jread(path.join(BASE,"HISTORICAL_UNIQUE_FILES_V7.json"));
 const v9=jread(path.join(BASE,"HISTORICAL_PRIORITY_PRESERVATION_V9.json"));
 const v10=jread(path.join(BASE,"HISTORICAL_RELEASE_PRESERVATION_V10.json"));
 assert(v3.cloudVerified===true&&v3.volumesVerified>=2,"V3 archive release not verified");
 assert(v6.allAvailableV3CandidatesAccountedFor===true&&v6.v6RepairArchiveVerified===true&&v6.v6RemoteVolumesVerified>=1,
   "V6 repair archive not verified");
 assert(v9.status==="HISTORICAL_PRIORITY_V9_CLOUD_VERIFIED"&&v9.remoteVolumesVerified>=1,
   "V9 historical encrypted archive not verified");
 assert(v10.status==="HISTORICAL_RELEASE_V10_CLOUD_VERIFIED"&&v10.remoteVolumesVerified>=1,
   "V10 historical encrypted archive not verified");
 assert(exec(GH,["api","user","--jq",".login"])==="faust-0612","Unexpected authenticated GitHub account");
 for(const repo of [SOURCE_REPO,VAULT_REPO]){
  const privateRepo=exec(GH,["repo","view",repo,"--json","isPrivate","--jq",".isPrivate"]);
  assert(privateRepo==="true","Expected private GitHub recovery repo not private: "+repo);
 }
 // Canonical BUKLOD-Rork is allowed to be public while app distribution
 // source access is verified independently (no credentials stored there).
 assert(exec(GH,["repo","view",MAIN_REPO,"--json","name","--jq",".name"])==="BUKLOD-Rork",
   "Canonical BUKLOD source repository inaccessible.");
 cloudReleaseVerified(String(v3.remoteRelease).split("/tag/")[1]);
 cloudReleaseVerified(String(v6.repairRelease).split("/tag/")[1]);
 cloudReleaseVerified(String(v9.remoteRelease).split("/tag/")[1]);
 cloudReleaseVerified(String(v10.remoteRelease).split("/tag/")[1]);
 const {source,st:prior}=gitBlobsOfRemoteCheckout();
 const main=gitBlobsOfMain();
 for(const s of main)source.add(s);
 const archived=v3AndV6Blobs(v3),hist=historicalProof(v7,v9,v10);
 return {source,archived,hist,prior};
}
function inventoryRoots(prior){
 const summary=jread(INVENTORY);
 assert(Array.isArray(summary.results)&&summary.results.length>=30,"Original inventory missing");
 const list=[];
 for(const r of summary.results){if(r.root)list.push({path:r.root,group:null})}
 for(const r of prior.recovered||[]){
  if(r.origin&&rootCategories.has(String(r.group||"").toLowerCase()))
   list.push({path:r.origin,group:String(r.group).toLowerCase()});
 }
 const ordered=list.sort((a,b)=>a.path.length-b.path.length);
 const kept=[];
 for(const entry of ordered){
  const abs=path.resolve(entry.path),base=norm(abs);
  if(!fs.existsSync(abs))continue;
  if(!candidateRoot(abs,entry.group!==null)){
   if(records.rejectedRoots.length<35)records.rejectedRoots.push({basename:path.basename(abs),reason:"not an explicitly BUKLOD-scoped root"});
   continue;
  }
  if(kept.some(x=>exactUnder(base,norm(x.path))))continue;
  kept.push({path:abs,group:entry.group});
 }
 records.candidateRoots=list.length;records.acceptedRoots=kept.length;
 assert(kept.length>=2,"No safely identified BUKLOD roots; delete none");
 return kept;
}
function proofType(hash,cloud){
 if(cloud.source.has(hash))return "git";
 if(cloud.archived.has(hash)||cloud.hist.has(hash))return "archive";
 return null;
}
function recordKeep(why,filepath){
 if(why==="sensitive")records.keptSensitive++;
 else if(why==="personal")records.keptPersonal++;
 else if(why==="unproven")records.keptUniqueUnproven++;
 else records.keptOther++;
 if(records.protectedExamples.length<30){
   records.protectedExamples.push({type:why,extension:path.extname(filepath).slice(0,12),
     baseNameCategory:basenameProduct.test(path.basename(filepath))?"buklod-file":"unclassified"});
 }
}
try{
 const execute=process.argv.includes("--execute");
 const cloud=validatedCloudPrerequisites();
 const roots=inventoryRoots(cloud.prior);
 const actions=[],seen=new Set(),dirs=[];
 for(const root of roots){
  const stack=[root.path];
  while(stack.length){
   const target=stack.pop(),base=norm(target);
   let st;try{st=fs.lstatSync(target)}catch{records.unreadable++;continue}
   if(st.isSymbolicLink()){records.skippedSymlinks++;continue}
   if(st.isDirectory()){
     dirs.push(target);
     let entries;
     try{entries=fs.readdirSync(target,{withFileTypes:true})}
     catch{records.unreadable++;continue}
     for(const e of entries){
       if(e.isSymbolicLink()){records.skippedSymlinks++;continue}
       stack.push(path.join(target,e.name));
     }
     continue;
   }
   if(!st.isFile())continue;
   if(seen.has(base))continue;seen.add(base);
   records.filesExamined++;
   assert(records.filesExamined<=LIMIT,"Local scan safety limit exceeded; no deletion");
   if(exactUnder(base,norm(BASE))||exactUnder(base,norm(RECEIPT)))continue;
   if(!roots.some(r=>exactUnder(base,norm(r.path))))throw Error("File escaped approved BUKLOD root");
   const protection=riskProtect(target);
   if(protection){recordKeep(protection,target);continue}
   if(path.basename(target).toLowerCase()==="desktop.ini"||
      path.basename(target).toLowerCase()==="thumbs.db"){recordKeep("misc",target);continue}
   // Known package/cached outputs are safe to regenerate and can be
   // removed without rehashing hundreds of thousands of cached objects.
   // All active/non-generated files MUST match a remote content digest.
   const generated=target.split(/[\\/]/).some(part=>generatedDirs.test(part)) ||
     generatedFiles.test(target);
   let hash=null,proof=null;
   if(!generated){
     try{hash=blob(target,st.size)}catch{records.unreadable++;continue}
     proof=proofType(hash,cloud);
     if(!proof){recordKeep("unproven",target);continue}
   }
   if(proof==="git")records.backedSourceGit++;
   else if(proof==="archive")records.backedEncryptedManifests++;
   else records.generatedEligible++;
   if(proof)records.filesBacked++;
   actions.push({path:target,bytes:st.size,modifiedAt:st.mtimeMs,hash,kind:proof||"regenerable"});
   records.candidateBytes+=st.size;
   if(records.filesExamined%10000===0)
     console.log("Reviewed",records.filesExamined,"files; eligible cleanups:",actions.length);
  }
 }
 records.candidateCount=actions.length;
 records.result="SCAN_COMPLETE";
 persist();
 console.log("BUKLOD SELECTIVE CLEANUP VERIFIED INVENTORY");
 console.log("Root folders:",records.acceptedRoots,"files examined:",records.filesExamined);
 console.log("Cloud-matched Git:",records.backedSourceGit,
   "encrypted backups:",records.backedEncryptedManifests);
 console.log("Regenerable cache files:",records.generatedEligible);
 console.log("Eligible for deletion:",records.candidateCount,"estimated reclaim GiB:",
   (records.candidateBytes/1024**3).toFixed(2));
 console.log("PROTECTED: unique unproven:",records.keptUniqueUnproven,
   "sensitive:",records.keptSensitive,"personal:",records.keptPersonal,
   "other:",records.keptOther);
 console.log("Unopened/invalid files:",records.unreadable,"symlinks:",records.skippedSymlinks);
 console.log("Unresolved original older artifacts and cloud-only build proofs remain PROTECTED.");
 if(!execute){
   records.result="AUDIT_ONLY_NOT_DELETED";persist();
   console.log("AUDIT MODE ONLY. For user-authorized verified cleanup rerun with --execute.");
   process.exit(0);
 }
 assert(records.unreadable===0,"Unreadable items in scoped BUKLOD roots; abort deletion.");
 console.log("Deleting ONLY immutable cloud-matched files or regenerable caches...");
 // The scan occurs before any delete. A source write after scanning makes that
 // file ineligible, ensuring no edits are lost during the cleanup phase.
 for(const a of actions){
   try{
     const st=fs.lstatSync(a.path);
     if(st.isSymbolicLink()||!st.isFile()||st.size!==a.bytes||
        Math.abs(st.mtimeMs-a.modifiedAt)>1500||
        (a.hash!==null&&blob(a.path,st.size)!==a.hash)){
       recordKeep("unproven",a.path);continue;
     }
     // Final containment and private personal/secret gate before unlink.
     assert(!riskProtect(a.path),"Attempt to remove sensitive/personal content");
     assert(roots.some(r=>exactUnder(norm(a.path),norm(r.path))),"Deletion escaped approved root");
     fs.unlinkSync(a.path);
     records.filesDeleted++;records.bytesDeleted+=st.size;
     if(records.filesDeleted%1000===0){
       persist();console.log("Deleted verified copies:",records.filesDeleted);
     }
   }catch(e){
     records.errors.push({fileType:path.extname(a.path),reason:String(e.message).slice(0,140)});
     if(records.errors.length>MAX_ERRORS)throw Error("Too many file-cleanup failures");
   }
 }
 // Empty BUKLOD subfolders may be removed, but files with no proof
 // and ALL parent directories with protected content are never wiped.
 for(const d of dirs.sort((a,b)=>b.length-a.length)){
   if(!roots.some(r=>exactUnder(norm(d),norm(r.path))))continue;
   try{
     if(fs.readdirSync(d).length===0){fs.rmdirSync(d);records.directoriesRemoved++}
   }catch{/* occupied or protected; leave in place */}
 }
 records.result=records.errors.length?"PARTIAL_CLEANUP_WITH_ERRORS":"VERIFIED_COPIES_AND_CACHES_CLEANED";
 persist();
 console.log("BUKLOD VERIFIED LOCAL CLEANUP FINISHED");
 console.log("Local original files deleted:",records.filesDeleted,
   "space reclaimed GiB:",(records.bytesDeleted/1024**3).toFixed(2),
   "empty directories:",records.directoriesRemoved);
 console.log("Preserved unique/unverified, secrets and personal files; no cloud data or production modified.");
 console.log("Remaining contents are not safe for blanket deletion. Exact report:",AUDIT);
}catch(e){
 records.result="SAFETY_BLOCK_OR_PARTIAL";records.errors.push({reason:String(e.message)});persist();
 console.error("SAFETY STOP:",String(e.message));
 console.error("No further deletions attempted. Audit/receipt:",AUDIT);
 process.exitCode=1;
}
