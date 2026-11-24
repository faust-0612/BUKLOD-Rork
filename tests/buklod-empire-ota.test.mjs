import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {generateKeyPairSync,createHash,verify} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const hash=b=>createHash('sha256').update(b).digest('hex');
test('signed cumulative delta, protected bootstrap and wrong key rejection',()=>{
 const tmp=mkdtempSync(path.join(os.tmpdir(),'empire-ota-test-'));
 try{
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const privatePath=path.join(tmp,'key.pem');
  writeFileSync(privatePath,privateKey.export({type:'pkcs8',format:'pem'}));
  const pem=publicKey.export({type:'spki',format:'pem'});
  const assets=path.join(tmp,'assets'),out=path.join(tmp,'out');
  mkdirSync(path.join(assets,'data'),{recursive:true});
  mkdirSync(path.join(assets,'scripts'),{recursive:true});
  const inventory={'data/catalog.json':hash('old'),'scripts/empire_ota.gd':hash('immutable')};
  const baseline={schema:1,channel:'dev',runtime:'empire-godot-4.7.2-r1',base:hash(JSON.stringify(inventory)),inventory};
  const file=path.join(tmp,'baseline.json');writeFileSync(file,JSON.stringify(baseline));
  writeFileSync(path.join(assets,'data/catalog.json'),'new');
  writeFileSync(path.join(assets,'scripts/empire_ota.gd'),'immutable');
  const run=(key=pem)=>execFileSync(process.execPath,['scripts/build-buklod-empire-ota.mjs',file,assets,'1',out],{env:{...process.env,BUKLOD_EMPIRE_OTA_PRIVATE_KEY_FILE:privatePath,BUKLOD_EMPIRE_OTA_PUBLIC_KEY:key},stdio:'pipe'});
  run();
  const env=JSON.parse(readFileSync(path.join(out,'manifest.json')));
  const payload=Buffer.from(env.payload,'base64');
  assert.ok(verify('sha256',payload,publicKey,Buffer.from(env.signature,'base64')));
  const d=JSON.parse(payload);assert.equal(d.base,baseline.base);assert.equal(d.channel,'dev');
  const zip=path.join(out,d.sha256+'.zip');assert.equal(hash(readFileSync(zip)),d.sha256);
  assert.equal(execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim(),'data/catalog.json');
  assert.throws(()=>run(generateKeyPairSync('rsa',{modulusLength:2048}).publicKey.export({type:'spki',format:'pem'})));
  writeFileSync(path.join(assets,'scripts/empire_ota.gd'),'changed');
  assert.throws(()=>run());
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
