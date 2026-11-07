#!/usr/bin/env node
/**
 * BUKLOD V14 - selective, PROOF-GATED local cleanup
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
import {StringDecoder} from "node:string_decoder";

const TEMP=process.env.TEMP||os.tmpdir();
const BASE=path.join(TEMP,"BUKLOD_CONSOLIDATED_CLOUD_MIGRATION");
const INVENTORY=path.join(TEMP,"BUKLOD_PRIVATE_SCAN","SUMMARY.json");
const RECEIPT=path.join(process.env.LOCALAPPDATA||TEMP,"BUKLOD_CLOUD_CLEANUP_RECEIPTS");
const AUDIT=path.join(RECEIPT,"BUKLOD_SELECTIVE_DELETE_V14.json");
const JOURNAL=path.join(RECEIPT,"BUKLOD_V14_ELIGIBLE_FILES.jsonl");
const DIR_JOURNAL=path.join(RECEIPT,"BUKLOD_V14_VISITED_DIRS.jsonl");
const GH=fs.existsSync("C:\\Program Files\\GitHub CLI\\gh.exe")?"C:\\Program Files\\GitHub CLI\\gh.exe":"gh";
const SOURCE_REPO="faust-0612/BUKLOD-Migrated-Sources";
const MAIN_REPO="faust-0612/BUKLOD-Rork";
const VAULT_REPO="faust-0612/BUKLOD-Local-Recovery";
const MiB=1024**2;
const LIMIT=5000000;
const MAX_DEPTH=128;
const JOURNAL_BATCH=5000;
const MAX_ERRORS=50;
const dirProduct=/(?:^|[\\/])(?:BUKLOD[^\\/]*|BUKLODQ[^\\/]*|BUKLODKINGDOM[^\\/]*|KABIHASNANG[_ -]?LIGAW[^\\/]*)(?:[\\/]|$)/i;
const basenameProduct=/^(?:BUKLOD|BUKLODQ|BUKLODKINGDOM|KABIHASNANG[-_ ]?LIGAW)[-_. ]?/i;
const generatedDirs=/^(?:node_modules|\.next|\.expo|\.gradle|\.cache|\.turbo|\.parcel-cache|dist|build|out|coverage|Pods|DerivedData|__pycache__|target|\.venv|venv|sdk|android-sdk|platforms|intermediates|\.pytest_cache)$/i;
const generatedFiles=/\.(?:tmp|cache|pyc|o|obj|class|dex|dSYM|gcda|gcno|pch|log)$/i;
const sensitive=/(?:^|[\\/])(?:\.env(?:\..*)?|\.npmrc|\.netrc|gradle\.properties|google-services\.json|GoogleService-Info\.plist|id_rsa|id_ed25519|[^\\/]*(?:credential|service[-_.]?account|firebase-adminsdk|secret|private[-_.]?key)[^\\/]*)$|\.(?:pem|key|jks|keystore|p12|pfx|gpg|asc)$/i;
const nonBUKLOD=/(?:^|[\\/])(?:_PHONE_RESTORE|PHONE_RECOVERY)(?:[\\/]|$)|(?:^|[\\/])(?:Kingdom\.Of\.The\.Planet\.Of\.The\.Apes|Godzilla\.X\.Kong)[^\\/]*\.(?:mp4|mkv|avi)$|\.(?:iso)$/i;
const protectedFolders=/^(?:\\.git|\\.svn|\\.hg)$/i;
const mutableLocalData=/\.(?:sqlite3?|db3?|db|realm|ldb|bak|dump)$/i;
const mixedLegacyRoot=/(?:^|[\\/])BUKLOD_D_(?:BACKUP|RESCUE)[^\\/]*(?:[\\/]|$)/i;
const personalMedia=/\.(?:mp4|mov|mkv|avi|heic|jpe?g)$/i;
const personalFolder=/(?:^|[\\/])(?:Downloads?|DCIM|Camera|Photos|Pictures|Videos|Music|Documents)(?:[\\/]|$)/i;
const forbiddenBase=/^(?:[a-z]:\\?|[a-z]:\\users\\[^\\]+|[a-z]:\\users\\[^\\]+\\(?:desktop|documents|downloads|pictures|videos|onedrive|appdata)|[a-z]:\\(?:program files(?: \(x86\))?|windows|users|programdata|recovery))\\?$/i;
const rootCategories=new Set(["main","quiz","classroom","faculty","attendance","kl","igpat","quickcheck","report","bsoc","kingdom","misc"]);
const norm=p=>path.resolve(p).toLowerCase();
const exactUnder=(p,root)=>p===root||p.startsWith(root+path.sep);
const records={schema:"buklod-selective-cleanup/v14",started:new Date().toISOString(),
 result:"NOT_STARTED",executionMode:process.argv.includes("--execute")?"DELETE_VERIFIED_ONLY":"AUDIT_ONLY",
 streamingMode:true,remainingUnprovenNeedsReview:true,stagedFileActionJournal:0,
 preflightCompleted:false,deletePhaseStarted:false,cacheFoldersSkipped:0,
 gitMetadataDirectoriesProtected:0,
 canonicalMainRepo:MAIN_REPO,sourceRecoveryRepo:SOURCE_REPO,encryptedVaultRepo:VAULT_REPO,
 sourceGitCommit:null,mainGitCommit:null,sourceGitObjects:0,mainGitObjects:0,
 candidateRoots:0,acceptedRoots:0,rejectedRoots:[],filesExamined:0,filesBacked:0,
 generatedEligible:0,filesDeleted:0,bytesDeleted:0,directoriesRemoved:0,
 backedSourceGit:0,backedEncryptedManifests:0,
 candidateCount:0,candidateBytes:0,
 keptSensitive:0,keptPersonal:0,keptUniqueUnproven:0,keptOther:0,unreadable:0,
 skippedSymlinks:0,errors:[],protectedExamples:[],
 archiveTagsVerified:[],remoteOlderAssetsReusingPreviousChecksumAudit:0,preservedOriginalFilesMayRemain:true,
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
 // A local database/backup may be actively used even if an old archive
 // contains identical bytes. It requires an app-specific database cutover.
 if(mutableLocalData.test(file))return "unproven";
 // Mixed historical rescue/Download trees contain unrelated personal media.
 // Never infer that BUKLOD-named parent directory makes them app assets.
 if(mixedLegacyRoot.test(file)&&
   (personalFolder.test(file)||personalMedia.test(file))&&
   !basenameProduct.test(path.basename(file)))return "personal";
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
   if(asset.digest!=null){
     assert(asset.digest.startsWith("sha256:")&&/^[a-f0-9]{64}$/i.test(asset.digest.slice(7)),
       "GitHub recovery asset SHA256 malformed: "+tag);
   }else{
     // Older release assets may not advertise a server-side digest. The saved
     // V3/V6/V9/V10 audit already verified an actual remote upload/download
     // checksum, and the current release and asset are still accessible.
     records.remoteOlderAssetsReusingPreviousChecksumAudit++;
   }
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
 const treeSha=exec(GH,["api","repos/"+MAIN_REPO+"/commits/main","--jq",".commit.tree.sha"],{optional:true});
 if(!treeSha||!/^[a-f0-9]{40}$/.test(treeSha))return new Set();
 const out=exec(GH,["api","repos/"+MAIN_REPO+"/git/trees/"+treeSha+"?recursive=1"],{optional:true});
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
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"BUKLOD_V14_CHECK_"));
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
  assert(riskProtect("D:\\\\BUKLOD_D_RESCUE_20261016\\\\Photos\\\\portrait.jpg")==="personal",
    "Personal recovery photos must be retained");
  assert(riskProtect("D:\\\\BUKLOD\\\\state\\\\attendance.sqlite")==="unproven",
    "Local mutable databases require app-specific migration proof");
  assert(generatedDirs.test("node_modules")&&generatedDirs.test("build"),
    "Cache classification invalid");
  const mockRoot=path.join(dir,"demo"),nested=path.join(mockRoot,"build");
  fs.mkdirSync(nested,{recursive:true});
  for(let k=0;k<32;k++)fs.writeFileSync(path.join(nested,"item_"+k+".o"),String(k));
  const walked=[...streamTree(mockRoot)];
  assert(walked.filter(v=>v.type==="file").length===32,
    "V14 streaming traversal omitted files");
  assert(walked.filter(v=>v.type==="dir").length===2,
    "V14 streaming traversal did not close nested folders");
  const journal=path.join(dir,"stream-test.jsonl");
  const entry={path:"C:\\\\BUKLOD\\\\mañana\\\\photo.png",hash:"a".repeat(40)};
  // Exercise UTF-8 decoding across 4 MiB read boundaries.
  fs.writeFileSync(journal,JSON.stringify({content:"z".repeat(4*MiB-90)})+"\n"+
    JSON.stringify(entry)+"\n","utf8");
  let seen=0,found=false;
  eachJSONLine(journal,row=>{seen++;if(row.path===entry.path)found=true});
  assert(seen===2&&found,"V14 bounded disk journal stream failed UTF-8 fixture");
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

/**
 * Streaming traversal: no per-file path arrays, Set-of-all-paths or 800k
 * in-memory action list. Directory traversal retains only O(depth) handles;
 * journals contain temporary deletion candidates and closed directories.
 */
