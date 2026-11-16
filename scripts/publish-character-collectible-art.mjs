#!/usr/bin/env node
/* Operator-only BUKLOD Character art publisher.
 * Dry run by default. No client/service credentials are written to source.
 * Run from a trusted runner AFTER the storage bucket migration and RC gates.
 *
 * node scripts/publish-character-collectible-art.mjs DIR
 * BUKLOD_ART_PUBLISH_APPROVED=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
 * BUKLOD_ART_EXPECTED_PROJECT_REF=... BUKLOD_ART_EXPECTED_MANIFEST_SHA256=...
 *   node scripts/publish-character-collectible-art.mjs DIR --publish
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {validateArtManifest,expectedEntries} from './validate-character-collectible-art.mjs';

const BUCKET='buklod-character-art-v1';
const MARKER='published-v1.json';
const SOURCE_CATALOGUE='BUKLOD_CHARACTER_R31_R40_1300';
const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');

function safeDir(root){
 if(!root||typeof root!=='string')throw new Error('Asset directory required');
 return path.resolve(root);
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function assertSafeAssetPath(root,relative){
 const target=path.resolve(root,relative);
 if(!target.startsWith(root+path.sep))throw new Error('Unsafe relative asset path');
 return target;
}
export async function verifyLocalAssets(root){
 const manifestFile=path.join(root,'collectible-art-manifest.json');
 const raw=await fs.readFile(manifestFile);
 const manifest=JSON.parse(raw.toString('utf8'));
 const result=validateArtManifest(manifest);
 for(const item of manifest.items){
  const data=await fs.readFile(assertSafeAssetPath(root,item.path));
  if(!data.length||sha256(data).toLowerCase()!==item.sha256.toLowerCase())
   throw new Error('Asset integrity check failed: '+item.key);
 }
 const marker={version:1,total:1300,catalogue_version:SOURCE_CATALOGUE,
  manifest_sha256:sha256(raw),ready:true};
 return {manifest,marker,bytes:raw.length};
}

async function withRetries(operation,tag){
 let last;
 for(let attempt=0;attempt<3;attempt++){
  try{return await operation();}
  catch(e){last=e;if(attempt<2)await sleep(Math.min(3000,350*Math.pow(2,attempt)));}
 }
 throw new Error(tag+': '+String(last instanceof Error?last.message:last));
}

async function uploadOne(client,root,item){
 const file=await fs.readFile(assertSafeAssetPath(root,item.path));
 const response=await client.storage.from(BUCKET).upload(item.path,file,{
  upsert:false,contentType:'image/webp',cacheControl:'31536000',
 });
 if(!response.error)return;
 const msg=String(response.error.message||'');
 // Retry resumed uploads only if the already-stored blob has exactly the
 // expected content hash. A conflict with different bytes is a HARD STOP.
 if(response.error.statusCode==='409'||/already exists|duplicate/i.test(msg)){
  const prior=await client.storage.from(BUCKET).download(item.path);
  if(prior.error||!prior.data)throw new Error('Unable to check existing asset '+item.key);
  const hash=sha256(Buffer.from(await prior.data.arrayBuffer()));
  if(hash!==item.sha256.toLowerCase())throw new Error('Remote asset hash mismatch: '+item.key);
  return;
 }
 throw response.error;
}

async function uploadAll(client,root,items){
 const queues=Array.from({length:3},()=>[]);
 items.forEach((item,i)=>queues[i%3].push(item));
 let completed=0;
 await Promise.all(queues.map(async queue=>{
  for(const item of queue){
   await withRetries(()=>uploadOne(client,root,item),item.key);
   completed++;
   if(completed%100===0)process.stdout.write('Verified uploads: '+completed+'/1300\n');
  }
 }));
}
// Verify every remote object's bytes, not just that a same-named file exists.
// The marker must never describe a fully checked catalogue when CDN/storage
// returned truncated or unexpected content. Three workers bound request load.
export async function verifyRemoteCounts(client,items){
 const expected=expectedEntries();
 if(!Array.isArray(items)||items.length!==expected.length)
  throw new Error('Expected exact 1300 remote image receipts');
 const byKey=new Map(items.map(item=>[item.key,item]));
 for(const candidate of expected){
  const item=byKey.get(candidate.key);
  if(!item||item.path!==candidate.path||!/^[0-9a-f]{64}$/i.test(item.sha256))
   throw new Error('Missing expected remote image: '+candidate.key);
 }
 for(const character of [...new Set(expected.map(x=>x.key.split(':')[0]))]){
  const prefix='character-collectibles/'+character;
  const {data,error}=await withRetries(async()=>{
   const response=await client.storage.from(BUCKET).list(prefix,{limit:1000});
   if(response.error)throw response.error;
   return response;
  },'list '+character);
  const expectedNames=expected.filter(x=>x.key.startsWith(character+':')).map(x=>path.basename(x.path));
  const actualNames=new Set((data||[]).map(row=>row.name));
  if(actualNames.size!==expectedNames.length||expectedNames.some(x=>!actualNames.has(x)))
   throw new Error('Remote image inventory mismatch for '+character);
 }
 const queues=Array.from({length:3},()=>[]);
 items.forEach((item,i)=>queues[i%3].push(item));
 await Promise.all(queues.map(async queue=>{
  for(const item of queue){
   const response=await withRetries(async()=>{
    const result=await client.storage.from(BUCKET).download(item.path);
    if(result.error||!result.data)throw result.error||new Error('Missing remote asset');
    return result;
   },'download '+item.key);
   const digest=sha256(Buffer.from(await response.data.arrayBuffer()));
   if(digest!==item.sha256.toLowerCase())
    throw new Error('Remote asset hash mismatch: '+item.key);
  }
 }));
}

async function main(){
 const args=process.argv.slice(2);
 const root=safeDir(args.find(x=>!x.startsWith('--')));
 const {manifest,marker}=await verifyLocalAssets(root);
 process.stdout.write('1300 local images verified, marker '+marker.manifest_sha256+'\n');
 if(!args.includes('--publish')){
  process.stdout.write('DRY RUN ONLY — no storage writes. Pass --publish with explicit approval in an isolated RC upload runner.\n');
  return;
 }
 if(process.env.BUKLOD_ART_PUBLISH_APPROVED!=='1')
  throw new Error('BUKLOD_ART_PUBLISH_APPROVED=1 required');
 const url=process.env.SUPABASE_URL||'',key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
 if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)||!key)
  throw new Error('Trusted SUPABASE_URL and service role key required');
 const expectedRef=(process.env.BUKLOD_ART_EXPECTED_PROJECT_REF||'').trim();
 const expectedManifest=(process.env.BUKLOD_ART_EXPECTED_MANIFEST_SHA256||'').toLowerCase().trim();
 if(!/^[a-z0-9]{20}$/.test(expectedRef)||new URL(url).hostname!==expectedRef+'.supabase.co')
  throw new Error('Target Supabase project must match BUKLOD_ART_EXPECTED_PROJECT_REF');
 if(expectedManifest!==marker.manifest_sha256)
  throw new Error('Pinned BUKLOD_ART_EXPECTED_MANIFEST_SHA256 does not match local art');
 const client=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:bucket,error}=await client.storage.getBucket(BUCKET);
 if(error||!bucket?.public)throw new Error('Public artwork bucket migration not present');
 await uploadAll(client,root,manifest.items);
 await verifyRemoteCounts(client,manifest.items);
 // Publishing marker is an atomic readiness gate; never do this before full
 // asset count and per-file hash confirmation. The app checks this marker.
 const {error:markerError}=await client.storage.from(BUCKET).upload(
  MARKER,new TextEncoder().encode(JSON.stringify(marker)),{
   upsert:true,contentType:'application/json',cacheControl:'300',
  });
 if(markerError)throw markerError;
 process.stdout.write('Published verified Character artwork marker.\n');
}
if(process.argv[1]?.endsWith('publish-character-collectible-art.mjs')){
 main().catch(e=>{process.stderr.write(String(e instanceof Error?e.message:e)+'\n');process.exitCode=1;});
}
