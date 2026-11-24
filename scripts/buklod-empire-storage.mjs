#!/usr/bin/env node
/** DEV-only Storage REST API. Never mutate storage metadata through SQL.
 * Run from trusted owner environment. No credentials in command arguments,
 * logs, APK or Git repository. Service credential remains in process env. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createPublicKey,verify} from 'node:crypto';
import path from 'node:path';
const origin='https://yhanxndaqbmuzbdqlblu.supabase.co/storage/v1';
const bucket='empire-updates';
const max=32*1024*1024;
const hash=b=>createHash('sha256').update(b).digest('hex');
const credential=process.env.BUKLOD_EMPIRE_STORAGE_SERVICE_KEY;
assert.ok(credential,'Owner-authorized MAIN Storage service credential required');
const auth={apikey:credential,Authorization:'Bearer '+credential};
async function http(url,options={}){
 return fetch(origin+url,{...options,redirect:'error',signal:AbortSignal.timeout(90000)});
}
function safeResult(response,label){
 assert.ok(response.ok,label+' HTTP '+response.status);
 return response;
}
async function readBucket(){
 const r=await http('/bucket/'+bucket,{headers:auth});
 if(r.status===404)return null;
 return safeResult(r,'Read dedicated bucket').json();
}
async function ensureBucket(){
 let b=await readBucket();
 if(!b){
  const r=await http('/bucket',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({id:bucket,name:bucket,public:true,file_size_limit:max,allowed_mime_types:['application/json','application/zip']})});
  safeResult(r,'Create dedicated bucket');
  b=await readBucket();
 }
 assert.equal(b.id,bucket);assert.equal(b.public,true);
 assert.equal(Number(b.file_size_limit),max,'Existing bucket cap differs; no automatic modification');
 assert.deepEqual([...b.allowed_mime_types].sort(),['application/json','application/zip']);
 console.log('EMPIRE_STORAGE_BUCKET_VERIFIED',bucket,'limit',max);
}
const command=process.argv[2];
if(command==='provision'){await ensureBucket();}
else if(command==='publish-dev'){
 const [baselineFile,packDir]=process.argv.slice(3);
 assert.ok(baselineFile&&packDir);
 const baseline=JSON.parse(readFileSync(baselineFile,'utf8'));
 assert.equal(baseline.channel,'dev');assert.equal(baseline.runtime,'empire-godot-4.7.2-r1');
 assert.match(baseline.base,/^[a-f0-9]{64}$/);
 assert.equal(hash(JSON.stringify(baseline.inventory)),baseline.base);
 const publicKey=createPublicKey(process.env.BUKLOD_EMPIRE_OTA_PUBLIC_KEY||'');
 assert.equal(hash(publicKey.export({type:'spki',format:'der'})),baseline.keyFingerprint);
 function verified(bytes){
  assert.ok(bytes.length<=65536);
  const e=JSON.parse(bytes);const p=Buffer.from(e.payload,'base64');
  assert.ok(verify('sha256',p,publicKey,Buffer.from(e.signature,'base64')),'Invalid signature');
  const d=JSON.parse(p);assert.equal(d.schema,1);assert.equal(d.package,'org.mzbministry.buklod.empire');
  assert.equal(d.channel,'dev');assert.equal(d.runtime,baseline.runtime);assert.equal(d.base,baseline.base);
  assert.ok(Number.isSafeInteger(d.sequence)&&d.sequence>0&&d.sequence<=2147483647);
  assert.ok(Number.isSafeInteger(d.bytes)&&d.bytes>=22&&d.bytes<=max);
  assert.match(d.sha256,/^[a-f0-9]{64}$/);
  return d;
 }
 const manifest=readFileSync(path.join(packDir,'manifest.json'));const d=verified(manifest);
 const zip=readFileSync(path.join(packDir,d.sha256+'.zip'));
 assert.equal(zip.length,d.bytes);assert.equal(hash(zip),d.sha256);
 await ensureBucket();
 const prefix=bucket+'/dev/'+baseline.base+'/';
 const readPublic=async(name)=>http('/object/public/'+prefix+name,{headers:{'Cache-Control':'no-cache'}});
 const readAdmin=async(name)=>http('/object/'+prefix+name,{headers:auth});
 const old=await readAdmin('manifest.json');
 if(old.ok){
  const previous=verified(Buffer.from(await old.arrayBuffer()));
  assert.ok(d.sequence>previous.sequence||(d.sequence===previous.sequence&&d.sha256===previous.sha256),'Refusing downgrade or conflicting sequence');
 }else assert.equal(old.status,404,'Manifest read failed; never overwrite uncertain state');
 const name=d.sha256+'.zip';
 const existing=await readAdmin(name);
 if(existing.ok)assert.equal(hash(Buffer.from(await existing.arrayBuffer())),d.sha256);
 else{
  assert.equal(existing.status,404,'Existing content read uncertain');
  const uploaded=await http('/object/'+prefix+name,{method:'POST',headers:{...auth,'Content-Type':'application/zip','Cache-Control':'31536000','x-upsert':'false'},body:zip});
  safeResult(uploaded,'Immutable pack upload');
 }
 const publicPack=safeResult(await readPublic(name),'Public pack readback');
 assert.equal(hash(Buffer.from(await publicPack.arrayBuffer())),d.sha256,'Public pack mismatch');
 // Single owner-controlled publisher; manifest is written only after verified immutable content.
 const written=await http('/object/'+prefix+'manifest.json',{method:'POST',headers:{...auth,'Content-Type':'application/json','Cache-Control':'0','x-upsert':'true'},body:manifest});
 safeResult(written,'DEV manifest publication');
 const receipt=verified(Buffer.from(await safeResult(await readPublic('manifest.json'),'Public manifest readback').arrayBuffer()));
 assert.equal(receipt.sequence,d.sequence);assert.equal(receipt.sha256,d.sha256);
 console.log('EMPIRE_DEV_OTA_PUBLIC_READBACK_VERIFIED',JSON.stringify({base:d.base,sequence:d.sequence,sha256:d.sha256,bytes:d.bytes}));
}else throw Error('Use provision or publish-dev <baseline.json> <signed-pack-directory>');
