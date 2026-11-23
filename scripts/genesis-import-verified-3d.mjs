#!/usr/bin/env node
/**
 * Fetches only 20 pinned Kenney CC0 GLB binaries into a temporary asset build
 * directory. No arbitrary URLs, no user credentials, no native/build installs.
 * The canonical Git blob SHA, glTF header, mesh inventory and size must match.
 */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(path.join(root,'godot/empire-arena/library/verified_cc0_3d_manifest.json'),'utf8'));
assert.equal(manifest.schema,1);
assert.equal(manifest.source.license,'CC0-1.0');
assert.match(manifest.source.commit,/^[a-f0-9]{40}$/);
assert.equal(manifest.models.length,20);
const outputRoot=path.join(root,'build/genesis-206-imported-3d');
mkdirSync(outputRoot,{recursive:true});
let bytesTotal=0;
const meta=[];
for(const model of manifest.models){
  assert.match(model.id,/^[a-z0-9_]+$/);
  assert.match(model.path,/^packs\/[a-z0-9-]+\/[a-z0-9-]+\.glb$/);
  assert.match(model.gitBlob,/^[a-f0-9]{40}$/);
  assert.ok(model.bytes>=2000&&model.bytes<=512000);
  const url='https://raw.githubusercontent.com/'+manifest.source.repository+'/'+manifest.source.commit+'/'+model.path;
  const bytes=execFileSync('curl',['-fsSL','--retry','2','--connect-timeout','15','--max-time','35',url],
    {maxBuffer:1024*1024,timeout:45000});
  assert.equal(bytes.length,model.bytes,'GLB size mismatch '+model.id);
  const blobSha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  assert.equal(blobSha,model.gitBlob,'source Git blob mismatch '+model.id);
  assert.equal(bytes.toString('ascii',0,4),'glTF','invalid binary glTF '+model.id);
  assert.equal(bytes.readUInt32LE(4),2,'only GLB version 2 '+model.id);
  assert.equal(bytes.readUInt32LE(8),bytes.length,'GLB length mismatch '+model.id);
  const jsonLength=bytes.readUInt32LE(12);
  assert.ok(jsonLength>20&&jsonLength<bytes.length-20);
  assert.equal(bytes.toString('ascii',16,20),'JSON');
  const doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8').trim());
  assert.ok(Array.isArray(doc.meshes)&&doc.meshes.length>0,'GLB missing mesh '+model.id);
  assert.ok(!doc.extensionsRequired?.some(x=>/draco|meshopt/i.test(x)),'unsupported mesh encoding '+model.id);
  const target=path.join(outputRoot,model.id+'.glb');
  writeFileSync(target,bytes,{mode:0o644});
  const sha256=createHash('sha256').update(bytes).digest('hex');
  meta.push({id:model.id,sha256,sourceGitBlob:blobSha,bytes:bytes.length,meshes:doc.meshes.length});
  bytesTotal+=bytes.length;
}
assert.ok(bytesTotal<4*1024*1024,'oversized mobile 3D collection');
const out={schema:1,license:'CC0-1.0',source:manifest.source,kind:manifest.kind,models:meta};
writeFileSync(path.join(outputRoot,'manifest.json'),JSON.stringify(out,null,2)+'\n');
console.log('BUKLOD_206_CC0_GLB_20_IMPORTED_AND_HASHED '+JSON.stringify({models:meta.length,totalBytes:bytesTotal}));
