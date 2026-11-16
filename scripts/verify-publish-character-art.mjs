#!/usr/bin/env node
/* Fail-closed, idempotent 1,300-object art publisher. No Expo client secret. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import process from 'node:process';

const rootArg = process.argv[2];
const publish = process.argv.includes('--publish');
if (!rootArg || rootArg.startsWith('--')) throw new Error('Usage: node scripts/verify-publish-character-art.mjs <EXTRACTED_ROOT> [--publish]');
const root = resolve(rootArg);
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const pad = n => String(n).padStart(2,'0');
const ids = ['phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice'];
const idSet = new Set(ids);
const manifestBytes = await readFile(join(root,'collectible-art-manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
assert.equal(manifest.catalogue_version, 'BUKLOD_CHARACTER_R31_R40_1300');
assert.equal(manifest.items.length, 1300);
const markerBytes = await readFile(join(root, 'published-v1.json'));
const marker = JSON.parse(markerBytes.toString('utf8'));
assert.equal(marker.total, 1300);
assert.equal(marker.ready, true);
assert.equal(marker.manifest_sha256, sha256(manifestBytes));
const entries = [];
const unique = new Set();
for (const item of manifest.items) {
  assert.match(item.key, /^(phan|quin|van|christian|lhen|ace|ellusur|jawo|mitch|niel|angel|vhen|trudice):L(0[1-9]|1[0-9]|20):I0[1-5]$/);
  const [id,lv,idx] = item.key.split(':');
  const level = Number(lv.slice(1)), index = Number(idx.slice(1));
  assert.ok(idSet.has(id));
  assert.equal(item.path, 'character-collectibles/' + id + '/l' + pad(level) + '-i' + pad(index) + '.webp');
  assert.equal(unique.has(item.path), false, 'Duplicate: ' + item.path);
  unique.add(item.path);
  const bytes = await readFile(join(root, item.path));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(sha256(bytes),item.sha256, 'Corrupt art: ' + item.path);
  entries.push({path:item.path,sha:item.sha256,bytes});
}
assert.equal(unique.size, 1300);
console.log('PASS: all 1,300 source art files, names, keys and SHA-256 hashes match.');
if (publish) {
  const url=(process.env.SUPABASE_URL || '').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket=process.env.BUKLOD_CHARACTER_ART_BUCKET || 'buklod-character-art-v1';
  if (!/^https:\/\/[^?#\s]+$/.test(url) || !key || !/^[a-z0-9-]+$/.test(bucket)) {
    throw new Error('Storage target unavailable. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and BUKLOD_CHARACTER_ART_BUCKET. Nothing was uploaded.');
  }
  const writeUrl=url+'/storage/v1/object/'+bucket+'/';
  const publicUrl=url+'/storage/v1/object/public/'+bucket+'/';
  async function requestWithRetry(method,path,body) {
    const target=method==='GET' ? publicUrl+path : writeUrl+path;
    for (let attempt=0;attempt<3;attempt++) {
      let response;
      try {
        response=await fetch(target,{
          method,signal:AbortSignal.timeout(20000),
          headers:method==='GET' ? {} : {
            Authorization:'Bearer '+key, apikey:key, 'content-type':'image/webp', 'x-upsert':'true',
            'cache-control':'31536000'
          },body:method==='GET'?undefined:body
        });
      } catch (error) {
        if(attempt===2)throw error;
        await new Promise(r=>setTimeout(r,1000*(attempt+1)));
        continue;
      }
      if(response.ok) return response;
      if(![429,500,502,503,504].includes(response.status)||attempt===2)throw new Error(method+' failed HTTP '+response.status+' on '+path);
      await response.arrayBuffer();
      await new Promise(r=>setTimeout(r,1000*(attempt+1)));
    }
    throw new Error('Storage retries exhausted: '+path);
  }
  let next=0,verified=0;
  async function worker() {
    for(;;){
      const i=next++;
      if(i>=entries.length)return;
      const entry=entries[i];
      await requestWithRetry('POST',entry.path,entry.bytes);
      const readBack=Buffer.from(await (await requestWithRetry('GET',entry.path)).arrayBuffer());
      assert.equal(sha256(readBack),entry.sha,'Public readback checksum failed: '+entry.path);
      verified++;
      if(verified%100===0)console.log('Verified public art: '+verified+'/1300');
    }
  }
  await Promise.all(Array.from({length:4},worker));
  assert.equal(verified,1300);
  const markerPath='published-v1.json';
  const response=await fetch(writeUrl+markerPath,{
    method:'POST',signal:AbortSignal.timeout(20000),
    headers:{ Authorization:'Bearer '+key, apikey:key, 'content-type':'application/json', 'x-upsert':'true', 'cache-control':'60' },
    body:markerBytes
  });
  if(!response.ok)throw new Error('Ready marker upload failed HTTP '+response.status);
  const publicMarker=await fetch(publicUrl+markerPath,{signal:AbortSignal.timeout(20000)});
  if(!publicMarker.ok || sha256(Buffer.from(await publicMarker.arrayBuffer()))!==sha256(markerBytes)) {
    throw new Error('Ready marker public readback mismatch');
  }
  console.log('PASS: 1,300 verified public assets. Ready marker published last.');
  console.log('Base URL for staging: '+publicUrl.replace(/\/$/,''));
}
