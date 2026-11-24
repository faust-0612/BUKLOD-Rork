#!/usr/bin/env node
/** Offline release packager: signed cumulative delta against installed APK baseline.
 * Requires owner-controlled signing key file. No private keys in source/APK/artifact.
 * Generates upload-ready files only; never writes to Supabase or production. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync,mkdirSync,readdirSync,copyFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash,createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const [baselinePath,contentRoot,sequenceRaw,outDir]=process.argv.slice(2);
assert.ok(baselinePath&&contentRoot&&sequenceRaw&&outDir,'Usage: baseline.json candidate-assets sequence output-dir');
const baseline=JSON.parse(readFileSync(baselinePath,'utf8'));
const sequence=Number(sequenceRaw);
assert.ok(Number.isSafeInteger(sequence)&&sequence>0&&sequence<=2147483647);
assert.equal(baseline.schema,1);
assert.equal(baseline.runtime,'empire-godot-4.7.2-r1');
assert.ok(['dev','staging','production'].includes(baseline.channel));
const hash=x=>createHash('sha256').update(x).digest('hex');
assert.equal(hash(JSON.stringify(baseline.inventory)),baseline.base);
const keyPath=process.env.BUKLOD_EMPIRE_OTA_PRIVATE_KEY_FILE;
assert.ok(keyPath,'Owner-controlled private signing key file required');
const privateKey=createPrivateKey(readFileSync(keyPath));
assert.equal(privateKey.asymmetricKeyType,'rsa');
assert.ok(privateKey.asymmetricKeyDetails.modulusLength>=2048);
const expected=process.env.BUKLOD_EMPIRE_OTA_PUBLIC_KEY;
assert.ok(expected,'Pinned installed APK public key required');
assert.equal(createPublicKey(privateKey).export({type:'spki',format:'der'}).toString('hex'),createPublicKey(expected).export({type:'spki',format:'der'}).toString('hex'),'Signer differs from installed APK');
const immutable=new Set(['scripts/empire_ota.gd','scripts/empire_boot.gd','scripts/empire_session.gd','scripts/empire_menu.gd','scenes/EmpireBoot.tscn','scenes/EmpireMenu.tscn']);
const allow=p=>!immutable.has(p)&&/^(scripts|scenes|art|audio|world-art|world-audio|kingdom-items|3d|data|shaders)\/[a-zA-Z0-9_./-]+\.(gd|tscn|tres|gdshader|png|webp|jpg|jpeg|wav|ogg|glb|json)$/.test(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'&&!x.startsWith('.'));
const current={};
function walk(dir){
 for(const n of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const f=path.join(dir,n.name);
  assert.ok(!n.isSymbolicLink(),'Symlink refused');
  if(n.isDirectory())walk(f);
  else {
   const p=path.relative(contentRoot,f).split(path.sep).join('/');
   if(p==='empire-ota/config.json')continue;
   current[p]=hash(readFileSync(f));
  }
 }
}
walk(contentRoot);
for(const p of Object.keys(baseline.inventory))assert.ok(current[p],'Deleted resource requires new APK: '+p);
const delta=Object.keys(current).filter(p=>current[p]!==baseline.inventory[p]).sort();
assert.ok(delta.length>0&&delta.length<=4096,'No compatible delta');
for(const p of delta)assert.ok(allow(p),'Immutable or unsupported resource requires new APK: '+p);
const tmp=mkdtempSync(path.join(os.tmpdir(),'empire-ota-'));
try{
 for(const p of delta){const dest=path.join(tmp,p);mkdirSync(path.dirname(dest),{recursive:true});copyFileSync(path.join(contentRoot,p),dest);}
 const zip=path.join(tmp,'overlay.zip');
 execFileSync('zip',['-q','-X',zip,...delta],{cwd:tmp,timeout:120000});
 const bytes=statSync(zip).size;
 assert.ok(bytes<=128*1024*1024,'Pack exceeds size cap');
 const sha256=hash(readFileSync(zip));
 const payload=Buffer.from(JSON.stringify({schema:1,package:'org.mzbministry.buklod.empire',channel:baseline.channel,runtime:baseline.runtime,base:baseline.base,sequence,bytes,sha256}));
 const signature=sign('sha256',payload,privateKey);
 mkdirSync(outDir,{recursive:true});
 copyFileSync(zip,path.join(outDir,sha256+'.zip'));
 writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify({payload:payload.toString('base64'),signature:signature.toString('base64')})+'\n');
 console.log(JSON.stringify({sequence,sha256,bytes,changedFiles:delta.length,channel:baseline.channel,published:false}));
}finally{rmSync(tmp,{recursive:true,force:true});}
