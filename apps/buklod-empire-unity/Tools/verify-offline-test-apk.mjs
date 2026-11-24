// Local offline test artifact verification. No deployment or install.
import {createHash} from 'node:crypto';
import {createReadStream,readFileSync,statSync,writeFileSync,renameSync,existsSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
export function validateArtifact(receipt,badging,signature,entries,bytes,sha){
 const lines=receipt.trim().split(/\r?\n/);
 if(lines.shift()!=="UNAPPROVED_OFFLINE_TEST")throw Error("Wrong build receipt type");
 const fields=new Map();
 for(const line of lines){const at=line.indexOf("=");if(at<=0||fields.has(line.slice(0,at)))throw Error("Invalid build receipt");fields.set(line.slice(0,at),line.slice(at+1));}
 const id="org.mzbministry.buklod.empire.review";
 if(fields.get("package")!==id||fields.get("unity")!=="6000.0.86f1"||fields.get("bytes")!==String(bytes)||fields.get("sha256")!==sha||!(/^[a-f0-9]{64}$/).test(sha))
  throw Error("APK does not match build receipt");
 const packages=[...badging.matchAll(/^package: name='([^']+)'/gm)];
 if(packages.length!==1||packages[0][1]!==id)throw Error("Wrong Android package identity");
 if(!/^application-debuggable\s*$/m.test(badging))throw Error("Not a debug test package");
 if(!/Verified using v[23] scheme[^\r\n]*:\s*true\s*$/mi.test(signature))throw Error("APK v2/v3 signature verification not reported");
 const abis=new Set(entries.filter(x=>x.startsWith("lib/")&&x.endsWith(".so")).map(x=>x.split("/")[1]));
 if(abis.size!==1||!abis.has("arm64-v8a"))throw Error("Expected ARM64-only native libraries");
 for(const name of ["libunity.so","libil2cpp.so","libmain.so"])if(!entries.includes("lib/arm64-v8a/"+name))throw Error("Missing Unity native library: "+name);
 if(!entries.includes("AndroidManifest.xml")||!entries.some(x=>x.startsWith("assets/bin/Data/")))throw Error("Missing Android/Unity player assets");
 if(new Set(entries).size!==entries.length)throw Error("Duplicate ZIP paths");
 return {status:"VERIFIED_ISOLATED_TEST_ARTIFACT",package:id,bytes,sha256:sha,architecture:"arm64-v8a",signatureVerified:true,deviceVerified:false,productionApproved:false};
}
const self=fileURLToPath(import.meta.url);
if(process.argv[1]&&resolve(process.argv[1])===self){
 const [apkArg,toolsArg]=process.argv.slice(2);
 if(!apkArg||!toolsArg||process.argv.length!==4)throw Error("Usage: node Tools/verify-offline-test-apk.mjs <apk> <Android SDK build-tools version directory>");
 const apk=resolve(apkArg),tools=resolve(toolsArg),out=apk+".verified.json";
 if(existsSync(out))unlinkSync(out);
 const aapt=join(tools,process.platform==="win32"?"aapt.exe":"aapt"),jar=join(tools,"lib","apksigner.jar");
 const java=process.env.JAVA_HOME?join(process.env.JAVA_HOME,"bin",process.platform==="win32"?"java.exe":"java"):"java";
 const python=process.env.PYTHON||"python3";
 const command=(name,args)=>execFileSync(name,args,{encoding:"utf8",timeout:180000,maxBuffer:16*1024*1024});
 const receipt=readFileSync(apk+".build.txt","utf8"),before=statSync(apk);
 const badging=command(aapt,["dump","badging",apk]);
 const sig=command(java,["-jar",jar,"verify","--verbose","--print-certs",apk]);
 const entries=JSON.parse(command(python,["-c","import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps(z.namelist()))",apk]));
 const h=createHash("sha256");for await(const chunk of createReadStream(apk))h.update(chunk);
 const after=statSync(apk);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error("APK changed during verification");
 const result=validateArtifact(receipt,badging,sig,entries,after.size,h.digest("hex"));
 writeFileSync(out+".tmp",JSON.stringify(result,null,2)+"\n");renameSync(out+".tmp",out);
 console.log(JSON.stringify(result,null,2));
}