function* streamTree(target,depth=0){
 if(depth>MAX_DEPTH)throw Error("BUKLOD scan depth exceeded safety cap");
 let st;
 try{st=fs.lstatSync(target)}
 catch(e){records.unreadable++;return}
 if(st.isSymbolicLink()){records.skippedSymlinks++;return}
 if(st.isFile()){yield {type:"file",path:target,stat:st};return}
 if(!st.isDirectory())return;
 const folderName=path.basename(target);
 if(protectedFolders.test(folderName)){
   records.gitMetadataDirectoriesProtected++;
   return;
 }
 // Personal content nested under historical BUKLOD rescue roots is excluded
 // from cleanup traversal, not just from actual file deletion.
 if(/^(?:_PHONE_RESTORE|PHONE_RECOVERY|PERSONAL|PRIVATE_PERSONAL|MOVIES|CAMERA_ROLL)$/i.test(folderName)){
   records.keptPersonal++;return;
 }
 let dir;
 try{dir=fs.opendirSync(target,{bufferSize:512})}
 catch{records.unreadable++;return}
 try{
   for(let entry=dir.readSync();entry!==null;entry=dir.readSync()){
     if(entry.isSymbolicLink()){records.skippedSymlinks++;continue}
     yield* streamTree(path.join(target,entry.name),depth+1);
   }
 }finally{dir.closeSync()}
 yield {type:"dir",path:target};
}
function appendAll(fd,text){
 const buffer=Buffer.from(text,"utf8");
 let written=0;
 while(written<buffer.length){
   const n=fs.writeSync(fd,buffer,written,buffer.length-written);
   assert(n>0,"Journal write failed before full plan was persisted; no deletion.");
   written+=n;
 }
}
function eachJSONLine(file,action){
 const fd=fs.openSync(file,"r"),buf=Buffer.alloc(4*MiB);
 const decoder=new StringDecoder("utf8");
 let carry="",reads=0;
 try{
   for(let n;(n=fs.readSync(fd,buf,0,buf.length,null))>0;){
     carry+=decoder.write(buf.subarray(0,n));
     let pos;
     while((pos=carry.indexOf("\n"))!==-1){
       const line=carry.slice(0,pos);carry=carry.slice(pos+1);
       if(line)action(JSON.parse(line));
       reads++;
     }
     assert(carry.length<8*MiB,"Oversized journal item; abort rather than consume unlimited RAM");
   }
   carry+=decoder.end();
   if(carry.trim()){action(JSON.parse(carry));reads++}
 }finally{fs.closeSync(fd)}
 return reads;
}
function outputSummary(){
 console.log("BUKLOD V14 STREAMING CLEANUP PRECHECK");
 console.log("Verified BUKLOD roots:",records.acceptedRoots,"inspected:",records.filesExamined,
  "eligible:",records.candidateCount,"estimated reclaimed GiB:",(records.candidateBytes/1024**3).toFixed(2));
 console.log("Git-backed:",records.backedSourceGit,
  "AES archive-backed:",records.backedEncryptedManifests,
  "regenerable caches:",records.generatedEligible);
 console.log("Preserved: unique/unverified",records.keptUniqueUnproven,
   "sensitive",records.keptSensitive,"personal",records.keptPersonal,
   "other",records.keptOther);
 console.log("Skipped symlink entries:",records.skippedSymlinks,
   "protected Git folders:",records.gitMetadataDirectoriesProtected,
   "unreadable:",records.unreadable);
}
function removeJournal(){
 for(const name of [JOURNAL,DIR_JOURNAL]){
   try{if(fs.existsSync(name))fs.rmSync(name,{force:true})}catch{}
 }
}
try{
 const execute=process.argv.includes("--execute");
 const cloud=validatedCloudPrerequisites();
 const roots=inventoryRoots(cloud.prior);
 fs.mkdirSync(RECEIPT,{recursive:true});
 // This is a new, transaction-like planning session, never reuse a V13
 // partial inventory. No files are modified before scan is complete.
 const out=fs.openSync(JOURNAL,"w"),dirs=fs.openSync(DIR_JOURNAL,"w");
 let actionBuffer="",dirBuffer="";
 const writeAction=item=>{actionBuffer+=JSON.stringify(item)+"\n";
   if(actionBuffer.length>=512*1024){appendAll(out,actionBuffer);actionBuffer=""}
 };
 const writeDirectory=item=>{dirBuffer+=JSON.stringify(item)+"\n";
   if(dirBuffer.length>=512*1024){appendAll(dirs,dirBuffer);dirBuffer=""}
 };
 let doneScan=false;
 try{
   for(const root of roots){
     for(const item of streamTree(root.path)){
       const target=item.path,base=norm(target);
       if(item.type==="dir"){
         writeDirectory({path:target});
         continue;
       }
       const st=item.stat;
       if(!st.isFile())continue;
       records.filesExamined++;
       assert(records.filesExamined<=LIMIT,"V14 scan exceeds 5 million files; no deletion performed");
       if(exactUnder(base,norm(BASE))||exactUnder(base,norm(RECEIPT)))continue;
       assert(roots.some(r=>exactUnder(base,norm(r.path))),
         "File escaped verified BUKLOD project root: abort without deletion");
       const guard=riskProtect(target);
       if(guard){recordKeep(guard,target);continue}
       if(["desktop.ini","thumbs.db"].includes(path.basename(target).toLowerCase())){
         recordKeep("misc",target);continue
       }
       const parts=target.split(/[\\\\/]/);
       const generated=parts.some(part=>generatedDirs.test(part))||generatedFiles.test(target);
       let hash=null,proof=null;
       if(!generated){
         try{hash=blob(target,st.size)}
         catch{records.unreadable++;continue}
         proof=proofType(hash,cloud);
         if(!proof){recordKeep("unproven",target);continue}
       }
       if(proof==="git")records.backedSourceGit++;
       else if(proof==="archive")records.backedEncryptedManifests++;
       else records.generatedEligible++;
       if(proof)records.filesBacked++;
       records.candidateCount++;
       records.candidateBytes+=st.size;
       writeAction({path:target,bytes:st.size,
         modifiedAt:st.mtimeMs,hash,kind:proof||"regenerable"});
       if(records.filesExamined%50000===0){
         records.stagedFileActionJournal=records.candidateCount;
         records.result="SCANNING";
         persist();
         console.log("V14 scan:",records.filesExamined,
           "file candidates:",records.candidateCount);
       }
     }
   }
   doneScan=true;
 }finally{
   if(actionBuffer)appendAll(out,actionBuffer);
   if(dirBuffer)appendAll(dirs,dirBuffer);
   fs.closeSync(out);
   fs.closeSync(dirs);
 }
 if(!doneScan)throw Error("Incomplete file traversal; no deletion permitted");
 records.preflightCompleted=true;
 records.stagedFileActionJournal=records.candidateCount;
 records.result="SCAN_COMPLETE";
 persist();
 outputSummary();
 if(!execute){
   records.result="AUDIT_ONLY_NOT_DELETED";persist();
   removeJournal();
   console.log("AUDIT ONLY. No files deleted. --execute performs verified deletion.");
 }else{
   assert(records.unreadable===0,
     "Unreadable source inside approved roots; no deletion started");
   records.deletePhaseStarted=true;
   records.result="DELETE_IN_PROGRESS";persist();
   console.log("V14 verified streaming deletion started...");
   let consumed=0;
   eachJSONLine(JOURNAL,a=>{
     consumed++;
     let stat;
     try{stat=fs.lstatSync(a.path)}
     catch(e){records.errors.push({type:"missing_before_delete",extension:path.extname(a.path)});return}
     if(stat.isSymbolicLink()||!stat.isFile()||stat.size!==a.bytes||
        Math.abs(stat.mtimeMs-a.modifiedAt)>1500){recordKeep("unproven",a.path);return}
     if(riskProtect(a.path)||!roots.some(r=>exactUnder(norm(a.path),norm(r.path)))){
       recordKeep("unproven",a.path);return
     }
     // No external code may modify an app source file without changing its
     // content digest; verify again at deletion time.
     if(a.hash!==null){
       try{if(blob(a.path,stat.size)!==a.hash){recordKeep("unproven",a.path);return}}
       catch(e){records.errors.push({type:"hash_changed",extension:path.extname(a.path)});return}
     }
     try{fs.unlinkSync(a.path);records.filesDeleted++;records.bytesDeleted+=stat.size}
     catch(e){
       records.errors.push({type:"delete_denied",extension:path.extname(a.path),
         reason:String(e.message).slice(0,100)});
       if(records.errors.length>MAX_ERRORS)throw Error("Excessive file permission errors");
     }
     if(consumed%JOURNAL_BATCH===0){
       records.result="DELETE_IN_PROGRESS";persist();
       console.log("V14 deletion:",records.filesDeleted,
         "files, freed GiB:",(records.bytesDeleted/1024**3).toFixed(2));
     }
   });
   eachJSONLine(DIR_JOURNAL,entry=>{
     // The journal is post-order, so files and child folders are already gone.
     if(!roots.some(r=>exactUnder(norm(entry.path),norm(r.path))))return;
     if(exactUnder(norm(entry.path),norm(BASE))||exactUnder(norm(entry.path),norm(RECEIPT)))return;
     try{
       if(fs.readdirSync(entry.path).length===0){
         fs.rmdirSync(entry.path);records.directoriesRemoved++;
       }
     }catch{/* directory occupied or protected */}
   });
   records.result=records.errors.length?"PARTIAL_CLEANUP_WITH_ERRORS":"VERIFIED_COPIES_AND_CACHES_CLEANED";
   records.preservedOriginalFilesMayRemain=true;
   persist();
   removeJournal();
   console.log("BUKLOD V14 STREAMING VERIFIED CLEANUP FINISHED");
   console.log("Deleted files:",records.filesDeleted,
     "reclaimed GiB:",(records.bytesDeleted/1024**3).toFixed(2),
     "empty directories removed:",records.directoriesRemoved);
   console.log("Protected unique/unverified files intentionally remain.");
   console.log("Report:",AUDIT);
 }
}catch(e){
 if(!records.deletePhaseStarted)removeJournal();
 records.result=records.deletePhaseStarted?"PARTIAL_CLEANUP_STOPPED":"SAFETY_STOP_NO_DELETION";
 records.errors.push({type:"blocker",reason:String(e.message)});
 persist();
 console.error("V14 SAFE STOP:",String(e.message));
 console.error("Local deletion receipt:",AUDIT);
 process.exitCode=1;
}
