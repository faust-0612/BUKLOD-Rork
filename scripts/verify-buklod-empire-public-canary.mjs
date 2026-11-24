/** Verify the actual public signed manifest and bytes for the exact APK base.
 * Read-only. No service credentials are required. */
import assert from 'node:assert/strict';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const root='build/buklod-empire';
const base=JSON.parse(readFileSync(root+'/ota-baseline.json'));
const config=JSON.parse(readFileSync('apps/buklod-empire/app/src/main/assets/empire-ota/config.json'));
assert.equal(base.channel,'dev');assert.equal(base.runtime,config.runtime);
assert.equal(base.base,config.base);assert.match(base.base,/^[a-f0-9]{64}$/);
const key=createPublicKey(config.key);
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(key.export({type:'spki',format:'der'})),base.keyFingerprint);
const origin='https://yhanxndaqbmuzbdqlblu.supabase.co/storage/v1/object/public/empire-updates/dev/'+base.base+'/';
async function get(name,max){
 const r=await fetch(origin+name,{redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});
 assert.ok(r.ok,name+' HTTP '+r.status);
 const len=Number(r.headers.get('content-length')||0);assert.ok(len<=max);
 const reader=r.body.getReader();let count=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;assert.ok(count<=max);chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}
const envelope=JSON.parse(await get('manifest.json',65536));
const bytes=Buffer.from(envelope.payload,'base64');
assert.ok(verify('sha256',bytes,key,Buffer.from(envelope.signature,'base64')));
const m=JSON.parse(bytes);
assert.equal(m.schema,1);assert.equal(m.package,'org.mzbministry.buklod.empire');assert.equal(m.channel,'dev');assert.equal(m.runtime,base.runtime);assert.equal(m.base,base.base);
assert.equal(m.sequence,1,'Initial candidate requires harmless canary sequence 1');assert.match(m.sha256,/^[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(m.bytes)&&m.bytes>=22&&m.bytes<=65536);
const pack=await get(m.sha256+'.zip',65536);assert.equal(pack.length,m.bytes);assert.equal(hash(pack),m.sha256);
const tmp=root+'/remote-canary.zip';writeFileSync(tmp,pack);
assert.equal(execFileSync('unzip',['-Z1',tmp],{encoding:'utf8'}).trim(),'data/ota_canary.json');
const data=JSON.parse(execFileSync('unzip',['-p',tmp,'data/ota_canary.json'],{encoding:'utf8'}));
assert.equal(data.kind,'BUKLOD_EMPIRE_DEV_OTA_CANARY');assert.equal(data.base,base.base);
writeFileSync(root+'/remote-canary.json',JSON.stringify({status:'PUBLIC_SIGNED_CANARY_VERIFIED',base:base.base,sequence:1,sha256:m.sha256,bytes:m.bytes},null,2)+'\n');
console.log('BUKLOD_EMPIRE_PUBLIC_CANARY_VERIFIED '+m.sha256);
