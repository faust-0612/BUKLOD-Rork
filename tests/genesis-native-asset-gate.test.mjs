import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {auditGenesisAssets,REQUIRED_ROLES} from '../scripts/genesis-native-asset-gate.mjs';

const manifest=JSON.parse(readFileSync(new URL('../assets/season2/genesis/sources.json',import.meta.url),'utf8'));
test('candidate discovery is not mistaken for acquired binary assets',()=>{
  const out=auditGenesisAssets(manifest,process.cwd());
  assert.equal(out.ok,true);
  assert.deepEqual(out.readyRoles,[]);
  assert.equal(manifest.releaseStatus,'SOURCE_DISCOVERY_ONLY_NO_BINARY_IMPORT');
});
test('release fails closed without every genuine graphics and audio class',()=>{
  const out=auditGenesisAssets(manifest,process.cwd(),{forRelease:true});
  assert.equal(out.ok,false);
  for(const role of REQUIRED_ROLES)assert.ok(out.errors.some(e=>e.includes(role)));
});
test('pin exact local bytes and reject tampering',()=>{
  const dir=mkdtempSync(join(tmpdir(),'genesis-assets-'));
  try{
    const approved=join(dir,'assets/season2/genesis/approved');
    mkdirSync(approved,{recursive:true});
    const bytes=Buffer.from('nonproduction test fixture');
    writeFileSync(join(approved,'sky.webp'),bytes);
    const a={...manifest.assets[0],status:'approved',relativePath:'sky.webp',sha256:createHash('sha256').update(bytes).digest('hex')};
    const one={schemaVersion:1,assets:[a]};
    const out=auditGenesisAssets(one,dir,{forRelease:true,requiredRoles:['cosmic-skybox']});
    assert.equal(out.ok,true);
    assert.deepEqual(out.readyRoles,['cosmic-skybox']);
    writeFileSync(join(approved,'sky.webp'),'modified');
    const next=auditGenesisAssets(one,dir,{forRelease:true,requiredRoles:['cosmic-skybox']});
    assert.equal(next.ok,false);
    assert.ok(next.errors.some(e=>e.includes('hash mismatch')));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('unsafe paths, duplicate IDs, unknown license and untrusted host fail',()=>{
  const a=manifest.assets[0];
  const list=[
    {...a,status:'approved',relativePath:'../../secret.webp',sha256:'a'.repeat(64)},
    {...a,id:'unsafe-vendor',sourceUrl:'https://untrusted.invalid/art',license:'Proprietary'},
    {...a},
  ];
  const out=auditGenesisAssets({schemaVersion:1,assets:list},process.cwd());
  assert.equal(out.ok,false);
  for(const phrase of ['unsafe path/type','untrusted source','Duplicate asset id'])
    assert.ok(out.errors.some(e=>e.includes(phrase)),phrase);
});
