#!/usr/bin/env node
/**
 * BUKLOD V8 — classify V7 unique historical files before deciding cloud archival.
 * Read-only against original C:/D: paths. Outputs a LOCAL audit, not GitHub content.
 * Never delete, copy, upload, or silently declare any unique file disposable.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const ROOT=path.join(process.env.TEMP||os.tmpdir(),"BUKLOD_CONSOLIDATED_CLOUD_MIGRATION");
const src=path.join(ROOT,"HISTORICAL_UNIQUE_FILES_V7.json");
const out=path.join(ROOT,"HISTORICAL_CLASSIFICATION_V8.json");
const GiB=1024**3;
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
function add(a,k,bytes){
 const t=a[k]||(a[k]={files:0,bytes:0});
 t.files++;t.bytes+=bytes;
}
const result={
 schema:"buklod-historical-unique-classification/v8",created:new Date().toISOString(),
 phase:"read-only breakdown of historical unique content",
 status:"NOT_STARTED",sourceFile:"HISTORICAL_UNIQUE_FILES_V7.json",
 originalProjectFilesDeleted:0,filesUploaded:0,
 sourceCoverageAlreadyVerified:false,
 actualRemoteRestoreVerified:false,
 safeToDeleteLocal:false,
 previousUnitemizedExclusions:0,
 expectedUniqueFiles:0,inspectedUniqueFiles:0,expectedBytes:0,
 classifications:{},extensions:{},rootFamilies:{},sizes:{},
  topLargest:[],fileChangedOrMissing:[],changedOrMissingCount:0,contentBytesToReview:0,
  uniquePreservationCandidateCount:0,action:"CLASSIFICATION_ONLY_NO_ARCHIVING",
  errors:[]
};
function save(){fs.writeFileSync(out,JSON.stringify(result,null,2))}
function ensure(x,msg){if(!x)throw Error(msg)}
function selfTest(){
 const tests=[
 ["C:\\BUKLOD\\src\\App.tsx","source_or_project_build_input"],
 ["D:\\BUKLOD\\images\\portrait.webp","media_fonts_and_images"],
 ["D:\\BUKLOD\\old\\grades.xlsx","documents_and_databases"],
 ["C:\\BUKLOD\\BUKLOD_v27.aab","archives_releases_and_dependencies"],
 ["D:\\BUKLOD\\android\\build\\classes.dex","likely_regenerable_but_not_yet_proven"],
 ["C:\\BUKLOD\\config\\.env.production","sensitive_requires_encrypted_backup"],
 ["D:\\BUKLOD\\importantblob","unknown_must_preserve_until_reviewed"],
 ["D:\\BUKLOD\\config.json","configuration_and_docs"]
 ];
 for(const [p,expected] of tests)ensure(classify(p)===expected,"Classification fixture failed for "+p);
 console.log("SELF TEST PASSED: historical type classification, sensitive filename gate, unknown retention.");
}
if(process.argv.includes("--self-test")){selfTest();process.exit(0)}
try{
 ensure(fs.existsSync(src),"V7 historical parity report not found");
 const v7=JSON.parse(fs.readFileSync(src,"utf8"));
 ensure(v7.status==="HISTORICAL_PARITY_AUDITED_PRESERVATION_PENDING","V7 parity status not verified");
 ensure(v7.scanComplete===true&&v7.unreadable?.length===0&&v7.missingRoots?.length===0,
   "V7 scan did not cover all known historical roots");
 ensure(Array.isArray(v7.uniqueFileRecords),"V7 per-file records absent");
 ensure(v7.uniqueFileRecords.length===v7.uniqueFiles,"V7 unique file accounting mismatch");
 result.expectedUniqueFiles=v7.uniqueFiles;result.expectedBytes=v7.uniqueBytes;
 result.previousUnitemizedExclusions=v7.previousExclusionsUnitemized||0;
 result.sourceCoverageAlreadyVerified=true;
 const names=new Set();
 for(const f of v7.uniqueFileRecords){
   ensure(typeof f.originalPath==="string"&&f.originalPath.length>4,"Invalid historical source path");
   ensure(Number.isSafeInteger(f.bytes)&&f.bytes>=0,"Invalid historical file byte count");
   ensure(/^[a-f0-9]{40}$/.test(f.gitBlob),"Missing historical content SHA-1 identity");
   const key=path.resolve(f.originalPath).toLowerCase();
   ensure(!names.has(key),"Duplicate original path in V7 candidates");names.add(key);
   result.inspectedUniqueFiles++;
   const kind=classify(f.originalPath);
   const top=norm(f.originalPath).split("/").slice(0,4).join("/").replace(/^[a-z]:/i,"<volume>");
   add(result.classifications,kind,f.bytes);
   add(result.extensions,ext(f.originalPath),f.bytes);
   add(result.rootFamilies,top,f.bytes);
   result.contentBytesToReview+=f.bytes;
   // Read metadata only. Never modify original project files.
   try{
     const st=fs.statSync(f.originalPath);
     if(!st.isFile()||st.size!==f.bytes||Math.abs(st.mtimeMs-f.mtimeMs)>1500){
       result.changedOrMissingCount++;
       if(result.fileChangedOrMissing.length<50)result.fileChangedOrMissing.push({type:"changed-since-v7",extension:ext(f.originalPath),size:f.bytes});
     }
   }catch{
     result.changedOrMissingCount++;
     if(result.fileChangedOrMissing.length<50)result.fileChangedOrMissing.push({type:"missing-or-unreadable",extension:ext(f.originalPath),size:f.bytes});
   }
   result.topLargest.push({category:kind,extension:ext(f.originalPath),bytes:f.bytes});
 }
 result.uniquePreservationCandidateCount=result.inspectedUniqueFiles;
 ensure(result.inspectedUniqueFiles===result.expectedUniqueFiles,"File count drift from V7");
 ensure(result.contentBytesToReview===result.expectedBytes,"Historical byte total drift from V7");
 result.topLargest.sort((a,b)=>b.bytes-a.bytes);result.topLargest=result.topLargest.slice(0,25);
 const histogram={};
 for(const [name,d] of Object.entries(result.classifications)){
  const bin=name==="likely_regenerable_but_not_yet_proven"?"requires_regeneration_proof":"must_preserve_or_explicitly_review";
  const entry=histogram[bin]||(histogram[bin]={files:0,bytes:0});
  entry.files+=d.files;entry.bytes+=d.bytes;
 }
 result.candidateDisposition=histogram;
 result.status=result.changedOrMissingCount?"CLASSIFIED_WITH_CHANGED_OR_MISSING_ORIGINALS":"CLASSIFICATION_COMPLETE_NO_UPLOAD";
 save();
 console.log("BUKLOD V8 HISTORICAL CLASSIFICATION COMPLETE (READ-ONLY)");
 console.log("Unique original files:",result.expectedUniqueFiles,"bytes:",(result.expectedBytes/1024**3).toFixed(2),"GiB");
 for(const [name,d] of Object.entries(result.classifications).sort((a,b)=>b[1].bytes-a[1].bytes))
   console.log(name+":",d.files,"files,",(d.bytes/1024**3).toFixed(2),"GiB");
 console.log("TOP EXTENSIONS BY BYTES:");
 for(const [name,d] of Object.entries(result.extensions).sort((a,b)=>b[1].bytes-a[1].bytes).slice(0,18))
   console.log(" ",name,":",d.files,"files,",(d.bytes/1024**3).toFixed(2),"GiB");
 console.log("TOP ROOT FAMILIES BY BYTES:");
 for(const [name,d] of Object.entries(result.rootFamilies).sort((a,b)=>b[1].bytes-a[1].bytes).slice(0,8))
   console.log(" ",name,":",d.files,"files,",(d.bytes/1024**3).toFixed(2),"GiB");
 console.log("Changed or missing original candidates:",result.changedOrMissingCount);
 console.log("Previous unitemized exclusions STILL unresolved:",result.previousUnitemizedExclusions);
 console.log("Private local report:",out);
 console.log("NO UPLOAD, NO DELETION. Unique historical files still require a proven cloud recovery disposition.");
}catch(e){
 result.status="CLASSIFICATION_BLOCKED";result.errors.push(String(e.message));save();
 console.error("SAFE STOP:",String(e.message));console.error("No local project files changed. Report:",out);
 process.exitCode=1;
}
